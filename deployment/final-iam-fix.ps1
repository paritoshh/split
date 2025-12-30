# Final IAM Fix - Comprehensive Solution
# This will help identify and fix the UnrecognizedClientException

$LAMBDA_FUNCTION = "hisab-api"
$ROLE_NAME = "hisab-lambda-role"
$AWS_REGION = "ap-south-1"

Write-Host "=== FINAL IAM FIX ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "You're still getting UnrecognizedClientException." -ForegroundColor Yellow
Write-Host "This means Lambda can't authenticate with DynamoDB." -ForegroundColor Yellow
Write-Host ""

# Get account ID
$identity = aws sts get-caller-identity --output json 2>&1
if ($LASTEXITCODE -eq 0) {
    $identityJson = $identity | ConvertFrom-Json
    $AWS_ACCOUNT_ID = $identityJson.Account
    Write-Host "AWS Account ID: $AWS_ACCOUNT_ID" -ForegroundColor Cyan
} else {
    $AWS_ACCOUNT_ID = "294618942342"
    Write-Host "Using default account ID: $AWS_ACCOUNT_ID" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== SOLUTION: Create a NEW Role ===" -ForegroundColor Green
Write-Host ""
Write-Host "Since the existing role isn't working, let's create a fresh one:" -ForegroundColor Yellow
Write-Host ""

Write-Host "STEP 1: Create New IAM Role" -ForegroundColor Cyan
Write-Host "---------------------------" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Go to: https://console.aws.amazon.com/iam/" -ForegroundColor White
Write-Host "2. Click 'Roles' -> 'Create role'" -ForegroundColor White
Write-Host "3. Select 'AWS service' -> 'Lambda'" -ForegroundColor White
Write-Host "4. Click 'Next'" -ForegroundColor White
Write-Host "5. Search and attach these policies:" -ForegroundColor White
Write-Host "   - AmazonDynamoDBFullAccess" -ForegroundColor Gray
Write-Host "   - AWSLambdaBasicExecutionRole" -ForegroundColor Gray
Write-Host "6. Click 'Next'" -ForegroundColor White
Write-Host "7. Role name: hisab-lambda-role-v2" -ForegroundColor White
Write-Host "8. Description: Lambda execution role for hisab-api" -ForegroundColor White
Write-Host "9. Click 'Create role'" -ForegroundColor White
Write-Host ""

Write-Host "STEP 2: Update Lambda to Use New Role" -ForegroundColor Cyan
Write-Host "--------------------------------------" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Go to: https://console.aws.amazon.com/lambda/" -ForegroundColor White
Write-Host "2. Click on '$LAMBDA_FUNCTION'" -ForegroundColor White
Write-Host "3. Go to 'Configuration' -> 'Permissions'" -ForegroundColor White
Write-Host "4. Click 'Edit' next to 'Execution role'" -ForegroundColor White
Write-Host "5. Select 'hisab-lambda-role-v2'" -ForegroundColor White
Write-Host "6. Click 'Save'" -ForegroundColor White
Write-Host ""

Write-Host "STEP 3: Wait and Test" -ForegroundColor Cyan
Write-Host "---------------------" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Wait 30-60 seconds for IAM to propagate" -ForegroundColor White
Write-Host "2. Test in browser console:" -ForegroundColor White
Write-Host ""
Write-Host '   fetch("https://e65w7up0h8.execute-api.ap-south-1.amazonaws.com/api/auth/register", {' -ForegroundColor Gray
Write-Host '     method: "POST",' -ForegroundColor Gray
Write-Host '     headers: { "Content-Type": "application/json" },' -ForegroundColor Gray
Write-Host '     body: JSON.stringify({' -ForegroundColor Gray
Write-Host '       name: "Test",' -ForegroundColor Gray
Write-Host '       email: "test" + Date.now() + "@test.com",' -ForegroundColor Gray
Write-Host '       password: "test123"' -ForegroundColor Gray
Write-Host '     })' -ForegroundColor Gray
Write-Host '   }).then(r => r.json()).then(console.log).catch(console.error)' -ForegroundColor Gray
Write-Host ""

Write-Host "=== ALTERNATIVE: Verify Current Role ===" -ForegroundColor Yellow
Write-Host ""
Write-Host "If you want to fix the existing role instead:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Go to IAM -> Roles -> $ROLE_NAME" -ForegroundColor White
Write-Host "2. Permissions tab -> Check:" -ForegroundColor White
Write-Host "   - AmazonDynamoDBFullAccess_v2 is attached" -ForegroundColor Gray
Write-Host "   - NO inline policies exist" -ForegroundColor Gray
Write-Host "   - Permissions boundary is 'Not set'" -ForegroundColor Gray
Write-Host "3. Trust relationships tab -> Should show:" -ForegroundColor White
Write-Host '   "Service": "lambda.amazonaws.com"' -ForegroundColor Gray
Write-Host "4. In Lambda -> Configuration -> Permissions:" -ForegroundColor White
Write-Host "   - Verify it shows $ROLE_NAME" -ForegroundColor Gray
Write-Host "5. REDEPLOY Lambda:" -ForegroundColor White
Write-Host "   .\deployment\build-lambda-docker.ps1" -ForegroundColor Gray
Write-Host ""

Write-Host "=== Why This Might Work ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Creating a new role ensures:" -ForegroundColor Yellow
Write-Host "- No conflicting policies" -ForegroundColor White
Write-Host "- Clean trust relationship" -ForegroundColor White
Write-Host "- Fresh permissions" -ForegroundColor White
Write-Host "- Lambda will pick up new role immediately" -ForegroundColor White

