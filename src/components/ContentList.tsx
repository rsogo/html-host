import type { ContentMeta } from "../repository";

interface Props {
  items: ContentMeta[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (item: ContentMeta) => void;
}

const dateFmt = new Intl.DateTimeFormat("ja-JP", { dateStyle: "short", timeStyle: "short" });

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ContentList({ items, selectedId, onSelect, onDelete }: Props) {
  if (items.length === 0) {
    return <p className="empty">まだコンテンツがありません</p>;
  }
  return (
    <ul className="list">
      {items.map((item) => (
        <li key={item.id} className={item.id === selectedId ? "list__item--selected" : ""}>
          <button className="list__main" onClick={() => onSelect(item.id)}>
            <span className="list__name">{item.name}</span>
            <span className="list__meta">
              {dateFmt.format(item.createdAt)} ・ {formatSize(item.size)}
            </span>
          </button>
          <button className="list__delete" aria-label={`${item.name} を削除`} onClick={() => onDelete(item)}>
            ×
          </button>
        </li>
      ))}
    </ul>
  );
}
