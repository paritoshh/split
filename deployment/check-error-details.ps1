# Check detailed Lambda error logs

Write-Host "=== Checking Latest Lambda Error ===" -ForegroundColor Green
Write-Host ""

Write-Host "Fetching last 10 log entries..." -ForegroundColor Yellow
Write-Host ""

# Get the most recent error
$logs = aws logs tail /aws/lambda/hisab-api --since 2m --format short

if ($logs -match "ERROR|Exception|Traceback|Error") {
    Write-Host $logs -ForegroundColor Red
} else {
    Write-Host $logs -ForegroundColor Gray
}

Write-Host ""
Write-Host "=== Full Log Stream ===" -ForegroundColor Green
Write-Host ""

# Get full log stream with more details
aws logs tail /aws/lambda/hisab-api --since 2m --format detailed

