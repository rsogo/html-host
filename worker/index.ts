/**
 * HTML Host のアプリ（API）。基盤の部品は platform/ から受け取る。
 *   GET    /api/me             ログイン中のユーザー
 *   GET    /api/contents       一覧（社内のログインした人全員が閲覧可）
 *   GET    /api/contents/:id   本文の取得（同上）
 *   POST   /api/contents       アップロード（所有者はログイン中の本人）
 *   DELETE /api/contents/:id   削除（所有者本人のみ）
 *
 * アプリ側で守ること
 *   - 利用者は getUser() で取る（画面から送られた値は使わない）
 *   - SQL は必ずプレースホルダ（bind）で組み立てる
 *   - 削除・更新は requireOwner() で本人確認する
 *   - 入力は種類・サイズ・形式を検証してから保存する
 */
import { audit, getUser, HttpError, requireOwner, withPlatform, type AuditEnv, type AuthEnv } from "../platform/worker";

type AppEnv = Env & AuthEnv & AuditEnv;

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const NAME_PATTERN = /^[^\\/\x00-\x1f]{1,255}\.html?$/i;
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

interface ContentRow extends Record<string, unknown> {
  id: string;
  name: string;
  size: number;
  owner_email: string;
  created_at: number;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function toMeta(row: ContentRow, me: string) {
  return {
    id: row.id,
    name: row.name,
    size: row.size,
    createdAt: row.created_at,
    ownerEmail: row.owner_email,
    mine: row.owner_email === me,
  };
}

const bodyKey = (id: string) => `contents/${id}.html`;

async function handle(request: Request, env: AppEnv): Promise<Response> {
  const url = new URL(request.url);
  const method = request.method;
  const user = getUser(request); // ① 基盤が確認済みの利用者

  if (url.pathname === "/api/me" && method === "GET") {
    return json({ email: user.email });
  }

  if (url.pathname === "/api/contents") {
    if (method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT id, name, size, owner_email, created_at FROM contents ORDER BY created_at DESC LIMIT 500",
      ).all<ContentRow>();
      return json(results.map((r) => toMeta(r, user.email)));
    }

    if (method === "POST") {
      if (!request.headers.get("Content-Type")?.startsWith("application/json")) {
        throw new HttpError(415, "JSONで送信してください");
      }
      if (Number(request.headers.get("Content-Length") ?? "0") > MAX_SIZE * 2) {
        throw new HttpError(413, "10MBを超えています");
      }
      let input: { name?: unknown; html?: unknown };
      try {
        input = await request.json();
      } catch {
        throw new HttpError(400, "JSONの形式が正しくありません");
      }
      if (typeof input.name !== "string" || !NAME_PATTERN.test(input.name)) {
        throw new HttpError(400, "ファイル名は .html / .htm で終わる255文字以内にしてください");
      }
      if (typeof input.html !== "string") throw new HttpError(400, "本文がありません");
      const bytes = new TextEncoder().encode(input.html);
      if (bytes.byteLength > MAX_SIZE) throw new HttpError(413, "10MBを超えています");

      const row: ContentRow = {
        id: crypto.randomUUID(),
        name: input.name,
        size: bytes.byteLength,
        owner_email: user.email, // 所有者は getUser() の値（画面からの値は使わない）
        created_at: Date.now(),
      };
      await env.BUCKET.put(bodyKey(row.id), bytes, { httpMetadata: { contentType: "text/html; charset=utf-8" } });
      try {
        await env.DB.prepare("INSERT INTO contents (id, name, size, owner_email, created_at) VALUES (?, ?, ?, ?, ?)")
          .bind(row.id, row.name, row.size, row.owner_email, row.created_at)
          .run();
      } catch (e) {
        await env.BUCKET.delete(bodyKey(row.id)); // メタ情報の保存に失敗したら本文も消す
        throw e;
      }
      await audit(env, user, "upload", row); // ③ 操作履歴は基盤へ
      return json(toMeta(row, user.email), 201);
    }
    throw new HttpError(405, "許可されていない操作です");
  }

  const match = url.pathname.match(/^\/api\/contents\/([^/]+)$/);
  if (match) {
    const id = match[1];
    if (!ID_PATTERN.test(id)) throw new HttpError(404, "見つかりません");

    const row = await env.DB.prepare("SELECT id, name, size, owner_email, created_at FROM contents WHERE id = ?")
      .bind(id)
      .first<ContentRow>();
    if (!row) throw new HttpError(404, "見つかりません");

    if (method === "GET") {
      const obj = await env.BUCKET.get(bodyKey(id));
      if (!obj) throw new HttpError(404, "見つかりません");
      return json({ ...toMeta(row, user.email), html: await obj.text() });
    }

    if (method === "DELETE") {
      try {
        requireOwner(row, user); // ③ 本人以外は 403
      } catch (e) {
        await audit(env, user, "delete_denied", row);
        throw e;
      }
      await env.DB.prepare("DELETE FROM contents WHERE id = ?").bind(id).run();
      await env.BUCKET.delete(bodyKey(id));
      await audit(env, user, "delete", row);
      return new Response(null, { status: 204 });
    }
    throw new HttpError(405, "許可されていない操作です");
  }

  throw new HttpError(404, "見つかりません");
}

// 入口処理（本人確認など）は基盤が受け持つ
export default withPlatform<AppEnv>({ fetch: (request, env) => handle(request, env) });
