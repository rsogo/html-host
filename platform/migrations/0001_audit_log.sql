-- 基盤側の操作履歴。アプリの DB とは別の DB（PLATFORM_DB）に置き、アプリからは消せないようにする
CREATE TABLE audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  at          INTEGER NOT NULL,   -- epoch ms
  app         TEXT NOT NULL,      -- どのアプリの操作か
  actor_email TEXT NOT NULL,      -- 誰が（確認済みの利用者）
  action      TEXT NOT NULL,      -- 何をしたか（upload / delete / delete_denied など）
  target_id   TEXT,
  target_name TEXT
);
CREATE INDEX idx_audit_log_at ON audit_log (at DESC);
