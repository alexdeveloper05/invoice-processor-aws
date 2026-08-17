variable "allowed_origins" {
  description = "Origins allowed to upload directly to the invoice warehouse bucket via presigned URLs"
  type        = list(string)
  default     = ["https://*.cloudfront.net", "http://localhost:3000"]
}
