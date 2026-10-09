import { IndexedDbRepository } from "./indexedDbRepository";
import type { ContentRepository } from "./types";

export type { Content, ContentMeta, ContentRepository } from "./types";

/** 保存先の切り替えはここ1か所。クラウド化時は CloudRepository を返す。 */
export const repository: ContentRepository = new IndexedDbRepository();
