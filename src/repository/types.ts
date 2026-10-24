/** 一覧表示用のメタ情報（本文を含まない） */
export interface ContentMeta {
  id: string;
  name: string;
  size: number; // bytes
  createdAt: number; // epoch ms
  ownerEmail: string; // アップロードした人
  mine: boolean; // ログイン中の本人のものか（削除できるか）
}

/** 本文を含むコンテンツ */
export interface Content extends ContentMeta {
  html: string;
}

/**
 * コンテンツの保存先を抽象化するインターフェース。
 * 現在は CloudRepository（Worker API + D1/R2）。IndexedDbRepository はブラウザ内のみで動く旧実装。
 */
export interface ContentRepository {
  list(): Promise<ContentMeta[]>;
  get(id: string): Promise<Content | undefined>;
  save(input: { name: string; html: string }): Promise<ContentMeta>;
  delete(id: string): Promise<void>;
}
