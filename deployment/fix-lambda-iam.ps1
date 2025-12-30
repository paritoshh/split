# Fix Lambda IAM Role for DynamoDB Access

Write-Host "=== Fixing Lambda IAM Permissions ===" -ForegroundColor Green
Write-Host ""

# Get Lambda function configuration
Write-Host "1. Getting Lambda function role..." -ForegroundColor Yellow
$lambdaConfig = aws lambda get-function-configuration --function-name hisab-api --output json | ConvertFrom-Json
$roleArn = $lambdaConfig.Role
$roleName = ($roleArn -split '/')[-1]

Write-Host "   Role ARN: $roleArn" -ForegroundColor Gray
Write-Host "   Role Name: $roleName" -ForegroundColor Gray
Write-Host ""

# Check current policies
Write-Host "2. Checking current IAM policies..." -ForegroundColor Yellow
$attachedPolicies = aws iam list-attached-role-policies --role-name $roleName --output json | ConvertFrom-Json
$inlinePolicies = aws iam list-role-policies --role-name $roleName --output json | ConvertFrom-Json

Write-Host "   Attached policies: $($attachedPolicies.AttachedPolicies.Count)" -ForegroundColor Gray
Write-Host "   Inline policies: $($inlinePolicies.PolicyNames.Count)" -ForegroundColor Gray
Write-Host ""

# Create DynamoDB policy JSON
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
                "arn:aws:dynamodb:ap-south-1:*:table/hisab_*",
                "arn:aws:dynamodb:ap-south-1:*:table/hisab_*/index/*"
            )
        },
        @{
            Effect = "Allow"
            Action = @(
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            )
            Resource = "arn:aws:logs:*:*:*"
        }
    )
} | ConvertTo-Json -Depth 10

# Save policy to file
$policyJson | Out-File -FilePath dynamodb-policy.json -Encoding utf8 -NoNewline

Write-Host "   Policy JSON created" -ForegroundColor Gray
Write-Host ""

# Attach policy as inline policy
Write-Host "4. Attaching policy to Lambda role..." -ForegroundColor Yellow
aws iam put-role-policy `
    --role-name $roleName `
    --policy-name HisabDynamoDBAccess `
    --policy-document file://dynamodb-policy.json

if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Policy attached successfully!" -ForegroundColor Green
} else {
    Write-Host "   ❌ Failed to attach policy" -ForegroundColor Red
    exit 1
}

# Clean up
Remove-Item dynamodb-policy.json -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "=== Verification ===" -ForegroundColor Green
Write-Host ""
Write-Host "Policy attached. Wait 10-20 seconds for IAM to propagate, then test:" -ForegroundColor Yellow
Write-Host "  .\deployment\test-api.ps1" -ForegroundColor White
Write-Host ""

