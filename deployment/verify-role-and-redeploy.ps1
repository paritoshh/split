# Verify Role Configuration and Force Lambda Redeployment

$LAMBDA_FUNCTION = "hisab-api"
$ROLE_NAME = "hisab-lambda-role-v2"
$AWS_REGION = "ap-south-1"

Write-Host "=== Verify Role and Redeploy Lambda ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Verify Lambda is using correct role
Write-Host "STEP 1: Verify Lambda Execution Role" -ForegroundColor Yellow
Write-Host "--------------------------------------" -ForegroundColor Yellow

$lambdaConfig = aws lambda get-function-configuration --function-name $LAMBDA_FUNCTION --region $AWS_REGION --output json 2>&1
if ($LASTEXITCODE -eq 0) {
    $lambdaJson = $lambdaConfig | ConvertFrom-Json
    $roleArn = $lambdaJson.Role
    
    Write-Host "Current Lambda role: $roleArn" -ForegroundColor Cyan
    
    if ($roleArn -match "role/(.+)$") {
        $actualRoleName = $matches[1]
        if ($actualRoleName -eq $ROLE_NAME) {
            Write-Host "✅ Lambda is using correct role: $ROLE_NAME" -ForegroundColor Green
        } else {
            Write-Host "❌ Lambda is using wrong role: $actualRoleName" -ForegroundColor Red
            Write-Host "   Expected: $ROLE_NAME" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "Fix: Go to Lambda Console -> Configuration -> Permissions -> Edit" -ForegroundColor White
            Write-Host "     Select: $ROLE_NAME" -ForegroundColor White
            exit 1
        }
    }
} else {
    Write-Host "❌ Error getting Lambda configuration" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 2: Verify role has DynamoDB permissions
Write-Host "STEP 2: Verify Role Permissions" -ForegroundColor Yellow
Write-Host "--------------------------------------" -ForegroundColor Yellow

Write-Host "Please verify in IAM Console:" -ForegroundColor Cyan
Write-Host "1. Go to: https://console.aws.amazon.com/iam/" -ForegroundColor White
Write-Host "2. Click 'Roles' -> '$ROLE_NAME'" -ForegroundColor White
Write-Host "3. Click 'Permissions' tab" -ForegroundColor White
Write-Host "4. Verify these policies are attached:" -ForegroundColor White
Write-Host "   ✅ AmazonDynamoDBFullAccess" -ForegroundColor Green
Write-Host "   ✅ AWSLambdaBasicExecutionRole" -ForegroundColor Green
Write-Host "5. Verify:" -ForegroundColor White
Write-Host "   ✅ NO inline policies" -ForegroundColor Green
Write-Host "   ✅ Permissions boundary: 'Not set'" -ForegroundColor Green
Write-Host ""

# Step 3: Force Lambda redeployment
Write-Host "STEP 3: Redeploy Lambda (Force Credential Refresh)" -ForegroundColor Yellow
Write-Host "-----------------------------------------------------" -ForegroundColor Yellow

Write-Host "This will rebuild and redeploy Lambda to force credential refresh..." -ForegroundColor Gray
Write-Host ""

$redeploy = Read-Host "Do you want to redeploy Lambda now? (Y/N)"

if ($redeploy -eq "Y" -or $redeploy -eq "y") {
    Write-Host ""
    Write-Host "Running build script..." -ForegroundColor Yellow
    Write-Host ""
    
    $scriptPath = Join-Path $PSScriptRoot "build-lambda-docker.ps1"
    if (Test-Path $scriptPath) {
        & $scriptPath
    } else {
        Write-Host "Build script not found. Run manually:" -ForegroundColor Yellow
        Write-Host "  .\deployment\build-lambda-docker.ps1" -ForegroundColor White
    }
} else {
    Write-Host ""
    Write-Host "Skipping redeployment." -ForegroundColor Yellow
    Write-Host "Run manually: .\deployment\build-lambda-docker.ps1" -ForegroundColor White
}

Write-Host ""
Write-Host "=== After Redeployment ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Wait 30-60 seconds" -ForegroundColor White
Write-Host "2. Test Lambda directly in console" -ForegroundColor White
Write-Host "3. If still failing, check CloudWatch logs" -ForegroundColor White
Write-Host ""

