# ===========================================
# HISAB - AWS INFRASTRUCTURE
# ===========================================
# This Terraform config creates:
# - S3 bucket for frontend
# - CloudFront distribution
# - Lambda function for backend
# - API Gateway
# - DynamoDB tables
# - IAM roles and policies
#
# Usage:
#   cd deployment/terraform
#   terraform init
#   terraform plan
#   terraform apply
# ===========================================

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  required_version = ">= 1.0"
}

# ===========================================
# VARIABLES
# ===========================================

variable "aws_region" {
  description = "AWS region"
  default     = "ap-south-1"  # Mumbai
}

variable "app_name" {
  description = "Application name"
  default     = "hisab"
}

variable "domain_name" {
  description = "Domain name for the app"
  default     = "hisab.paritoshagarwal.com"
}

variable "environment" {
  description = "Environment (dev/staging/prod)"
  default     = "prod"
}

# ===========================================
# PROVIDER
# ===========================================

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Application = var.app_name
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# ===========================================
# S3 BUCKET FOR FRONTEND
# ===========================================

resource "aws_s3_bucket" "frontend" {
  bucket = "${var.app_name}-frontend-${var.environment}"
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_website_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "index.html"  # SPA routing
  }
}

# ===========================================
# CLOUDFRONT DISTRIBUTION
# ===========================================

resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "${var.app_name}-frontend-oac"
  description                       = "OAC for ${var.app_name} frontend"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  price_class         = "PriceClass_200"  # US, Europe, Asia (cheaper)
  
  # S3 origin
  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = "S3-${var.app_name}-frontend"
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  # API Gateway origin
  origin {
    domain_name = replace(aws_apigatewayv2_api.api.api_endpoint, "https://", "")
    origin_id   = "API-${var.app_name}"
    
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # Default behavior - serve frontend
  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${var.app_name}-frontend"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 86400
    max_ttl                = 31536000
    compress               = true
  }

  # API behavior - forward to Lambda
  ordered_cache_behavior {
    path_pattern     = "/api/*"
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "API-${var.app_name}"

    forwarded_values {
      query_string = true
      headers      = ["Authorization", "Content-Type"]
      cookies {
        forward = "all"
      }
    }

    viewer_protocol_policy = "https-only"
    min_ttl                = 0
    default_ttl            = 0
    max_ttl                = 0
  }

  # SPA routing - return index.html for 404
  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
    # For custom domain, use ACM certificate:
    # acm_certificate_arn = aws_acm_certificate.cert.arn
    # ssl_support_method  = "sni-only"
  }
}

# S3 bucket policy for CloudFront access
resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.frontend.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.frontend.arn
          }
        }
      }
    ]
  })
}

# ===========================================
# DYNAMODB TABLES
# ===========================================

locals {
  table_prefix = "${var.app_name}_"
}

resource "aws_dynamodb_table" "users" {
  name         = "${local.table_prefix}users"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "user_id"

  attribute {
    name = "user_id"
    type = "S"
  }

  attribute {
    name = "email"
    type = "S"
  }

  global_secondary_index {
    name            = "email-index"
    hash_key        = "email"
    projection_type = "ALL"
  }
}

resource "aws_dynamodb_table" "groups" {
  name         = "${local.table_prefix}groups"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "group_id"

  attribute {
    name = "group_id"
    type = "S"
  }

  attribute {
    name = "created_by_id"
    type = "S"
  }

  global_secondary_index {
    name            = "created_by-index"
    hash_key        = "created_by_id"
    projection_type = "ALL"
  }
}

resource "aws_dynamodb_table" "group_members" {
  name         = "${local.table_prefix}group_members"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "group_id"
  range_key    = "user_id"

  attribute {
    name = "group_id"
    type = "S"
  }

  attribute {
    name = "user_id"
    type = "S"
  }

  global_secondary_index {
    name            = "user_id-index"
    hash_key        = "user_id"
    projection_type = "ALL"
  }
}

resource "aws_dynamodb_table" "expenses" {
  name         = "${local.table_prefix}expenses"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "expense_id"

  attribute {
    name = "expense_id"
    type = "S"
  }

  attribute {
    name = "group_id"
    type = "S"
  }

  attribute {
    name = "paid_by_id"
    type = "S"
  }

  global_secondary_index {
    name            = "group_id-index"
    hash_key        = "group_id"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "paid_by-index"
    hash_key        = "paid_by_id"
    projection_type = "ALL"
  }
}

resource "aws_dynamodb_table" "expense_splits" {
  name         = "${local.table_prefix}expense_splits"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "expense_id"
  range_key    = "user_id"

  attribute {
    name = "expense_id"
    type = "S"
  }

  attribute {
    name = "user_id"
    type = "S"
  }

  global_secondary_index {
    name            = "user_id-index"
    hash_key        = "user_id"
    projection_type = "ALL"
  }
}

resource "aws_dynamodb_table" "settlements" {
  name         = "${local.table_prefix}settlements"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "settlement_id"

  attribute {
    name = "settlement_id"
    type = "S"
  }

  attribute {
    name = "group_id"
    type = "S"
  }

  attribute {
    name = "from_user_id"
    type = "S"
  }

  attribute {
    name = "to_user_id"
    type = "S"
  }

  global_secondary_index {
    name            = "group_id-index"
    hash_key        = "group_id"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "from_user-index"
    hash_key        = "from_user_id"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "to_user-index"
    hash_key        = "to_user_id"
    projection_type = "ALL"
  }
}

resource "aws_dynamodb_table" "notifications" {
  name         = "${local.table_prefix}notifications"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "user_id"
  range_key    = "notification_id"

  attribute {
    name = "user_id"
    type = "S"
  }

  attribute {
    name = "notification_id"
    type = "S"
  }
}

# ===========================================
# LAMBDA FUNCTION
# ===========================================

resource "aws_iam_role" "lambda" {
  name = "${var.app_name}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "lambda_dynamodb" {
  name = "${var.app_name}-lambda-dynamodb"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:BatchWriteItem",
          "dynamodb:BatchGetItem"
        ]
        Resource = [
          aws_dynamodb_table.users.arn,
          "${aws_dynamodb_table.users.arn}/index/*",
          aws_dynamodb_table.groups.arn,
          "${aws_dynamodb_table.groups.arn}/index/*",
          aws_dynamodb_table.group_members.arn,
          "${aws_dynamodb_table.group_members.arn}/index/*",
          aws_dynamodb_table.expenses.arn,
          "${aws_dynamodb_table.expenses.arn}/index/*",
          aws_dynamodb_table.expense_splits.arn,
          "${aws_dynamodb_table.expense_splits.arn}/index/*",
          aws_dynamodb_table.settlements.arn,
          "${aws_dynamodb_table.settlements.arn}/index/*",
          aws_dynamodb_table.notifications.arn,
          "${aws_dynamodb_table.notifications.arn}/index/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

resource "aws_lambda_function" "api" {
  filename         = "../lambda_deployment.zip"
  function_name    = "${var.app_name}-api"
  role             = aws_iam_role.lambda.arn
  handler          = "lambda_handler.handler"
  runtime          = "python3.11"
  timeout          = 30
  memory_size      = 256

  environment {
    variables = {
      DATABASE_TYPE          = "dynamodb"
      AWS_REGION            = var.aws_region
      DYNAMODB_TABLE_PREFIX = local.table_prefix
      APP_NAME              = var.app_name
      DEBUG                 = "false"
      # Set these manually in AWS Console for security:
      # SECRET_KEY
      # OPENAI_API_KEY
    }
  }

  depends_on = [aws_iam_role_policy.lambda_dynamodb]
}

# ===========================================
# API GATEWAY
# ===========================================

resource "aws_apigatewayv2_api" "api" {
  name          = "${var.app_name}-api"
  protocol_type = "HTTP"
  
  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["*"]
    allow_headers = ["*"]
  }
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id           = aws_apigatewayv2_api.api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.api.invoke_arn
}

resource "aws_apigatewayv2_route" "default" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}

# ===========================================
# OUTPUTS
# ===========================================

output "frontend_bucket" {
  value = aws_s3_bucket.frontend.id
}

output "cloudfront_domain" {
  value = aws_cloudfront_distribution.frontend.domain_name
}

output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.frontend.id
}

output "api_endpoint" {
  value = aws_apigatewayv2_api.api.api_endpoint
}

output "lambda_function_name" {
  value = aws_lambda_function.api.function_name
}

