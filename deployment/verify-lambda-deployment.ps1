# Verify Lambda Deployment

$LAMBDA_FUNCTION = "hisab-api-v2"
$AWS_REGION = "ap-south-1"

Write-Host "=== Verifying Lambda Deployment ===" -ForegroundColor Cyan
Write-Host ""

# Check Lambda function exists
Write-Host "1. Checking Lambda function..." -ForegroundColor Yellow
$lambdaConfig = aws lambda get-function-configuration --function-name $LAMBDA_FUNCTION --region $AWS_REGION --output json 2>&1

if ($LASTEXITCODE -eq 0) {
    $lambdaJson = $lambdaConfig | ConvertFrom-Json
    Write-Host "✅ Lambda function found: $LAMBDA_FUNCTION" -ForegroundColor Green
    Write-Host "   Last Modified: $($lambdaJson.LastModified)" -ForegroundColor Cyan
    Write-Host "   Code Size: $($lambdaJson.CodeSize) bytes" -ForegroundColor Cyan
    Write-Host "   Runtime: $($lambdaJson.Runtime)" -ForegroundColor Cyan
    Write-Host "   Handler: $($lambdaJson.Handler)" -ForegroundColor Cyan
} else {
    Write-Host "❌ Lambda function not found: $LAMBDA_FUNCTION" -ForegroundColor Red
    Write-Host $lambdaConfig -ForegroundColor Gray
    exit 1
}

Write-Host ""
Write-Host "2. Checking if bcrypt is in the package..." -ForegroundColor Yellow
Write-Host "   (This requires checking the deployment package)" -ForegroundColor Gray
Write-Host ""
Write-Host "   To verify bcrypt is included:" -ForegroundColor Yellow
Write-Host "   1. Download the Lambda package" -ForegroundColor White
Write-Host "   2. Extract and check for bcrypt folder" -ForegroundColor White
Write-Host ""
Write-Host "   Or test the Lambda - if bcrypt error is gone, it's included!" -ForegroundColor White

Write-Host ""
Write-Host "3. Quick test to see current error..." -ForegroundColor Yellow
Write-Host ""

# Create minimal test
$testEvent = '{"version":"2.0","routeKey":"POST /api/auth/register","rawPath":"/api/auth/register","headers":{"content-type":"application/json"},"requestContext":{"accountId":"294618942342","apiId":"e65w7up0h8","http":{"method":"POST","path":"/api/auth/register","sourceIp":"127.0.0.1"}},"body":"{\"name\":\"Test\",\"email\":\"test@test.com\",\"password\":\"test123\"}","isBase64Encoded":false}'
$testEvent | Out-File -FilePath "quick-test.json" -Encoding ASCII -NoNewline

$result = aws lambda invoke `
    --function-name $LAMBDA_FUNCTION `
    --region $AWS_REGION `
    --cli-binary-format raw-in-base64-out `
    --payload file://quick-test.json `
    --log-type Tail `
    quick-response.json 2>&1

Remove-Item -Force "quick-test.json" -ErrorAction SilentlyContinue

if ($LASTEXITCODE -eq 0) {
    $resultJson = $result | ConvertFrom-Json
    if ($resultJson.LogResult) {
        $logBytes = [System.Convert]::FromBase64String($resultJson.LogResult)
        $logs = [System.Text.Encoding]::UTF8.GetString($logBytes)
        
        if ($logs -match "MissingBackendError.*bcrypt") {
            Write-Host "❌ Still getting bcrypt error!" -ForegroundColor Red
            Write-Host "   The Lambda package doesn't include bcrypt." -ForegroundColor Yellow
            Write-Host "   Make sure you rebuilt with: .\deployment\build-lambda-docker.ps1" -ForegroundColor White
        } elseif ($logs -match "UnrecognizedClientException") {
            Write-Host "❌ Still getting DynamoDB error!" -ForegroundColor Red
        } elseif ($logs -match "ERROR|Exception") {
            Write-Host "⚠️  Other error found:" -ForegroundColor Yellow
            $logs | Select-String -Pattern "ERROR|Exception" -Context 1,5
        } else {
            Write-Host "✅ No errors in logs!" -ForegroundColor Green
        }
    }
    
    Remove-Item -Force "quick-response.json" -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "=== Next Steps ===" -ForegroundColor Cyan
Write-Host "If bcrypt error persists:" -ForegroundColor Yellow
Write-Host "1. Make sure you ran: .\deployment\build-lambda-docker.ps1" -ForegroundColor White
Write-Host "2. Check the build output - did it complete successfully?" -ForegroundColor White
Write-Host "3. Verify the Lambda function name in build script matches: $LAMBDA_FUNCTION" -ForegroundColor White

