output "function_name" {
  value = aws_lambda_function.presigned_url.function_name
}

output "invoke_arn" {
  value = aws_lambda_function.presigned_url.invoke_arn
}
