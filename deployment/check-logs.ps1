# Check Lambda CloudWatch Logs

Write-Host "=== Checking Lambda Logs ===" -ForegroundColor Green
Write-Host ""

Write-Host "Fetching recent logs (last 5 minutes)..." -ForegroundColor Yellow
Write-Host ""

aws logs tail /aws/lambda/hisab-api --since 5m --format short

Write-Host ""
Write-Host "=== End of Logs ===" -ForegroundColor Green
Write-Host ""
Write-Host "Look for:" -ForegroundColor Yellow
Write-Host "  - 'ImportModuleError' = Missing dependencies" -ForegroundColor Gray
Write-Host "  - 'Starting up Hisab App...' = App initialized successfully" -ForegroundColor Gray
Write-Host "  - 'DynamoDB tables ready!' = Database connected" -ForegroundColor Gray
Write-Host "  - Any Python traceback = Code error" -ForegroundColor Gray
Write-Host ""

