# --------------------------------------------------------------------
# アカウント内の「すべてのWorker」を Cloudflare Access で保護する
#   - 既存のWorkerも、これから作られるWorkerも自動でログイン必須になる
#     （アプリごとの設定は不要。利用者が新しいアプリを作っても漏れない）
#   - 本番URL・プレビューURLの両方が対象（destination type = all_workers）
#   - 例外として公開したいWorkerは var.public_worker_names に名前を書く
#   - 前提: Zero Trust の組織（チーム名）は作成済み
#   - ログイン方法: One-time PIN（メールに届くコード）を追加する
#     ※ 初期状態のログイン方法は「Cloudflareアカウントでのログイン」のみで、
#        Cloudflareアカウントを持たない利用者はログインできないため
# --------------------------------------------------------------------

# ログイン方法: One-time PIN（IdP連携なしで社員のメールアドレスで入れる。後でGoogle/Entraに差し替え可）
resource "cloudflare_zero_trust_access_identity_provider" "otp" {
  account_id = var.account_id
  name       = "One-time PIN"
  type       = "onetimepin"
  config     = {}
}

# 誰を通すか
resource "cloudflare_zero_trust_access_policy" "allow_members" {
  account_id       = var.account_id
  name             = "all-workers: allow members"
  decision         = "allow"
  session_duration = var.session_duration

  include = concat(
    [for d in var.allowed_email_domains : { email_domain = { domain = d } }],
    [for e in var.allowed_emails : { email = { email = e } }],
  )
}

# 何を守るか: アカウント内の全Worker
resource "cloudflare_zero_trust_access_application" "all_workers" {
  account_id       = var.account_id
  name             = "All Workers"
  type             = "self_hosted"
  session_duration = var.session_duration

  destinations = [
    { type = "all_workers" },
  ]

  # ログイン画面に出す方法を One-time PIN に限定し、選択画面を飛ばす
  allowed_idps              = [cloudflare_zero_trust_access_identity_provider.otp.id]
  auto_redirect_to_identity = true

  policies = [
    { id = cloudflare_zero_trust_access_policy.allow_members.id, precedence = 1 },
  ]
}

# --------------------------------------------------------------------
# 例外: 誰でも開けるようにするWorker（既定は空 = 例外なし）
#   Worker単位の設定はアカウント単位より優先される
# --------------------------------------------------------------------
resource "cloudflare_zero_trust_access_policy" "public" {
  count      = length(var.public_worker_names) > 0 ? 1 : 0
  account_id = var.account_id
  name       = "public workers: bypass"
  decision   = "bypass"
  include    = [{ everyone = {} }]
}

data "cloudflare_worker" "public" {
  for_each   = toset(var.public_worker_names)
  account_id = var.account_id
  worker_id  = each.value
}

resource "cloudflare_zero_trust_access_application" "public" {
  for_each   = toset(var.public_worker_names)
  account_id = var.account_id
  name       = "Public: ${each.value}"
  type       = "self_hosted"

  destinations = [
    { type = "worker", worker_id = data.cloudflare_worker.public[each.value].id },
  ]

  policies = [
    { id = cloudflare_zero_trust_access_policy.public[0].id, precedence = 1 },
  ]
}
