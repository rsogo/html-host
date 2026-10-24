# wrangler.jsonc の d1_databases[].database_id に書く値
output "d1_database_id" {
  value = cloudflare_d1_database.app.uuid
}

# wrangler.jsonc の r2_buckets[].bucket_name と一致していること
output "r2_bucket_name" {
  value = cloudflare_r2_bucket.contents.name
}
