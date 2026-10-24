output "access_aud" {
  description = "全Worker保護用AccessアプリケーションのAUDタグ"
  value       = cloudflare_zero_trust_access_application.all_workers.aud
}
