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
