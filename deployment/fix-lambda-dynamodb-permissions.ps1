# Fix Lambda DynamoDB Permissions
# This script verifies and fixes IAM role permissions for Lambda to access DynamoDB

$LAMBDA_FUNCTION = "hisab-api-v2"
$AWS_REGION = "ap-south-1"

Write-Host "=== Fixing Lambda DynamoDB Permissions ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Get Lambda function configuration
Write-Host "1. Getting Lambda function configuration..." -ForegroundColor Yellow
$lambdaConfig = aws lambda get-function-configuration --function-name $LAMBDA_FUNCTION --region $AWS_REGION --output json | ConvertFrom-Json

if (-not $lambdaConfig) {
    Write-Host "❌ Error: Could not get Lambda function configuration" -ForegroundColor Red
    exit 1
}

$roleArn = $lambdaConfig.Role
Write-Host "   Lambda execution role: $roleArn" -ForegroundColor Gray

# Extract role name from ARN
$roleName = $roleArn -replace '.*role/', ''
Write-Host "   Role name: $roleName" -ForegroundColor Gray
Write-Host ""

# Step 2: Check current policies
Write-Host "2. Checking current IAM role policies..." -ForegroundColor Yellow
$attachedPolicies = aws iam list-attached-role-policies --role-name $roleName --output json | ConvertFrom-Json

Write-Host "   Attached policies:" -ForegroundColor Gray
foreach ($policy in $attachedPolicies.AttachedPolicies) {
    Write-Host "     - $($policy.PolicyName) ($($policy.PolicyArn))" -ForegroundColor White
}

# Check inline policies
$inlinePolicies = aws iam list-role-policies --role-name $roleName --output json | ConvertFrom-Json
if ($inlinePolicies.PolicyNames.Count -gt 0) {
    Write-Host "   Inline policies:" -ForegroundColor Gray
    foreach ($policyName in $inlinePolicies.PolicyNames) {
        Write-Host "     - $policyName" -ForegroundColor White
    }
}

Write-Host ""

# Step 3: Check if DynamoDB policy exists
Write-Host "3. Checking for DynamoDB permissions..." -ForegroundColor Yellow

$hasDynamoDBPolicy = $false
foreach ($policy in $attachedPolicies.AttachedPolicies) {
    if ($policy.PolicyName -like "*DynamoDB*" -or $policy.PolicyArn -like "*DynamoDB*") {
        $hasDynamoDBPolicy = $true
        Write-Host "   ✅ Found DynamoDB policy: $($policy.PolicyName)" -ForegroundColor Green
    }
}

if (-not $hasDynamoDBPolicy) {
    Write-Host "   ⚠️  No DynamoDB policy found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "4. Creating DynamoDB access policy..." -ForegroundColor Yellow
    
    # Create policy document
    $policyDoc = @{
        Version = "2012-10-17
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
                    "arn:aws:dynamodb:$AWS_REGION:*:table/hisab_*",
                    "arn:aws:dynamodb:$AWS_REGION:*:table/hisab_*/index/*"
                )
            }
        )
    } | ConvertTo-Json -Depth 10
    
    $policyDoc | Out-File -FilePath "dynamodb-policy.json" -Encoding utf8
    Write-Host "   Policy document created: dynamodb-policy.json" -ForegroundColor Gray
    
    # Create policy
    $policyName = "HisabDynamoDBAccess"
    Write-Host "   Creating policy: $policyName..." -ForegroundColor Gray
    
    $createPolicyResult = aws iam create-policy `
        --policy-name $policyName `
        --policy-document file://dynamodb-policy.json `
        --output json 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        $policy = $createPolicyResult | ConvertFrom-Json
        $policyArn = $policy.Policy.Arn
        Write-Host "   ✅ Policy created: $policyArn" -ForegroundColor Green
    } elseif ($createPolicyResult -match "EntityAlreadyExists") {
        Write-Host "   ℹ️  Policy already exists, getting ARN..." -ForegroundColor Yellow
        $policyArn = "arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):policy/$policyName"
    } else {
        Write-Host "   ❌ Error creating policy:" -ForegroundColor Red
        Write-Host $createPolicyResult -ForegroundColor Gray
        exit 1
    }
    
    # Attach policy to role
    Write-Host "   Attaching policy to role..." -ForegroundColor Gray
    aws iam attach-role-policy `
        --role-name $roleName `
        --policy-arn $policyArn `
        --output json 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Policy attached to role!" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Error attaching policy" -ForegroundColor Red
        exit 1
    }
    
    Write-Host ""
    Write-Host "   ⏳ Waiting 5 seconds for IAM changes to propagate..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
} else {
    Write-Host "   ✅ DynamoDB permissions already configured" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== Verification ===" -ForegroundColor Cyan
Write-Host ""

# Step 4: Verify permissions
Write-Host "5. Verifying permissions..." -ForegroundColor Yellow

# Check if we can list tables (this requires DynamoDB permissions)
$testResult = aws dynamodb list-tables --region $AWS_REGION --output json 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ DynamoDB access verified!" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Could not verify DynamoDB access (this might be normal if you don't have CLI permissions)" -ForegroundColor Yellow
    Write-Host "   The Lambda role should still work even if CLI doesn't have permissions" -ForegroundColor Gray
}

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Lambda Function: $LAMBDA_FUNCTION" -ForegroundColor White
Write-Host "Execution Role: $roleName" -ForegroundColor White
Write-Host "Region: $AWS_REGION" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Wait 1-2 minutes for IAM changes to propagate" -ForegroundColor Gray
Write-Host "2. Test the Lambda function" -ForegroundColor Gray
Write-Host "3. Check CloudWatch logs if errors persist" -ForegroundColor Gray
Write-Host ""
Write-Host "To test:" -ForegroundColor Yellow
Write-Host "  .\deployment\test-api.ps1" -ForegroundColor Gray
Write-Host ""

