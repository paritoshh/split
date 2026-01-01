# Check Lambda function status and configuration

Write-Host "=== Checking Lambda Function Status ===" -ForegroundColor Cyan
Write-Host ""

$FUNCTION_NAME = "hisab-api-v2"

Write-Host "1. Checking Lambda function configuration..." -ForegroundColor Yellow
$functionInfo = aws lambda get-function --function-name $FUNCTION_NAME 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Lambda function '$FUNCTION_NAME' not found!" -ForegroundColor Red
    exit 1
}

Write-Host "   ✅ Function exists" -ForegroundColor Green
Write-Host ""

# Extract key info
$functionJson = $functionInfo | ConvertFrom-Json
$config = $functionJson.Configuration

Write-Host "Function Details:" -ForegroundColor Cyan
Write-Host "  Name: $($config.FunctionName)" -ForegroundColor Gray
Write-Host "  Runtime: $($config.Runtime)" -ForegroundColor Gray
Write-Host "  Handler: $($config.Handler)" -ForegroundColor Gray
Write-Host "  Last Modified: $($config.LastModified)" -ForegroundColor Gray
Write-Host "  State: $($config.State)" -ForegroundColor $(if ($config.State -eq "Active") { "Green" } else { "Red" })
Write-Host "  Last Update Status: $($config.LastUpdateStatus)" -ForegroundColor $(if ($config.LastUpdateStatus -eq "Successful") { "Green" } else { "Yellow" })
Write-Host ""

Write-Host "2. Checking recent invocations..." -ForegroundColor Yellow
$metrics = aws cloudwatch get-metric-statistics `
    --namespace AWS/Lambda `
    --metric-name Invocations `
    --dimensions Name=FunctionName,Value=$FUNCTION_NAME `
    --start-time (Get-Date).AddMinutes(-10).ToString("yyyy-MM-ddTHH:mm:ss") `
    --end-time (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss") `
    --period 60 `
    --statistics Sum `
    --query "Datapoints[*].[Timestamp,Sum]" `
    --output table 2>&1

if ($metrics -and $metrics -notmatch "error") {
    Write-Host $metrics
} else {
    Write-Host "   ⚠️  No recent invocations found" -ForegroundColor Yellow
    Write-Host "   This might mean requests aren't reaching Lambda" -ForegroundColor Gray
}

Write-Host ""
Write-Host "3. Checking for errors..." -ForegroundColor Yellow
$errorMetrics = aws cloudwatch get-metric-statistics `
    --namespace AWS/Lambda `
    --metric-name Errors `
    --dimensions Name=FunctionName,Value=$FUNCTION_NAME `
    --start-time (Get-Date).AddMinutes(-10).ToString("yyyy-MM-ddTHH:mm:ss") `
    --end-time (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss") `
    --period 60 `
    --statistics Sum `
    --query "Datapoints[*].[Timestamp,Sum]" `
    --output table 2>&1

if ($errorMetrics -and $errorMetrics -notmatch "error") {
    Write-Host $errorMetrics
} else {
    Write-Host "   ✅ No errors in last 10 minutes" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== Recommendations ===" -ForegroundColor Cyan
Write-Host "If no invocations:" -ForegroundColor Yellow
Write-Host "  - Check API Gateway integration" -ForegroundColor Gray
Write-Host "  - Test endpoint directly: .\test-register-login-direct.ps1" -ForegroundColor Gray
Write-Host ""
Write-Host "If errors found:" -ForegroundColor Yellow
Write-Host "  - Check Lambda logs: .\check-register-login-error.ps1" -ForegroundColor Gray
Write-Host "  - Rebuild Lambda: .\build-lambda-docker.ps1" -ForegroundColor Gray

