# Deep IAM Diagnosis Script
# This checks everything that could cause UnrecognizedClientException

$LAMBDA_FUNCTION = "hisab-api"
$ROLE_NAME = "hisab-lambda-role"
$AWS_REGION = "ap-south-1"

Write-Host "=== Deep IAM Diagnosis ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Verify Lambda is using the correct role
Write-Host "STEP 1: Verify Lambda Execution Role" -ForegroundColor Yellow
Write-Host "--------------------------------------" -ForegroundColor Yellow

$lambdaConfig = aws lambda get-function-configuration --function-name $LAMBDA_FUNCTION --region $AWS_REGION --output json 2>&1
if ($LASTEXITCODE -eq 0) {
    $lambdaJson = $lambdaConfig | ConvertFrom-Json
    $roleArn = $lambdaJson.Role
    
    Write-Host "✅ Lambda function found" -ForegroundColor Green
    Write-Host "   Role ARN: $roleArn" -ForegroundColor Cyan
    
    if ($roleArn -match "role/(.+)$") {
        $actualRoleName = $matches[1]
        Write-Host "   Role Name: $actualRoleName" -ForegroundColor Cyan
        
        if ($actualRoleName -ne $ROLE_NAME) {
            Write-Host "   ⚠️  WARNING: Role name doesn't match expected '$ROLE_NAME'" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "❌ Error getting Lambda configuration" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 2: Check role trust relationship
Write-Host "STEP 2: Check Role Trust Relationship" -ForegroundColor Yellow
Write-Host "--------------------------------------" -ForegroundColor Yellow

Write-Host "Please verify in AWS Console:" -ForegroundColor Cyan
Write-Host "1. Go to: https://console.aws.amazon.com/iam/" -ForegroundColor White
Write-Host "2. Click 'Roles' -> '$ROLE_NAME'" -ForegroundColor White
Write-Host "3. Click 'Trust relationships' tab" -ForegroundColor White
Write-Host "4. Should show:" -ForegroundColor White
Write-Host ""
Write-Host '   "Service": "lambda.amazonaws.com"' -ForegroundColor Green
Write-Host ""

# Step 3: Check attached policies
Write-Host "STEP 3: Check Attached Policies" -ForegroundColor Yellow
Write-Host "--------------------------------------" -ForegroundColor Yellow

Write-Host "In IAM Console -> Roles -> $ROLE_NAME -> Permissions:" -ForegroundColor Cyan
Write-Host ""
Write-Host "You should see:" -ForegroundColor White
Write-Host "  ✅ AmazonDynamoDBFullAccess_v2 (AWS managed)" -ForegroundColor Green
Write-Host "  ✅ AWSLambdaBasicExecutionRole (AWS managed)" -ForegroundColor Green
Write-Host ""
Write-Host "You should NOT see:" -ForegroundColor White
Write-Host "  ❌ Any inline policies (delete them if they exist)" -ForegroundColor Red
Write-Host ""

# Step 4: Check for permissions boundaries
Write-Host "STEP 4: Check Permissions Boundary" -ForegroundColor Yellow
Write-Host "--------------------------------------" -ForegroundColor Yellow

Write-Host "In IAM Console -> Roles -> $ROLE_NAME -> Permissions:" -ForegroundColor Cyan
Write-Host "Scroll down to 'Permissions boundary'" -ForegroundColor White
Write-Host ""
Write-Host "If it says 'Not set', that's good ✅" -ForegroundColor Green
Write-Host "If it shows a policy, that might be blocking access!" -ForegroundColor Red
Write-Host ""

# Step 5: Verify DynamoDB tables
Write-Host "STEP 5: Verify DynamoDB Tables" -ForegroundColor Yellow
Write-Host "--------------------------------------" -ForegroundColor Yellow

$tables = @("hisab_users", "hisab_groups", "hisab_group_members", "hisab_expenses", "hisab_expense_splits", "hisab_settlements", "hisab_notifications")

foreach ($table in $tables) {
    $check = aws dynamodb describe-table --table-name $table --region $AWS_REGION 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Table exists: $table" -ForegroundColor Green
    } else {
        Write-Host "❌ Table missing: $table" -ForegroundColor Red
    }
}

Write-Host ""

# Step 6: Test Lambda invoke directly
Write-Host "STEP 6: Test Lambda Invoke Directly" -ForegroundColor Yellow
Write-Host "--------------------------------------" -ForegroundColor Yellow

Write-Host "Testing Lambda invoke (this bypasses API Gateway)..." -ForegroundColor Gray

$testPayload = @{
    httpMethod = "GET"
    path = "/health"
    headers = @{}
    body = $null
} | ConvertTo-Json -Compress

$testPayload | Out-File -FilePath "lambda-test.json" -Encoding UTF8

$invokeResult = aws lambda invoke `
    --function-name $LAMBDA_FUNCTION `
    --region $AWS_REGION `
    --payload "file://lambda-test.json" `
    --log-type Tail `
    response.json 2>&1

Remove-Item -Force "lambda-test.json" -ErrorAction SilentlyContinue

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Lambda invoked successfully" -ForegroundColor Green
    
    $response = Get-Content "response.json" -Raw | ConvertFrom-Json
    Write-Host "   Response: $($response | ConvertTo-Json -Compress)" -ForegroundColor Gray
    
    # Decode logs
    $invokeJson = $invokeResult | ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($invokeJson.LogResult) {
        $logBytes = [System.Convert]::FromBase64String($invokeJson.LogResult)
        $logs = [System.Text.Encoding]::UTF8.GetString($logBytes)
        
        if ($logs -match "UnrecognizedClientException") {
            Write-Host ""
            Write-Host "❌ Still seeing UnrecognizedClientException in logs!" -ForegroundColor Red
            Write-Host ""
            Write-Host "This means the Lambda role doesn't have proper DynamoDB access." -ForegroundColor Yellow
        }
    }
    
    Remove-Item -Force "response.json" -ErrorAction SilentlyContinue
} else {
    Write-Host "❌ Lambda invoke failed" -ForegroundColor Red
    Write-Host $invokeResult -ForegroundColor Gray
}

Write-Host ""

# Step 7: Final recommendations
Write-Host "=== FINAL RECOMMENDATIONS ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "If still getting UnrecognizedClientException:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. VERIFY in IAM Console:" -ForegroundColor White
Write-Host "   - Role has 'AmazonDynamoDBFullAccess_v2' attached" -ForegroundColor Gray
Write-Host "   - NO inline policies exist" -ForegroundColor Gray
Write-Host "   - NO permissions boundary set" -ForegroundColor Gray
Write-Host "   - Trust relationship allows 'lambda.amazonaws.com'" -ForegroundColor Gray
Write-Host ""
Write-Host "2. REDEPLOY Lambda (to refresh credentials):" -ForegroundColor White
Write-Host "   .\deployment\build-lambda-docker.ps1" -ForegroundColor Gray
Write-Host ""
Write-Host "3. WAIT 2-3 minutes after any IAM changes" -ForegroundColor White
Write-Host ""
Write-Host "4. If still failing, try creating a NEW role from scratch:" -ForegroundColor White
Write-Host "   - Create new role 'hisab-lambda-role-v2'" -ForegroundColor Gray
Write-Host "   - Attach 'AmazonDynamoDBFullAccess_v2'" -ForegroundColor Gray
Write-Host "   - Update Lambda to use new role" -ForegroundColor Gray

