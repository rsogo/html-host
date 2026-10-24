import { CloudRepository } from "./cloudRepository";

export type { Content, ContentMeta, ContentRepository } from "./types";
export { ApiError } from "./cloudRepository";

/** 保存先の切り替えはここ1か所。ブラウザ内だけで試すなら IndexedDbRepository に戻す。 */
export const repository = new CloudRepository();
