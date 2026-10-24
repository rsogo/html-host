import type { Content, ContentMeta, ContentRepository } from "./types";

/** API がエラーを返したときの例外（status で 401 などを判別できる） */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "same-origin", // Cloudflare Access のログイン Cookie を送る
    headers: { Accept: "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let message = `エラーが発生しました（${res.status}）`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // JSON 以外（Access のログイン画面への転送など）
    }
    throw new ApiError(res.status, message);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

/** Worker API（/api/*）経由で D1 / R2 に保存する。DB の鍵はブラウザに一切渡らない */
export class CloudRepository implements ContentRepository {
  list(): Promise<ContentMeta[]> {
    return request("/api/contents");
  }

  async get(id: string): Promise<Content | undefined> {
    try {
      return await request<Content>(`/api/contents/${encodeURIComponent(id)}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return undefined;
      throw e;
    }
  }

  save(input: { name: string; html: string }): Promise<ContentMeta> {
    return request("/api/contents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  }

  async delete(id: string): Promise<void> {
    await request(`/api/contents/${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  async me(): Promise<string> {
    return (await request<{ email: string }>("/api/me")).email;
  }
}
