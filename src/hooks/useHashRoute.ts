import { useCallback, useEffect, useState } from "react";

/** `#/view/<id>` から選択中のIDを取り出す。ルーターライブラリは使わない。 */
function parse(hash: string): string | null {
  const m = hash.match(/^#\/view\/([^/]+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function useHashRoute() {
  const [selectedId, setSelectedId] = useState<string | null>(() => parse(location.hash));

  useEffect(() => {
    const onChange = () => setSelectedId(parse(location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const select = useCallback((id: string | null) => {
    location.hash = id ? `#/view/${encodeURIComponent(id)}` : "#/";
  }, []);

  return { selectedId, select };
}
