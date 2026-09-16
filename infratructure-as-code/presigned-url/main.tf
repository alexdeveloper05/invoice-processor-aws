terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }
}

data "archive_file" "lambda" {
  type        = "zip"
  source_dir  = "${path.module}/src"
  output_path = "${path.module}/dist/presigned-url.zip"
}

data "aws_iam_policy_document" "assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda" {
  name               = "invoice-processor-presigned-url"
  assume_role_policy = data.aws_iam_policy_document.assume_role.json
}

resource "aws_iam_role_policy_attachment" "lambda_logs" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_iam_policy_document" "s3_write" {
  statement {
    actions   = ["s3:PutObject"]
    resources = ["${var.warehouse_bucket_arn}/*"]
  }
}

resource "aws_iam_role_policy" "s3_write" {
  name   = "invoice-processor-presigned-url-s3-write"
  role   = aws_iam_role.lambda.id
  policy = data.aws_iam_policy_document.s3_write.json
}

resource "aws_lambda_function" "presigned_url" {
  function_name    = "invoice-processor-presigned-url"
  role             = aws_iam_role.lambda.arn
  handler          = "handler.handler"
  runtime          = "python3.12"
  timeout          = 10
  memory_size      = 128
  filename         = data.archive_file.lambda.output_path
  source_code_hash = data.archive_file.lambda.output_base64sha256

  environment {
    variables = {
      WAREHOUSE_BUCKET_NAME  = var.warehouse_bucket_name
      URL_EXPIRATION_SECONDS = tostring(var.url_expiration_seconds)
      USAGE_TABLE_NAME       = aws_dynamodb_table.usage.name
      DAILY_LIMIT            = tostring(var.daily_limit)
    }
  }

resource "aws_cloudwatch_log_group" "presigned_url" {
  name              = "/aws/lambda/${aws_lambda_function.presigned_url.function_name}"
  retention_in_days = 30
}

resource "aws_dynamodb_table" "usage" {
  name         = "invoice-processor-usage"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "userId"
  range_key    = "date"

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "date"
    type = "S"
  }

  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }
}

data "aws_iam_policy_document" "usage_table" {
  statement {
    actions   = ["dynamodb:UpdateItem"]
    resources = [aws_dynamodb_table.usage.arn]
  }
}

resource "aws_iam_role_policy" "usage_table" {
  name   = "invoice-processor-presigned-url-usage"
  role   = aws_iam_role.lambda.id
  policy = data.aws_iam_policy_document.usage_table.json
}
