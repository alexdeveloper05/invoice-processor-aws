variable "allowed_origins" {
  description = "Origins allowed to call the API from a browser"
  type        = list(string)
  default     = ["*"]
}

variable "cognito_client_id" {
  description = "Cognito user pool client ID used as the JWT audience"
  type        = string
}

variable "cognito_issuer_url" {
  description = "Cognito user pool issuer URL used to validate JWTs"
  type        = string
}

variable "presigned_url_lambda_invoke_arn" {
  description = "Invoke ARN of the presigned-url Lambda"
  type        = string
}

variable "presigned_url_lambda_function_name" {
  description = "Function name of the presigned-url Lambda"
  type        = string
}
