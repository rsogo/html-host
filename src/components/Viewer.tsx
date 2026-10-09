import { useEffect, useState } from "react";
import { repository, type Content } from "../repository";

interface Props {
  id: string | null;
}

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "notFound" }
  | { kind: "ready"; content: Content };

export function Viewer({ id }: Props) {
  const [state, setState] = useState<State>({ kind: "idle" });

  useEffect(() => {
    if (!id) {
      setState({ kind: "idle" });
      return;
    }
    let cancelled = false;
    setState({ kind: "loading" });
    repository.get(id).then((content) => {
      if (cancelled) return;
      setState(content ? { kind: "ready", content } : { kind: "notFound" });
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  switch (state.kind) {
    case "idle":
      return <div className="viewer__placeholder">一覧からコンテンツを選択してください</div>;
    case "loading":
      return <div className="viewer__placeholder">読み込み中…</div>;
    case "notFound":
      return <div className="viewer__placeholder">コンテンツが見つかりません（削除された可能性があります）</div>;
    case "ready":
      return (
        <div className="viewer">
          <div className="viewer__bar">{state.content.name}</div>
          {/*
            sandbox に allow-same-origin を付けないこと。
            付けるとアップロードされたHTMLのJSが本体と同じオリジン扱いになり、
            IndexedDB（他のコンテンツ）や親DOMにアクセスできてしまう。
          */}
          <iframe
            key={state.content.id}
            title={state.content.name}
            className="viewer__frame"
            sandbox="allow-scripts allow-forms allow-popups allow-modals"
            srcDoc={state.content.html}
          />
        </div>
      );
  }
}
