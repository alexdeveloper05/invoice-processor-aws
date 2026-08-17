terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

resource "random_id" "bucket_suffix" {
  byte_length = 4
}

resource "aws_s3_bucket" "invoice_warehouse" {
  bucket = "invoice-processor-warehouse-${random_id.bucket_suffix.hex}"
}

resource "aws_s3_bucket_versioning" "invoice_warehouse" {
  bucket = aws_s3_bucket.invoice_warehouse.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_public_access_block" "invoice_warehouse" {
  bucket = aws_s3_bucket.invoice_warehouse.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "invoice_warehouse" {
  bucket = aws_s3_bucket.invoice_warehouse.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Lets the browser PUT a ticket directly to a presigned URL for this bucket.
resource "aws_s3_bucket_cors_configuration" "invoice_warehouse" {
  bucket = aws_s3_bucket.invoice_warehouse.id

  cors_rule {
    allowed_methods = ["PUT"]
    allowed_origins = var.allowed_origins
    allowed_headers = ["*"]
    max_age_seconds = 3000
  }
}
