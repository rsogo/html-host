# platform/ — 基盤から渡すもの

**アプリ開発者（利用者・AI）は、このディレクトリを編集しない。** 基盤側が提供・更新する部品。

| 渡すもの | 中身 | アプリからの使い方 |
|---|---|---|
| ① 確認済みの利用者情報 | メールアドレス（入口で JWT を検証した結果） | `getUser(request)` |
| ② 資源のつなぎ口 | D1（`env.DB`）・R2（`env.BUCKET`）の binding。鍵は存在しない | `env.DB.prepare(...).bind(...)` |
| ③ 共通部品 | 所有者チェック、操作履歴の記録、エラー応答 | `requireOwner()`, `audit()`, `HttpError` |
| 入口処理 | 本人確認、なりすまし送信の拒否、エラー時に内部情報を返さない | `withPlatform(app)` でアプリを包む |

## ファイル
| ファイル | 役割 |
|---|---|
| `worker/index.ts` | アプリから使う公開 API（ここ以外は直接 import しない） |
| `worker/gateway.ts` | 入口処理。JWT を検証し、確認済みの利用者情報をヘッダーに載せてアプリへ渡す |
| `worker/auth.ts` | Cloudflare Access の JWT 検証 |
| `worker/user.ts` | `getUser()` |
| `worker/guard.ts` | `requireOwner()`, `HttpError` |
| `worker/audit.ts` | `audit()`。操作履歴は基盤側の DB（`PLATFORM_DB`）に書く。アプリの DB には置かない |
| `migrations/` | 基盤側 DB のテーブル（操作履歴） |

## 本番の基盤との対応
このプロトタイプでは基盤の部品がアプリと同じ Worker に同梱されているが、本番の基盤（Workers for Platforms）では:
- 入口処理（`gateway.ts` / `auth.ts`）は振り分け役の Worker（dispatch Worker）で動き、アプリには含まれない
- アプリは振り分け役からしか呼ばれないため、ヘッダーで渡す利用者情報をそのまま信用できる
- 操作履歴は Service Binding 経由で基盤側に送られる
- アプリが使う API（`getUser` / `requireOwner` / `audit`）は同じなので、アプリのコードは変わらない
