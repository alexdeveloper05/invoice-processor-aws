terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Values are supplied via -backend-config flags in CI (see .github/workflows/terraform.yml)
  backend "s3" {}
}

# Provider
provider "aws" {
  region = var.aws_region
}

# Website
locals {
  # Only ever built from var.aws_region — deliberately not from any module output,
  # so this can't introduce a dependency cycle with the modules below.
  content_security_policy = join("; ", [
    "default-src 'self'",
    # 'unsafe-inline' is required because Next.js's static export ships a small
    # inline hydration script; there's no per-request nonce to attach to it.
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    join(" ", [
      "connect-src 'self'",
      "https://cognito-idp.${var.aws_region}.amazonaws.com",
      "https://*.execute-api.${var.aws_region}.amazonaws.com",
      "https://*.s3.${var.aws_region}.amazonaws.com",
    ]),
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ])
}

module "website" {
  source    = "./website"
  build_dir = "${path.module}/../frontend/out"

  content_security_policy = local.content_security_policy

  runtime_config_json = jsonencode({
    awsRegion         = var.aws_region
    cognitoUserPoolId = module.auth.user_pool_id
    cognitoClientId   = module.auth.user_pool_client_id
    apiBaseUrl        = module.api-gateway.invoke_url
  })
}

# Auth
module "auth" {
  source = "./auth"
}

# Application
module "application" {
  source = "./application"
}

# Presigned url
module "presigned-url" {
  source = "./presigned-url"

  warehouse_bucket_name = module.application.bucket_name
  warehouse_bucket_arn  = module.application.bucket_arn
}

# Api gateway
module "api-gateway" {
  source = "./api-gateway"

  cognito_client_id                  = module.auth.user_pool_client_id
  cognito_issuer_url                 = module.auth.issuer_url
  presigned_url_lambda_invoke_arn    = module.presigned-url.invoke_arn
  presigned_url_lambda_function_name = module.presigned-url.function_name
  reader_lambda_invoke_arn           = module.application.reader_invoke_arn
  reader_lambda_function_name        = module.application.reader_function_name
}