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
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
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

resource "aws_dynamodb_table" "tickets" {
  name         = "invoice-processor-tickets"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "userId"
  range_key    = "ticketId"

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "ticketId"
    type = "S"
  }
}

data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

# --- data-writer: puts the extracted (or failed) result into DynamoDB ---

data "archive_file" "data_writer" {
  type        = "zip"
  source_dir  = "${path.module}/src/data-writer"
  output_path = "${path.module}/dist/data-writer.zip"
}

resource "aws_iam_role" "data_writer" {
  name               = "invoice-processor-data-writer"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

resource "aws_iam_role_policy_attachment" "data_writer_logs" {
  role       = aws_iam_role.data_writer.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_iam_policy_document" "data_writer_permissions" {
  statement {
    actions   = ["dynamodb:PutItem"]
    resources = [aws_dynamodb_table.tickets.arn]
  }
}

resource "aws_iam_role_policy" "data_writer_permissions" {
  name   = "invoice-processor-data-writer-permissions"
  role   = aws_iam_role.data_writer.id
  policy = data.aws_iam_policy_document.data_writer_permissions.json
}

resource "aws_lambda_function" "data_writer" {
  function_name    = "invoice-processor-data-writer"
  role             = aws_iam_role.data_writer.arn
  handler          = "handler.handler"
  runtime          = "python3.12"
  timeout          = 10
  memory_size      = 128
  filename         = data.archive_file.data_writer.output_path
  source_code_hash = data.archive_file.data_writer.output_base64sha256

  environment {
    variables = {
      TICKETS_TABLE_NAME = aws_dynamodb_table.tickets.name
    }
  }
}

# --- Textract async pipeline ---
#
# AnalyzeExpense (synchronous) only supports single-page documents, so multi-page
# PDFs need the asynchronous StartExpenseAnalysis/GetExpenseAnalysis pair instead:
# textract-caller starts the job, Textract notifies an SNS topic when it's done,
# and textract-result-handler (subscribed to that topic) fetches the result and
# hands it off to data-writer. This path also covers plain single-page images.

resource "aws_sns_topic" "textract_notifications" {
  name = "invoice-processor-textract-notifications"
}

data "aws_iam_policy_document" "textract_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["textract.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "textract_sns_publish" {
  name               = "invoice-processor-textract-sns-publish"
  assume_role_policy = data.aws_iam_policy_document.textract_assume_role.json
}

data "aws_iam_policy_document" "textract_sns_publish" {
  statement {
    actions   = ["sns:Publish"]
    resources = [aws_sns_topic.textract_notifications.arn]
  }
}

resource "aws_iam_role_policy" "textract_sns_publish" {
  name   = "invoice-processor-textract-sns-publish"
  role   = aws_iam_role.textract_sns_publish.id
  policy = data.aws_iam_policy_document.textract_sns_publish.json
}

# --- textract-caller: triggered by S3 upload, starts the async Textract job ---

data "archive_file" "textract_caller" {
  type        = "zip"
  source_dir  = "${path.module}/src/textract-caller"
  output_path = "${path.module}/dist/textract-caller.zip"
}

resource "aws_iam_role" "textract_caller" {
  name               = "invoice-processor-textract-caller"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

resource "aws_iam_role_policy_attachment" "textract_caller_logs" {
  role       = aws_iam_role.textract_caller.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_iam_policy_document" "textract_caller_permissions" {
  statement {
    # Textract actions don't support resource-level ARNs.
    actions   = ["textract:StartExpenseAnalysis"]
    resources = ["*"]
  }

  statement {
    # Required to hand the SNS-publish role off to Textract in StartExpenseAnalysis.
    actions   = ["iam:PassRole"]
    resources = [aws_iam_role.textract_sns_publish.arn]
  }

  statement {
    # Only used to report a ticket as FAILED if starting the job itself errors out.
    actions   = ["lambda:InvokeFunction"]
    resources = [aws_lambda_function.data_writer.arn]
  }
}

resource "aws_iam_role_policy" "textract_caller_permissions" {
  name   = "invoice-processor-textract-caller-permissions"
  role   = aws_iam_role.textract_caller.id
  policy = data.aws_iam_policy_document.textract_caller_permissions.json
}

resource "aws_lambda_function" "textract_caller" {
  function_name    = "invoice-processor-textract-caller"
  role             = aws_iam_role.textract_caller.arn
  handler          = "handler.handler"
  runtime          = "python3.12"
  timeout          = 30
  memory_size      = 256
  filename         = data.archive_file.textract_caller.output_path
  source_code_hash = data.archive_file.textract_caller.output_base64sha256

  environment {
    variables = {
      DATA_WRITER_FUNCTION_NAME = aws_lambda_function.data_writer.function_name
      TEXTRACT_SNS_TOPIC_ARN    = aws_sns_topic.textract_notifications.arn
      TEXTRACT_SNS_ROLE_ARN     = aws_iam_role.textract_sns_publish.arn
    }
  }
}

resource "aws_lambda_permission" "s3_invoke_textract_caller" {
  statement_id  = "AllowS3Invoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.textract_caller.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.invoice_warehouse.arn
}

resource "aws_s3_bucket_notification" "invoice_warehouse" {
  bucket = aws_s3_bucket.invoice_warehouse.id

  lambda_function {
    lambda_function_arn = aws_lambda_function.textract_caller.arn
    events              = ["s3:ObjectCreated:*"]
  }

  depends_on = [aws_lambda_permission.s3_invoke_textract_caller]
}

# --- textract-result-handler: triggered by SNS once the async job finishes ---

data "archive_file" "textract_result_handler" {
  type        = "zip"
  source_dir  = "${path.module}/src/textract-result-handler"
  output_path = "${path.module}/dist/textract-result-handler.zip"
}

resource "aws_iam_role" "textract_result_handler" {
  name               = "invoice-processor-textract-result-handler"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

resource "aws_iam_role_policy_attachment" "textract_result_handler_logs" {
  role       = aws_iam_role.textract_result_handler.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_iam_policy_document" "textract_result_handler_permissions" {
  statement {
    actions   = ["textract:GetExpenseAnalysis"]
    resources = ["*"]
  }

  statement {
    actions   = ["lambda:InvokeFunction"]
    resources = [aws_lambda_function.data_writer.arn]
  }
}

resource "aws_iam_role_policy" "textract_result_handler_permissions" {
  name   = "invoice-processor-textract-result-handler-permissions"
  role   = aws_iam_role.textract_result_handler.id
  policy = data.aws_iam_policy_document.textract_result_handler_permissions.json
}

resource "aws_lambda_function" "textract_result_handler" {
  function_name    = "invoice-processor-textract-result-handler"
  role             = aws_iam_role.textract_result_handler.arn
  handler          = "handler.handler"
  runtime          = "python3.12"
  timeout          = 30
  memory_size      = 256
  filename         = data.archive_file.textract_result_handler.output_path
  source_code_hash = data.archive_file.textract_result_handler.output_base64sha256

  environment {
    variables = {
      DATA_WRITER_FUNCTION_NAME = aws_lambda_function.data_writer.function_name
    }
  }
}

resource "aws_lambda_permission" "sns_invoke_textract_result_handler" {
  statement_id  = "AllowSNSInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.textract_result_handler.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.textract_notifications.arn
}

resource "aws_sns_topic_subscription" "textract_result_handler" {
  topic_arn = aws_sns_topic.textract_notifications.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.textract_result_handler.arn
}
