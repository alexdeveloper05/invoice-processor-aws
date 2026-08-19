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
module "website" {
  source    = "./website"
  build_dir = "${path.module}/../frontend/out"

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