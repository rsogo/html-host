-- アプリのテーブル（アプリ側が自由に設計する）。本文は R2 に保存
CREATE TABLE contents (
  id          TEXT PRIMARY KEY,            -- UUID（サーバー側で採番）
  name        TEXT NOT NULL,               -- 元のファイル名
  size        INTEGER NOT NULL,            -- bytes
  owner_email TEXT NOT NULL,               -- アップロードした人（getUser() の値。画面からの値は使わない）
  created_at  INTEGER NOT NULL             -- epoch ms
);
CREATE INDEX idx_contents_created_at ON contents (created_at DESC);
