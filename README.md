# HTML Host（プロトタイプ）

HTMLファイルをアップロードし、一覧から選んで表示する社内共有ツール。Cloudflare Workers で公開中。
保存先は D1（一覧）と R2（HTML本体）。社内のログインした人全員が閲覧でき、削除はアップロードした本人だけ。

## 使い方
```
npm install
npm run dev      # 開発サーバー
npm run build    # dist/ に静的ファイルを出力
npm run deploy   # ビルドして Cloudflare Workers へ手動デプロイ（要 wrangler login）
```

## デプロイ（Cloudflare Workers 静的アセット）
- `main` への push（または Actions の手動実行）で GitHub Actions が `dist/` をデプロイする
  （[.github/workflows/deploy.yml](.github/workflows/deploy.yml)、設定は [wrangler.jsonc](wrangler.jsonc)）
- PR ではビルド（型チェック含む）の検証のみ
- 公開URL: https://html-host.ryohei-sogo.workers.dev
- 手動実行: `gh workflow run deploy.yml && gh run watch`
- ローカルから `npm run deploy` する場合は Node 22 以上が必要（wrangler の要件。[.nvmrc](.nvmrc)）

### GitHub Secrets
| 名前 | 内容 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API トークン（テンプレート「Edit Cloudflare Workers」、Account Resources は自アカウントのみ） |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare のアカウントID（32桁） |

- 値はリポジトリ単位で暗号化保存され、後から参照できない。確認は `gh secret list`（名前のみ）
- トークンを作り直したとき（TTL 切れ・漏洩時など）は再登録: `gh secret set CLOUDFLARE_API_TOKEN`
- トークンに IP 制限は付けない（GitHub Actions の IP は不定）

### 再セットアップ手順（別アカウント・リポジトリ移行時）
1. Cloudflare ダッシュボード → My Profile → API Tokens → テンプレート「Edit Cloudflare Workers」でトークンを作成
2. アカウントID を控える（ダッシュボード URL `dash.cloudflare.com/<ID>/...`、または Workers & Pages 画面右側）
3. `gh secret set CLOUDFLARE_API_TOKEN` / `gh secret set CLOUDFLARE_ACCOUNT_ID` で登録
4. `gh workflow run deploy.yml` で実行（Worker は初回デプロイ時に自動作成される）

## 構成
「基盤から渡すもの」と「アプリ」をディレクトリで分けている。アプリ側は `platform/` を編集しない。
```
platform/                基盤から渡すもの（詳細は platform/README.md）
  worker/
    index.ts             アプリが使う公開API: withPlatform / getUser / requireOwner / HttpError
    gateway.ts           入口処理（JWT検証 → 確認済みの利用者情報をヘッダーでアプリへ）
    auth.ts              Cloudflare Access の JWT 検証
    user.ts guard.ts
worker/                  アプリ: API（index.ts）
migrations/              アプリ: テーブル（自由に設計）
src/                     アプリ: 画面
  repository/            保存先の抽象化（CloudRepository = API経由 / IndexedDbRepository = ブラウザ内のみの旧実装）
  hooks/ components/
infra/access/            Cloudflare Access（Terraform。環境ごとに1回）
infra/storage/           アプリのDB・ファイル置き場（Terraform。アプリごと）
```

## 仕様メモ
- 同名ファイルは上書きせず別コンテンツとして追加
- 表示は `<iframe sandbox="allow-scripts ..." srcdoc>`。**allow-same-origin は付けない**
  （付けるとアップロードHTMLのJSが本体のIndexedDBや親DOMに触れられる）
- 相対パスの外部リソース（画像・CSS）は解決されない。単一ファイルHTML前提
- データはブラウザ（オリジン）ごと。別ブラウザ・別端末とは共有されない

## DB版（D1 + R2）
### 安全のための設計
| よくある事故 | この構成での対策 |
|---|---|
| DB の接続キーが画面側のコードに入っている | DB の鍵は存在しない。D1 / R2 には Worker の binding からしか触れない |
| 認証なしで API を叩ける | Access の前段チェックに加え、基盤の入口処理で JWT（`Cf-Access-Jwt-Assertion`）を署名・発行元・AUD・期限まで検証（[platform/worker/auth.ts](platform/worker/auth.ts)） |
| 他人のデータを消せる | 所有者は JWT のメールアドレスでサーバー側が決める。画面から送られた所有者情報は無視。削除は所有者本人のみ（他人の削除は 403） |
| SQL インジェクション | SQL はすべてプレースホルダ（`bind`）で組み立てる |
| 想定外のファイル | 拡張子 .html/.htm、10MB まで、ファイル名にパス区切り不可 |
| 他サイトからのなりすまし送信 | 書き込みは同一オリジン・JSON のみ受け付ける |

静的アセットのみの Worker では Access のログイン情報（`ctx.access`）が渡らないため、JWT を自前で検証している。

### API
| メソッド | パス | 内容 |
|---|---|---|
| GET | `/api/me` | ログイン中のユーザー |
| GET | `/api/contents` | 一覧（全員） |
| GET | `/api/contents/:id` | 本文（全員） |
| POST | `/api/contents` | アップロード（JSON: `name`, `html`） |
| DELETE | `/api/contents/:id` | 削除（所有者のみ） |

### 初回セットアップ（1回だけ。Mac で実行）
0. **R2 を有効化する（アカウントで初回のみ・画面操作）**: ダッシュボード左メニュー **R2 Object Storage** → **Add R2 subscription to my account**。
   有効化しないと Terraform で R2 バケットを作れない（無料枠あり。超過分は従量課金。支払い情報の登録を求められる場合あり）
1. DB とファイル置き場を Terraform で作る（保存場所はアジア太平洋）
   ```
   cd infra/storage
   cp terraform.tfvars.example terraform.tfvars   # account_id を記入
   terraform init && terraform plan && terraform apply
   terraform output -raw d1_database_id           # → wrangler.jsonc の database_id に記入
   ```
   API トークンには infra/access の権限に加えて **D1: Edit** と **Workers R2 Storage: Edit** が必要
2. Access の AUD を確認して記入
   ```
   cd ../access && terraform output -raw access_aud   # → wrangler.jsonc の POLICY_AUD に記入
   ```
3. テーブルを作る（マイグレーション。Terraform ではなく wrangler で行う）
   ```
   cd ../..
   npx wrangler login
   npm run db:migrate:remote
   ```
- `TEAM_DOMAIN` は Zero Trust のチーム名に合わせる（`https://<チーム名>.cloudflareaccess.com`）
- `database_id` と `POLICY_AUD` は秘密情報ではないので、`wrangler.jsonc` に書いてコミットしてよい
- GitHub Actions のデプロイ用トークン（`CLOUDFLARE_API_TOKEN`）に **D1: Edit** を追加する（R2 の権限がない場合は **Workers R2 Storage: Edit** も）。デプロイ時にマイグレーションも自動で適用される

### ローカル開発
```
cp .dev.vars.example .dev.vars   # DEV_USER_EMAIL に自分のメールアドレス
npm run db:migrate:local
npm run dev:worker               # http://localhost:8787
```
`wrangler dev` は Access を通らないため、localhost のときだけ `DEV_USER_EMAIL` のユーザーとして動く（本番では無視される）。

### 検証結果（ローカル、2026-10-24）
| 確認内容 | 結果 |
|---|---|
| ログインなしで API | 401 |
| 偽造した JWT（別の鍵で署名）／ 別アプリ向け（AUD違い）／ 発行元違い ／ 期限切れ ／ 署名なし（alg:none） | すべて 401 |
| 他人のコンテンツの閲覧 | 200（仕様どおり全員閲覧可） |
| 他人のコンテンツの削除 | 403 |
| 所有者を偽装してアップロード | 無視され、所有者は本人 |
| 利用者情報のヘッダー（`X-Platform-User-Email`）を偽装 | 入口で消され、確認済みの本人に置き換わる |
| ID に SQL インジェクション | 404 |
| ファイル名に SQL インジェクション | 文字列として保存され、テーブルは無事 |
| 10MB 超 ／ .js ／ `../` を含む名前 | 413 ／ 400 ／ 400 |
| 他サイトからの POST ／ フォーム送信 | 403 ／ 415 |

## アクセス制限（Cloudflare Access）
アカウント内の**すべてのWorker**（既存・今後作るものとも、本番URL・プレビューURLとも）を Cloudflare Access で保護し、
許可したメールアドレスの人だけが開けるようにする。アプリごとの設定は不要。
設定は Terraform（[infra/access](infra/access)）で管理する。画面での手順は確認・代替用として併記する。

> 画面と Terraform の**どちらか一方**で設定すること。両方で作ると Access アプリケーションが二重になる。
> 画面で先に作った場合は、画面側を削除してから `terraform apply` する。

### 前提: Zero Trust の組織を作る（初回のみ・画面操作）
1. Worker の **Access** タブ、または左メニュー **Zero Trust** から **Set up Zero Trust**
2. プランを選ぶ（検証は **Free**。50ユーザーまで）
3. チーム名は自動で付与される（ログイン画面のURL `https://<チーム名>.cloudflareaccess.com`）。本番前に社名などへ変更しておく
4. 初期状態のログイン方法は「Cloudflareアカウントでのログイン」のみ。社員がメールアドレスで入れるよう、Terraform で One-time PIN（メールに届くコード）を追加する

### 方法A（推奨）: Terraform で設定する
1. API トークンを作る（My Profile → API Tokens → Create Custom Token）。権限はアカウント単位で:
   - Access: Apps and Policies — Edit
   - Access: Organizations, Identity Providers, and Groups — Edit（One-time PIN の追加に必要）
   - Workers Scripts — Read（例外の Worker を指定する場合のみ必要）
2. 実行する（Terraform 1.9 以上）
   ```
   brew install hashicorp/tap/terraform
   export CLOUDFLARE_API_TOKEN=...        # デプロイ用トークンとは別に作る
   cd infra/access
   cp terraform.tfvars.example terraform.tfvars   # account_id と許可ドメイン/メールを記入
   terraform init
   terraform plan
   terraform apply
   ```
3. シークレットウィンドウで公開URLを開き、ログイン画面が出ることを確認する
4. 例外として誰でも開けるようにしたい Worker があれば、`public_worker_names` に名前を書いて再度 `apply`

### 方法B: 画面で設定する
1. **Workers & Pages** の一覧にある **Protect all Workers** カードで **Enable Access**
2. 範囲は **All traffic**（本番・プレビュー両方）を選ぶ
3. 認証ポリシーでメールドメイン（例: `ncdc.co.jp`）を指定して **Apply Access**
4. Zero Trust → Settings → Authentication → Login methods で **One-time PIN** を追加する
5. 方法Aの手順3と同じく確認する

### 補足
- state はローカル（`infra/access/terraform.tfstate`）。コミットしない（`.gitignore` 済み）
- WebSocket を使う Worker は、この方式（Worker単位・アカウント単位の Access）だと 403 になる。その場合はホスト名単位の Access アプリを別途作る
- 静的アセットのみの Worker では、ログインした人の情報（`ctx.access`）をアプリ側で受け取れない（保護自体はかかる）
- 参考: https://developers.cloudflare.com/workers/configuration/cloudflare-access/
