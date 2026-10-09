import { useState } from "react";
import { ContentList } from "./components/ContentList";
import { UploadArea } from "./components/UploadArea";
import { Viewer } from "./components/Viewer";
import { useContents } from "./hooks/useContents";
import { useHashRoute } from "./hooks/useHashRoute";
import type { ContentMeta } from "./repository";

export function App() {
  const { items, loading, upload, remove } = useContents();
  const { selectedId, select } = useHashRoute();
  const [message, setMessage] = useState<string | null>(null);

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;
    const { added, rejected } = await upload(files);
    if (added.length > 0) select(added[0].id); // 先頭を表示
    setMessage(
      rejected.length > 0
        ? `${added.length}件追加、${rejected.length}件スキップ：` +
            rejected.map((r) => `${r.name}（${r.reason}）`).join("、")
        : `${added.length}件追加しました`,
    );
  };

  const handleDelete = async (item: ContentMeta) => {
    if (!window.confirm(`「${item.name}」を削除しますか？`)) return;
    await remove(item.id);
    if (selectedId === item.id) select(null);
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>HTML Host</h1>
        <UploadArea onFiles={handleFiles} />
        {message && (
          <p className="message" role="status">
            {message}
          </p>
        )}
        {loading ? (
          <p className="empty">読み込み中…</p>
        ) : (
          <ContentList items={items} selectedId={selectedId} onSelect={select} onDelete={handleDelete} />
        )}
      </aside>
      <main className="main">
        <Viewer id={selectedId} />
      </main>
    </div>
  );
}
