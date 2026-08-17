variable "warehouse_bucket_name" {
  description = "Name of the S3 bucket tickets are uploaded to"
  type        = string
}

variable "warehouse_bucket_arn" {
  description = "ARN of the S3 bucket tickets are uploaded to"
  type        = string
}

variable "url_expiration_seconds" {
  description = "How long a presigned upload URL stays valid"
  type        = number
  default     = 300
}
