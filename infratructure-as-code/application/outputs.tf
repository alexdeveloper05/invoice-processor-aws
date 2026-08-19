output "bucket_name" {
  value = aws_s3_bucket.invoice_warehouse.bucket
}

output "bucket_arn" {
  value = aws_s3_bucket.invoice_warehouse.arn
}

output "tickets_table_name" {
  value = aws_dynamodb_table.tickets.name
}

output "tickets_table_arn" {
  value = aws_dynamodb_table.tickets.arn
}
