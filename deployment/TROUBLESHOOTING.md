# Troubleshooting Lambda 500 Errors

## Step 1: Check CloudWatch Logs

The 500 error means Lambda is crashing. Check the logs:

### On Windows (PowerShell):
```powershell
# Get recent error logs
aws logs tail /aws/lambda/hisab-api --since 10m --format short

# Or view in AWS Console:
# CloudWatch → Log groups → /aws/lambda/hisab-api → Latest log stream
```

## Step 2: Verify Lambda Environment Variables

Your Lambda function **MUST** have these environment variables set:

```powershell
# Check current environment variables
aws lambda get-function-configuration --function-name hisab-api --query 'Environment.Variables'
```

### Required Environment Variables:

| Variable | Value | How to Set |
|----------|-------|------------|
| `DATABASE_TYPE` | `dynamodb` | ✅ Required |
| `AWS_REGION` | `ap-south-1` | ✅ Required |
| `DYNAMODB_TABLE_PREFIX` | `hisab_` | ✅ Required |
| `SECRET_KEY` | `your-secret-key-here` | ✅ Required (generate a secure random string) |
| `ALLOWED_ORIGINS` | `https://hisab.paritoshagarwal.com,http://localhost:5173,capacitor://localhost` | ✅ Required for CORS |
| `DEBUG` | `false` | ✅ Recommended |
| `OPENAI_API_KEY` | `sk-...` | ⚠️ Optional (only if using AI features) |

### Set Environment Variables:

```powershell
aws lambda update-function-configuration `
  --function-name hisab-api `
  --environment "Variables={
    DATABASE_TYPE=dynamodb,
    AWS_REGION=ap-south-1,
    DYNAMODB_TABLE_PREFIX=hisab_,
    SECRET_KEY=YOUR_SECRET_KEY_HERE,
    ALLOWED_ORIGINS=https://hisab.paritoshagarwal.com,http://localhost:5173,capacitor://localhost,
    DEBUG=false
  }"
```

**Generate a secure SECRET_KEY:**
```powershell
# PowerShell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

## Step 3: Verify IAM Permissions

Lambda needs DynamoDB permissions. Check the execution role:

```powershell
# Get the role name
$ROLE_ARN = aws lambda get-function-configuration --function-name hisab-api --query 'Role' --output text
echo $ROLE_ARN

# Get role policies
aws iam list-attached-role-policies --role-name (Split-Path $ROLE_ARN -Leaf)
```

### Required IAM Policy:

Your Lambda execution role needs this policy:

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
        "dynamodb:Scan"
      ],
      "Resource": [
        "arn:aws:dynamodb:ap-south-1:*:table/hisab_*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    }
  ]
}
```

### Attach Policy:

1. Go to **IAM Console** → **Roles**
2. Find your Lambda execution role (usually `hisab-api-role` or similar)
3. Click **Add permissions** → **Create inline policy**
4. Paste the JSON above
5. Save

## Step 4: Verify DynamoDB Tables Exist

```powershell
# List all tables with prefix
aws dynamodb list-tables --query "TableNames[?starts_with(@, 'hisab_')]"
```

You should see:
- `hisab_users`
- `hisab_groups`
- `hisab_group_members`
- `hisab_expenses`
- `hisab_expense_splits`
- `hisab_notifications`
- `hisab_settlements`

If tables don't exist, create them:
```powershell
cd backend
python scripts/init_dynamodb.py
```

## Step 5: Test Lambda Function Directly

Test the Lambda function with a simple event:

```powershell
# Create test event file
@'
{
  "httpMethod": "GET",
  "path": "/health",
  "headers": {
    "origin": "https://hisab.paritoshagarwal.com"
  }
}
'@ | Out-File -FilePath test-event.json -Encoding utf8

# Invoke Lambda
aws lambda invoke --function-name hisab-api --payload file://test-event.json response.json
cat response.json
```

## Step 6: Common Errors and Fixes

### Error: "Unable to import module 'lambda_handler'"
**Fix:** Redeploy Lambda with all dependencies:
```powershell
cd backend
# Create deployment package (see deploy-lambda.sh)
```

### Error: "Table does not exist"
**Fix:** Create DynamoDB tables:
```powershell
python scripts/init_dynamodb.py
```

### Error: "AccessDeniedException" (DynamoDB)
**Fix:** Add DynamoDB permissions to Lambda role (Step 3)

### Error: "Invalid token" or "JWT decode error"
**Fix:** Set `SECRET_KEY` environment variable (Step 2)

### Error: CORS still failing
**Fix:** 
1. Set `ALLOWED_ORIGINS` environment variable
2. Verify API Gateway CORS is configured
3. Check that API Gateway is forwarding `Origin` header to Lambda

## Step 7: Verify API Gateway Configuration

1. Go to **API Gateway Console** → Your API
2. Check **Routes** → Should have `ANY /{proxy+}` route
3. Check **CORS** → Should allow `https://hisab.paritoshagarwal.com`
4. **Deploy** → Make sure changes are deployed to your stage

## Still Not Working?

1. Check CloudWatch logs for the exact error message
2. Test Lambda function directly (Step 5)
3. Verify all environment variables are set correctly
4. Check IAM permissions are correct
5. Ensure DynamoDB tables exist

