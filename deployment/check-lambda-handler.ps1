# Check Lambda Handler Configuration

Write-Host "=== Checking Lambda Handler ===" -ForegroundColor Green
Write-Host ""

# Get full function configuration
Write-Host "Full Lambda configuration:" -ForegroundColor Yellow
aws lambda get-function-configuration --function-name hisab-api --output json | ConvertFrom-Json | Select-Object Handler, Runtime, Timeout, MemorySize | Format-List

Write-Host ""
Write-Host "Expected Handler: lambda_handler.handler" -ForegroundColor Cyan
Write-Host ""

# Check current handler
$config = aws lambda get-function-configuration --function-name hisab-api --output json | ConvertFrom-Json
$currentHandler = $config.Handler

if ($currentHandler -eq "lambda_handler.handler") {
    Write-Host "✅ Handler is correct: $currentHandler" -ForegroundColor Green
} else {
    Write-Host "❌ Handler is incorrect: $currentHandler" -ForegroundColor Red
    Write-Host ""
    Write-Host "To fix, run:" -ForegroundColor Yellow
    Write-Host "aws lambda update-function-configuration --function-name hisab-api --handler lambda_handler.handler" -ForegroundColor White
}

