# Check Latest Lambda Error from CloudWatch

Write-Host "=== Checking Latest Lambda Error ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "Fetching last 5 minutes of logs..." -ForegroundColor Yellow
Write-Host ""

# Get the most recent error logs
$logs = aws logs tail /aws/lambda/hisab-api --since 5m --format short --region ap-south-1 2>&1

if ($LASTEXITCODE -eq 0) {
    # Filter for errors
    $errorLines = $logs | Select-String -Pattern "ERROR|Exception|Traceback|Error" -Context 0,10
    
    if ($errorLines) {
        Write-Host "=== ERROR FOUND ===" -ForegroundColor Red
        Write-Host ""
        Write-Host $errorLines -ForegroundColor Red
    } else {
        Write-Host "No errors found in recent logs." -ForegroundColor Green
        Write-Host ""
        Write-Host "Recent log entries:" -ForegroundColor Yellow
        Write-Host $logs -ForegroundColor Gray
    }
} else {
    Write-Host "Error fetching logs: $logs" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Full Recent Logs ===" -ForegroundColor Cyan
Write-Host ""

# Get full detailed logs
aws logs tail /aws/lambda/hisab-api --since 5m --format detailed --region ap-south-1

Write-Host ""
Write-Host "=== Next Steps ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "If you see 'UnrecognizedClientException':" -ForegroundColor Yellow
Write-Host "1. Check IAM role policy has correct account ID (294618942342)" -ForegroundColor White
Write-Host "2. Verify DynamoDB tables exist" -ForegroundColor White
Write-Host "3. Make sure no AWS credentials in Lambda env vars" -ForegroundColor White
Write-Host ""
Write-Host "If you see other errors, share the full error message." -ForegroundColor Yellow

