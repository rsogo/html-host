# HTML Host（プロトタイプ）

HTMLファイルをアップロードし、一覧から選んで表示する。サーバー不要（静的ファイルのみ）。Cloudflare Workers で公開中。

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
```
src/
  repository/            保存先の抽象化
    types.ts             ContentRepository インターフェース
    indexedDbRepository.ts  現行実装（IndexedDB。meta と body を別ストアに分離）
    index.ts             ← クラウド化時はここで CloudRepository に差し替え
  hooks/
    useContents.ts       一覧取得・アップロード・削除
    useHashRoute.ts      #/view/<id> による選択状態
  components/
    UploadArea.tsx       ファイル選択 / D&D（.html/.htm、10MBまで、複数可）
    ContentList.tsx      一覧（名称・日時・サイズ・削除）
    Viewer.tsx           sandbox iframe で表示
```

## 仕様メモ
- 同名ファイルは上書きせず別コンテンツとして追加
- 表示は `<iframe sandbox="allow-scripts ..." srcdoc>`。**allow-same-origin は付けない**
  （付けるとアップロードHTMLのJSが本体のIndexedDBや親DOMに触れられる）
- 相対パスの外部リソース（画像・CSS）は解決されない。単一ファイルHTML前提
- データはブラウザ（オリジン）ごと。別ブラウザ・別端末とは共有されない

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
