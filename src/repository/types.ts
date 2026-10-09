/** 一覧表示用のメタ情報（本文を含まない） */
export interface ContentMeta {
  id: string;
  name: string;
  size: number; // bytes
  createdAt: number; // epoch ms
}

/** 本文を含むコンテンツ */
export interface Content extends ContentMeta {
  html: string;
}

/**
 * コンテンツの保存先を抽象化するインターフェース。
 * 現在は IndexedDbRepository、将来は CloudRepository（API呼び出し）に差し替える。
 */
export interface ContentRepository {
  list(): Promise<ContentMeta[]>;
  get(id: string): Promise<Content | undefined>;
  save(input: { name: string; html: string }): Promise<ContentMeta>;
  delete(id: string): Promise<void>;
}
