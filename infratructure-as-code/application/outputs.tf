output "bucket_name" {
  value = aws_s3_bucket.invoice_warehouse.bucket
}

output "bucket_arn" {
  value = aws_s3_bucket.invoice_warehouse.arn
}
