import { useCallback, useEffect, useState } from "react";
import { repository, type ContentMeta } from "../repository";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPT = /\.html?$/i;

export interface UploadResult {
  added: ContentMeta[];
  rejected: { name: string; reason: string }[];
}

export function useContents() {
  const [items, setItems] = useState<ContentMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setItems(await repository.list());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    repository.me().then(setMe, () => setMe(null));
  }, [reload]);

  const upload = useCallback(
    async (files: File[]): Promise<UploadResult> => {
      const result: UploadResult = { added: [], rejected: [] };
      for (const file of files) {
        if (!ACCEPT.test(file.name)) {
          result.rejected.push({ name: file.name, reason: "HTMLファイルではありません" });
          continue;
        }
        if (file.size > MAX_SIZE) {
          result.rejected.push({ name: file.name, reason: "10MBを超えています" });
          continue;
        }
        try {
          const html = await file.text();
          result.added.push(await repository.save({ name: file.name, html }));
        } catch (e) {
          result.rejected.push({ name: file.name, reason: e instanceof Error ? e.message : "保存に失敗しました" });
        }
      }
      await reload();
      return result;
    },
    [reload],
  );

  const remove = useCallback(
    async (id: string) => {
      await repository.delete(id);
      await reload();
    },
    [reload],
  );

  return { items, loading, me, error, upload, remove };
}
