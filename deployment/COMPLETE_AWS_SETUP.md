# Complete AWS Deployment Setup Guide

This guide covers deploying the Hisab app to AWS from scratch.

## Architecture Overview

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  CloudFront │────▶│     S3      │     │  DynamoDB   │
│  (Frontend) │     │  (Static)   │     │  (Database) │
└─────────────┘     └─────────────┘     └─────────────┘
                                              ▲
┌─────────────┐     ┌─────────────┐           │
│   Users     │────▶│ API Gateway │────▶┌─────────────┐
│             │     │  (HTTP API) │     │   Lambda    │
└─────────────┘     └─────────────┘     │  (Backend)  │
                                        └─────────────┘
```

## Prerequisites

- AWS Account
- AWS CLI installed and configured
- Docker Desktop (for building Lambda package)
- Node.js (for frontend build)
- Python 3.11+ (for local testing)

---

## STEP 1: AWS CLI Configuration

### 1.1 Create IAM User (if not exists)

1. Go to: https://console.aws.amazon.com/iam/
2. Click "Users" → "Create user"
3. Name: `hisab-admin`
4. Click "Next"
5. Select "Attach policies directly"
6. Attach these policies:
   - `AmazonDynamoDBFullAccess`
   - `AWSLambda_FullAccess`
   - `AmazonAPIGatewayAdministrator`
   - `AmazonS3FullAccess`
   - `CloudFrontFullAccess`
   - `IAMFullAccess` (needed to create Lambda role)
7. Click "Create user"

### 1.2 Create Access Keys

1. Click on the user `hisab-admin`
2. Go to "Security credentials" tab
3. Click "Create access key"
4. Select "Command Line Interface (CLI)"
5. Download or copy the keys

### 1.3 Configure AWS CLI

```powershell
aws configure
# Enter:
# - Access Key ID: <your-access-key>
# - Secret Access Key: <your-secret-key>
# - Default region: ap-south-1
# - Default output format: json
```

### 1.4 Verify CLI

```powershell
aws sts get-caller-identity
```

Expected output:
```json
{
    "UserId": "AIDAXXXXXXXXXX",
    "Account": "294618942342",
    "Arn": "arn:aws:iam::294618942342:user/hisab-admin"
}
```

---

## STEP 2: Create DynamoDB Tables

### 2.1 Create Tables via Console (Recommended)

Go to: https://console.aws.amazon.com/dynamodb/

Create these 7 tables (all with On-demand capacity):

| Table Name | Partition Key | Sort Key | GSI |
|------------|---------------|----------|-----|
| `hisab_users` | `user_id` (String) | - | `email-index` on `email` |
| `hisab_groups` | `group_id` (String) | - | `created_by-index` on `created_by_id` |
| `hisab_group_members` | `group_id` (String) | `user_id` (String) | `user_id-index` on `user_id` |
| `hisab_expenses` | `expense_id` (String) | - | `group_id-index`, `paid_by-index` |
| `hisab_expense_splits` | `expense_id` (String) | `user_id` (String) | `user_id-index` on `user_id` |
| `hisab_settlements` | `settlement_id` (String) | - | `group_id-index`, `from_user-index`, `to_user-index` |
| `hisab_notifications` | `user_id` (String) | `notification_id` (String) | - |

### 2.2 Or Create via Script

```powershell
.\deployment\create-dynamodb-tables.ps1
```

### 2.3 Verify Tables Exist

```powershell
aws dynamodb list-tables --region ap-south-1
```

Expected: Should show all 7 `hisab_*` tables.

---

## STEP 3: Create Lambda Execution Role

### 3.1 Create the Role

1. Go to: https://console.aws.amazon.com/iam/
2. Click "Roles" → "Create role"
3. Select "AWS service" → "Lambda"
4. Click "Next"
5. Attach policy: `AWSLambdaBasicExecutionRole`
6. Click "Next"
7. Role name: `hisab-lambda-role`
8. Click "Create role"

### 3.2 Add DynamoDB Permissions

1. Click on the role `hisab-lambda-role`
2. Click "Add permissions" → "Create inline policy"
3. Click "JSON" tab
4. Paste this policy:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "dynamodb:PutItem",
                "dynamodb:GetItem",
                "dynamodb:UpdateItem",
                "dynamodb:DeleteItem",
                "dynamodb:Query",
                "dynamodb:Scan",
                "dynamodb:BatchGetItem",
                "dynamodb:BatchWriteItem"
            ],
            "Resource": [
                "arn:aws:dynamodb:ap-south-1:294618942342:table/hisab_*",
                "arn:aws:dynamodb:ap-south-1:294618942342:table/hisab_*/index/*"
            ]
        }
    ]
}
```

**IMPORTANT**: Replace `294618942342` with YOUR AWS account ID!

5. Click "Next"
6. Policy name: `HisabDynamoDBAccess`
7. Click "Create policy"

### 3.3 Verify Trust Relationship

1. Click "Trust relationships" tab
2. Should show:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Service": "lambda.amazonaws.com"
            },
            "Action": "sts:AssumeRole"
        }
    ]
}
```

---

## STEP 4: Create Lambda Function

### 4.1 Create Function via Console

1. Go to: https://console.aws.amazon.com/lambda/
2. Click "Create function"
3. Select "Author from scratch"
4. Function name: `hisab-api`
5. Runtime: `Python 3.11`
6. Architecture: `x86_64`
7. Expand "Change default execution role"
8. Select "Use an existing role"
9. Select: `hisab-lambda-role`
10. Click "Create function"

### 4.2 Configure Function Settings

1. Go to "Configuration" tab
2. Click "General configuration" → "Edit"
3. Set:
   - Memory: `256 MB`
   - Timeout: `30 seconds`
4. Click "Save"

### 4.3 Set Environment Variables

1. Go to "Configuration" → "Environment variables"
2. Click "Edit"
3. Add these variables:

| Key | Value |
|-----|-------|
| `DATABASE_TYPE` | `dynamodb` |
| `DYNAMODB_TABLE_PREFIX` | `hisab_` |
| `SECRET_KEY` | `<generate-a-random-string>` |
| `ALLOWED_ORIGINS` | `https://hisab.paritoshagarwal.com,http://localhost:5173` |
| `DEBUG` | `false` |
| `OPENAI_API_KEY` | `<your-openai-key>` (optional) |

**DO NOT ADD**: `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY` (Lambda uses IAM role!)

4. Click "Save"

### 4.4 Deploy Lambda Code

```powershell
.\deployment\build-lambda-docker.ps1
```

This builds and uploads the code to Lambda.

---

## STEP 5: Create API Gateway

### 5.1 Create HTTP API

1. Go to: https://console.aws.amazon.com/apigateway/
2. Click "Create API"
3. Select "HTTP API" → "Build"
4. Click "Add integration"
5. Select "Lambda"
6. Lambda function: `hisab-api`
7. API name: `hisab-api`
8. Click "Next"
9. Configure routes:
   - Method: `ANY`
   - Resource path: `/{proxy+}`
10. Click "Next"
11. Stage name: `$default`
12. Click "Next" → "Create"

### 5.2 Add Root Route

1. Click on your API
2. Go to "Routes"
3. Click "Create"
4. Method: `ANY`
5. Path: `/`
6. Click "Create"
7. Click on the route
8. Click "Attach integration"
9. Select the Lambda integration

### 5.3 Configure CORS

1. Go to "CORS"
2. Click "Configure"
3. Set:
   - Access-Control-Allow-Origin: `*` (or specific domains)
   - Access-Control-Allow-Headers: `*`
   - Access-Control-Allow-Methods: `*`
4. Click "Save"

### 5.4 Get API URL

1. Go to "Stages"
2. Copy the "Invoke URL" (e.g., `https://2cjvid84h1.execute-api.ap-south-1.amazonaws.com`)

---

## STEP 6: Test Backend

### 6.1 Test Health Endpoint

```powershell
curl https://YOUR-API-ID.execute-api.ap-south-1.amazonaws.com/health
```

Expected: `{"status":"healthy","app_name":"Hisab","debug":false}`

### 6.2 Test Register Endpoint

```powershell
$body = '{"name":"Test","email":"test@test.com","password":"test123"}'
Invoke-WebRequest -Uri "https://YOUR-API-ID.execute-api.ap-south-1.amazonaws.com/api/auth/register" -Method POST -Body $body -ContentType "application/json"
```

Expected: User created successfully (or 400 if exists)

---

## STEP 7: Deploy Frontend to S3

### 7.1 Create S3 Bucket

1. Go to: https://console.aws.amazon.com/s3/
2. Click "Create bucket"
3. Bucket name: `hisab-frontend` (must be globally unique)
4. Region: `ap-south-1`
5. Uncheck "Block all public access"
6. Acknowledge the warning
7. Click "Create bucket"

### 7.2 Enable Static Website Hosting

1. Click on the bucket
2. Go to "Properties" tab
3. Scroll to "Static website hosting"
4. Click "Edit"
5. Enable static website hosting
6. Index document: `index.html`
7. Error document: `index.html`
8. Click "Save changes"

### 7.3 Set Bucket Policy

1. Go to "Permissions" tab
2. Click "Bucket policy" → "Edit"
3. Paste:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::hisab-frontend/*"
        }
    ]
}
```

4. Click "Save changes"

### 7.4 Build and Upload Frontend

```powershell
# Update API URL in frontend
# Edit frontend/.env or frontend/src/services/api.js
# Set API_BASE_URL to your API Gateway URL

cd frontend
npm run build

# Upload to S3
aws s3 sync dist/ s3://hisab-frontend/ --delete
```

---

## STEP 8: Setup CloudFront (Optional - for HTTPS)

### 8.1 Create Distribution

1. Go to: https://console.aws.amazon.com/cloudfront/
2. Click "Create distribution"
3. Origin domain: Select your S3 bucket
4. Origin access: "Origin access control settings"
5. Create new OAC
6. Default root object: `index.html`
7. Click "Create distribution"

### 8.2 Update S3 Bucket Policy

CloudFront will show you a policy to add to S3. Add it.

### 8.3 Configure Custom Domain (Optional)

1. Request SSL certificate in ACM (us-east-1 region!)
2. Add alternate domain name in CloudFront
3. Update DNS to point to CloudFront

---

## Troubleshooting Checklist

### If Lambda returns 500:

1. Check CloudWatch logs:
   ```powershell
   aws logs tail /aws/lambda/hisab-api --since 5m
   ```

2. Verify environment variables are set correctly

3. Verify DynamoDB tables exist

4. Verify IAM role has DynamoDB permissions

### If "UnrecognizedClientException":

1. **DO NOT** set `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY` in Lambda environment
2. Verify the Lambda execution role has the correct trust relationship
3. Verify the inline policy uses YOUR account ID (not `*`)
4. Redeploy Lambda after any IAM changes

### If CORS errors:

1. Check API Gateway CORS settings
2. Check `ALLOWED_ORIGINS` environment variable in Lambda
3. Verify frontend is using correct API URL

---

## Quick Verification Commands

```powershell
# Check AWS CLI
aws sts get-caller-identity

# Check DynamoDB tables
aws dynamodb list-tables --region ap-south-1

# Check Lambda function
aws lambda get-function --function-name hisab-api --region ap-south-1

# Check Lambda role
aws lambda get-function-configuration --function-name hisab-api --region ap-south-1 --query "Role"

# Test health endpoint
Invoke-WebRequest -Uri "https://YOUR-API-ID.execute-api.ap-south-1.amazonaws.com/health"

# Check Lambda logs
aws logs tail /aws/lambda/hisab-api --since 5m --region ap-south-1
```

