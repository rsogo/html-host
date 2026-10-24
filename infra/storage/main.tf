# --------------------------------------------------------------------
# アプリのデータ置き場（DB と ファイル置き場）を作る
#   - D1: 一覧などのデータ（テーブルはアプリ側が migrations/ で定義する）
#   - R2: アップロードされた HTML の本体
#   - 保存場所はアジア太平洋（apac）を指定
# テーブル作成（マイグレーション）は Terraform ではなく wrangler で行う
# --------------------------------------------------------------------

resource "cloudflare_d1_database" "app" {
  account_id            = var.account_id
  name                  = var.app_name
  primary_location_hint = var.location
}

resource "cloudflare_r2_bucket" "contents" {
  account_id = var.account_id
  name       = "${var.app_name}-contents"
  location   = var.location
}
