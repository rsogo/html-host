terraform {
  required_version = ">= 1.9" # validation で他の変数を参照するため

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0" # v5系（v4とはリソース名・書式が異なる）
    }
  }
}

# 認証は環境変数 CLOUDFLARE_API_TOKEN で渡す（tfvarsやコードに書かない）
provider "cloudflare" {}
