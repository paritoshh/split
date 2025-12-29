# Hisab - AWS Deployment Guide

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐
│   CloudFront    │────▶│   S3 Bucket     │
│   (CDN + SSL)   │     │   (Frontend)    │
└────────┬────────┘     └─────────────────┘
         │
         │ /api/*
         ▼
┌─────────────────┐     ┌─────────────────┐
│   API Gateway   │────▶│     Lambda      │
│   (HTTP API)    │     │   (FastAPI)     │
└─────────────────┘     └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │    DynamoDB     │
                        │   (Database)    │
                        └─────────────────┘
```

## Cost Estimate (Monthly)

| Service | Free Tier | Estimated Cost |
|---------|-----------|----------------|
| S3 | 5GB storage | ~$0.02 |
| CloudFront | 1TB transfer | ~$0.08 |
| Lambda | 1M requests | ~$0.00 (free tier) |
| API Gateway | 1M requests | ~$0.00 (free tier) |
| DynamoDB | 25GB storage, 25 WCU/RCU | ~$0.00 (free tier) |
| **Total** | | **~$0.10 - $1.00/month** |

## Prerequisites

1. **AWS Account** with administrator access
2. **AWS CLI** installed and configured
3. **Terraform** installed (optional, for infrastructure)
4. **Docker** for local DynamoDB testing

## Quick Start

### 1. Test Locally with DynamoDB

```bash
# Start local DynamoDB
cd /path/to/split
docker-compose up -d

# Configure backend for DynamoDB
cd backend
cp env.dynamodb.local.example .env

# Initialize tables
python scripts/init_dynamodb.py

# Start backend
uvicorn app.main:app --reload

# View tables at http://localhost:8001
```

### 2. Deploy with Terraform

```bash
# Navigate to terraform directory
cd deployment/terraform

# Initialize Terraform
terraform init

# Preview changes
terraform plan

# Apply (creates all AWS resources)
terraform apply

# Note the outputs (CloudFront domain, API endpoint, etc.)
```

### 3. Deploy Frontend

```bash
# Update S3 bucket name and CloudFront ID in script
vi deployment/deploy-frontend.sh

# Deploy
./deployment/deploy-frontend.sh
```

### 4. Deploy Backend

```bash
# Deploy Lambda
./deployment/deploy-lambda.sh

# Set environment variables in AWS Console:
# - SECRET_KEY (generate a secure random string)
# - OPENAI_API_KEY (optional, for AI features)
```

## Manual Deployment Steps

### Step 1: Create S3 Bucket

```bash
# Create bucket
aws s3 mb s3://hisab-frontend --region ap-south-1

# Enable static website hosting
aws s3 website s3://hisab-frontend \
    --index-document index.html \
    --error-document index.html
```

### Step 2: Create CloudFront Distribution

Use AWS Console to create a CloudFront distribution:
1. Origin: S3 bucket
2. Enable Origin Access Control (OAC)
3. Default root object: index.html
4. Custom error response: 404 → 200, /index.html (for SPA routing)

### Step 3: Create DynamoDB Tables

```bash
# Run the init script or use Terraform
python backend/scripts/init_dynamodb.py
```

### Step 4: Create Lambda Function

1. Go to AWS Lambda Console
2. Create function → "Author from scratch"
3. Runtime: Python 3.11
4. Handler: `lambda_handler.handler`
5. Upload the deployment zip

### Step 5: Create API Gateway

1. Create HTTP API
2. Add Lambda integration
3. Deploy to stage

### Step 6: Configure Custom Domain (Optional)

1. Create SSL certificate in ACM (us-east-1 for CloudFront)
2. Add alternate domain name in CloudFront
3. Create Route 53 records pointing to CloudFront

## Environment Variables

### Lambda Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_TYPE` | `dynamodb` | Yes |
| `AWS_REGION` | `ap-south-1` | Yes |
| `DYNAMODB_TABLE_PREFIX` | `hisab_` | Yes |
| `SECRET_KEY` | JWT signing key | Yes |
| `OPENAI_API_KEY` | For AI features | No |
| `DEBUG` | `false` for production | Yes |

### Frontend Environment Variables

Update `frontend/src/services/api.js`:
```javascript
const API_BASE_URL = 'https://your-cloudfront-domain.cloudfront.net';
```

Or use environment variables during build:
```bash
VITE_API_URL=https://api.paritoshagarwal.com npm run build
```

## Troubleshooting

### Lambda Timeout
- Increase timeout to 30 seconds
- Check CloudWatch logs for errors

### CORS Issues
- Verify API Gateway CORS configuration
- Check CloudFront cache behaviors

### DynamoDB Errors
- Verify IAM role has DynamoDB permissions
- Check table names match prefix

### Cold Starts
Lambda cold starts may take 1-3 seconds. For better performance:
- Use Provisioned Concurrency (adds cost)
- Keep Lambda warm with scheduled events

## Security Checklist

- [ ] Change `SECRET_KEY` from default
- [ ] Enable CloudFront HTTPS only
- [ ] Use AWS Secrets Manager for sensitive values
- [ ] Enable DynamoDB encryption at rest
- [ ] Set up AWS WAF for API Gateway
- [ ] Enable CloudTrail logging

## Monitoring

1. **CloudWatch Logs**: Lambda logs
2. **CloudWatch Metrics**: API Gateway, Lambda, DynamoDB
3. **X-Ray**: Distributed tracing (optional)

## Cleanup

To remove all resources:

```bash
# Using Terraform
cd deployment/terraform
terraform destroy

# Or manually
aws s3 rb s3://hisab-frontend --force
# Delete CloudFront, Lambda, API Gateway, DynamoDB from console
```

