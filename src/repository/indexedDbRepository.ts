import type { Content, ContentMeta, ContentRepository } from "./types";

const DB_NAME = "html-host";
const DB_VERSION = 1;
// 一覧取得で本文を読まずに済むよう、メタ情報と本文を別ストアに分ける
const META_STORE = "meta";
const BODY_STORE = "body";

function promisify<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export class IndexedDbRepository implements ContentRepository {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private db(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(META_STORE)) {
            db.createObjectStore(META_STORE, { keyPath: "id" });
          }
          if (!db.objectStoreNames.contains(BODY_STORE)) {
            db.createObjectStore(BODY_STORE); // key: id, value: html string
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return this.dbPromise;
  }

  async list(): Promise<ContentMeta[]> {
    const db = await this.db();
    const tx = db.transaction(META_STORE, "readonly");
    const all = await promisify<ContentMeta[]>(tx.objectStore(META_STORE).getAll());
    return all.sort((a, b) => b.createdAt - a.createdAt);
  }

  async get(id: string): Promise<Content | undefined> {
    const db = await this.db();
    const tx = db.transaction([META_STORE, BODY_STORE], "readonly");
    const [meta, html] = await Promise.all([
      promisify<ContentMeta | undefined>(tx.objectStore(META_STORE).get(id)),
      promisify<string | undefined>(tx.objectStore(BODY_STORE).get(id)),
    ]);
    if (!meta || html === undefined) return undefined;
    return { ...meta, html };
  }

  async save(input: { name: string; html: string }): Promise<ContentMeta> {
    const meta: ContentMeta = {
      id: crypto.randomUUID(), // 同名でも別IDで追加（上書きしない）
      name: input.name,
      size: new Blob([input.html]).size,
      createdAt: Date.now(),
    };
    const db = await this.db();
    const tx = db.transaction([META_STORE, BODY_STORE], "readwrite");
    tx.objectStore(META_STORE).put(meta);
    tx.objectStore(BODY_STORE).put(input.html, meta.id);
    await txDone(tx);
    return meta;
  }

  async delete(id: string): Promise<void> {
    const db = await this.db();
    const tx = db.transaction([META_STORE, BODY_STORE], "readwrite");
    tx.objectStore(META_STORE).delete(id);
    tx.objectStore(BODY_STORE).delete(id);
    await txDone(tx);
  }
}
