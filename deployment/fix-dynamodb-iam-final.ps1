# Final fix for DynamoDB IAM permissions

$LAMBDA_FUNCTION = "hisab-api-v2"
$AWS_REGION = "ap-south-1"

Write-Host "=== Fixing DynamoDB IAM Permissions ===" -ForegroundColor Cyan
Write-Host ""

# Get Lambda function configuration
Write-Host "1. Getting Lambda function configuration..." -ForegroundColor Yellow
$lambdaConfig = aws lambda get-function-configuration `
    --function-name $LAMBDA_FUNCTION `
    --region $AWS_REGION | ConvertFrom-Json

$roleArn = $lambdaConfig.Role
Write-Host "   Lambda Role: $roleArn" -ForegroundColor Gray

# Extract role name from ARN
$roleName = $roleArn.Split('/')[-1]
Write-Host "   Role Name: $roleName" -ForegroundColor Gray
Write-Host ""

# Get account ID
Write-Host "2. Getting AWS Account ID..." -ForegroundColor Yellow
$accountInfo = aws sts get-caller-identity | ConvertFrom-Json
$accountId = $accountInfo.Account
Write-Host "   Account ID: $accountId" -ForegroundColor Gray
Write-Host ""

# Create IAM policy for DynamoDB access
Write-Host "3. Creating DynamoDB access policy..." -ForegroundColor Yellow
$policyJson = @{
    Version = "2012-10-17"
    Statement = @(
        @{
            Effect = "Allow"
            Action = @(
                "dynamodb:PutItem",
                "dynamodb:GetItem",
                "dynamodb:UpdateItem",
                "dynamodb:DeleteItem",
                "dynamodb:Query",
                "dynamodb:Scan",
                "dynamodb:BatchGetItem",
                "dynamodb:BatchWriteItem"
            )
            Resource = @(
                "arn:aws:dynamodb:$AWS_REGION:$accountId:table/hisab_*",
                "arn:aws:dynamodb:$AWS_REGION:$accountId:table/hisab_*/index/*"
            )
        },
        @{
            Effect = "Allow"
            Action = @(
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            )
            Resource = "arn:aws:logs:$AWS_REGION:$accountId:*"
        }
    )
} | ConvertTo-Json -Depth 10

$policyJson | Out-File -FilePath "dynamodb-policy.json" -Encoding ASCII

Write-Host "   Policy JSON created" -ForegroundColor Gray
Write-Host ""

# Attach policy to role
Write-Host "4. Attaching policy to Lambda role..." -ForegroundColor Yellow
$policyName = "HisabDynamoDBAccess"

# Check if policy already exists
$existingPolicies = aws iam list-attached-role-policies --role-name $roleName | ConvertFrom-Json
$policyExists = $existingPolicies.AttachedPolicies | Where-Object { $_.PolicyName -eq $policyName }

if ($policyExists) {
    Write-Host "   Policy already attached. Detaching first..." -ForegroundColor Yellow
    aws iam detach-role-policy --role-name $roleName --policy-arn $policyExists.PolicyArn
}

# Create or update the policy
Write-Host "   Creating/updating policy..." -ForegroundColor Yellow
$policyArn = "arn:aws:iam::$accountId`:policy/$policyName"

try {
    # Try to create the policy
    aws iam create-policy `
        --policy-name $policyName `
        --policy-document file://dynamodb-policy.json `
        --region $AWS_REGION 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Policy created" -ForegroundColor Green
    } else {
        # Policy might already exist, update it
        Write-Host "   Policy exists, updating..." -ForegroundColor Yellow
        aws iam create-policy-version `
            --policy-arn $policyArn `
            --policy-document file://dynamodb-policy.json `
            --set-as-default `
            --region $AWS_REGION | Out-Null
        Write-Host "   ✅ Policy updated" -ForegroundColor Green
    }
} catch {
    Write-Host "   ⚠️  Error creating policy (might already exist)" -ForegroundColor Yellow
}

# Attach policy to role
Write-Host "   Attaching policy to role..." -ForegroundColor Yellow
aws iam attach-role-policy `
    --role-name $roleName `
    --policy-arn $policyArn `
    --region $AWS_REGION

if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Policy attached successfully" -ForegroundColor Green
} else {
    Write-Host "   ❌ Failed to attach policy" -ForegroundColor Red
    exit 1
}

# Cleanup
Remove-Item -Force "dynamodb-policy.json" -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "=== Verification ===" -ForegroundColor Cyan
Write-Host "Waiting 5 seconds for IAM changes to propagate..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "✅ IAM policy updated!" -ForegroundColor Green
Write-Host ""
Write-Host "Test the Lambda function now:" -ForegroundColor Yellow
Write-Host "  .\deployment\test-lambda-directly.ps1" -ForegroundColor Gray

