variable "account_id" {
  description = "CloudflareのアカウントID（32桁）"
  type        = string
}

variable "app_name" {
  description = "アプリ名（DB名・バケット名の元になる）"
  type        = string
  default     = "html-host"
}

variable "location" {
  description = "データの保存場所（apac = アジア太平洋）"
  type        = string
  default     = "apac"
}
