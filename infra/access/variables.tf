variable "account_id" {
  description = "CloudflareのアカウントID（32桁）"
  type        = string
}

variable "allowed_email_domains" {
  description = "ログインを許可するメールドメイン（例: [\"ncdc.co.jp\"]）"
  type        = list(string)
  default     = []
}

variable "allowed_emails" {
  description = "ドメインとは別に個別に許可するメールアドレス"
  type        = list(string)
  default     = []

  validation {
    condition     = length(var.allowed_email_domains) + length(var.allowed_emails) > 0
    error_message = "allowed_email_domains か allowed_emails のどちらかは指定してください（空だと誰もログインできません）。"
  }
}

variable "public_worker_names" {
  description = "例外として誰でも開けるようにするWorker名（通常は空のまま）"
  type        = list(string)
  default     = []
}

variable "session_duration" {
  description = "ログインの有効期間"
  type        = string
  default     = "24h"
}
