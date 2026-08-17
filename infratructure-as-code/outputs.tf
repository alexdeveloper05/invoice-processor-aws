output "website_url" {
  description = "CloudFront domain serving the static website"
  value       = "https://${module.website.cloudfront_domain_name}"
}
