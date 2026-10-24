import type { PlatformUser } from "./user";

export interface AuditEnv {
  PLATFORM_DB: D1Database; // 基盤側の DB（アプリの DB とは別）
  APP_NAME?: string;
}

/**
 * ③ 操作履歴を基盤側に記録する。アプリの DB には書かないので、アプリ側から消すことはできない。
 * 本番の基盤では Service Binding 経由で基盤の履歴保管に送る。
 */
export async function audit(
  env: AuditEnv,
  user: PlatformUser,
  action: string,
  target?: { id?: string; name?: string },
): Promise<void> {
  await env.PLATFORM_DB.prepare(
    "INSERT INTO audit_log (at, app, actor_email, action, target_id, target_name) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(Date.now(), env.APP_NAME ?? "unknown", user.email, action, target?.id ?? null, target?.name ?? null)
    .run();
}
