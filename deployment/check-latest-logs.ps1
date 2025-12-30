# Check Latest CloudWatch Logs

Write-Host "=== Checking Latest Lambda Logs ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "Fetching last 2 minutes of logs..." -ForegroundColor Yellow
Write-Host ""

$logs = aws logs tail /aws/lambda/hisab-api --since 2m --format short --region ap-south-1 2>&1

if ($LASTEXITCODE -eq 0) {
    # Look for errors
    if ($logs -match "ERROR|Exception|Traceback") {
        Write-Host "=== ERROR FOUND ===" -ForegroundColor Red
        Write-Host ""
        
        # Extract error lines
        $errorLines = $logs | Select-String -Pattern "ERROR|Exception|Traceback" -Context 5,15
        
        Write-Host $errorLines -ForegroundColor Red
    } else {
        Write-Host "No errors in recent logs." -ForegroundColor Green
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

aws logs tail /aws/lambda/hisab-api --since 2m --format detailed --region ap-south-1

Write-Host ""
Write-Host "=== What to Look For ===" -ForegroundColor Yellow
Write-Host ""
Write-Host "If you see 'UnrecognizedClientException':" -ForegroundColor White
Write-Host "  - The new role might not have propagated yet (wait 2-3 minutes)" -ForegroundColor Gray
Write-Host "  - Or there might be a permissions boundary" -ForegroundColor Gray
Write-Host ""
Write-Host "If you see other errors, share the full error message." -ForegroundColor White

