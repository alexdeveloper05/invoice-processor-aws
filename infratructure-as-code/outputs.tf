output "website_url" {
  description = "CloudFront domain serving the static website"
  value       = "https://${module.website.cloudfront_domain_name}"
}

output "api_base_url" {
  description = "Base URL of the API Gateway used by the frontend"
  value       = module.api-gateway.invoke_url
}

output "cognito_user_pool_id" {
  description = "Cognito user pool ID — needed to create users (see infratructure-as-code/README.md)"
  value       = module.auth.user_pool_id
}

output "invoice_warehouse_bucket" {
  description = "S3 bucket where uploaded tickets are stored"
  value       = module.application.bucket_name
}
