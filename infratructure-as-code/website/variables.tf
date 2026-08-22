variable "build_dir" {
  description = "Path to the built static site files to upload to S3"
  type        = string
}

variable "runtime_config_json" {
  description = "JSON content uploaded as config.json, fetched by the frontend at runtime"
  type        = string
}

variable "content_security_policy" {
  description = "Content-Security-Policy header value served with every response"
  type        = string
}
