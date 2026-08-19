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

output "reader_function_name" {
  value = aws_lambda_function.reader.function_name
}

output "reader_invoke_arn" {
  value = aws_lambda_function.reader.invoke_arn
}
