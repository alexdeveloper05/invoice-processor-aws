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
  source = "./website"
}

# Presigned url
module "presigned-url" {
  source = "./presigned-url"
}

# Application
module "application" {
  source = "./application"
}

# Api gateway
module "api-gateway" {
  source = "./api-gateway"
}