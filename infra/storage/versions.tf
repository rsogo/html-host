terraform {
  required_version = ">= 1.9"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
  }
}

# 認証は環境変数 CLOUDFLARE_API_TOKEN で渡す（tfvarsやコードに書かない）
provider "cloudflare" {}
