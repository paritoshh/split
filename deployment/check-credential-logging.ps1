# Check CloudWatch logs to see which credential mode is being used

Write-Host "=== Checking Credential Logging ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "Fetching recent Lambda logs to check credential mode..." -ForegroundColor Yellow
Write-Host ""

$logs = aws logs tail /aws/lambda/hisab-api-v2 --since 5m --format short --region ap-south-1 2>&1

if ($LASTEXITCODE -eq 0) {
    # Look for the credential logging message
    if ($logs -match "Using explicit AWS credentials|Using IAM role") {
        Write-Host "=== Credential Mode Found ===" -ForegroundColor Green
        Write-Host ""
        $credLine = $logs | Select-String -Pattern "Using explicit AWS credentials|Using IAM role"
        Write-Host $credLine -ForegroundColor Cyan
        
        if ($credLine -match "Using explicit AWS credentials") {
            Write-Host ""
            Write-Host "❌ PROBLEM FOUND!" -ForegroundColor Red
            Write-Host "Lambda is using explicit credentials instead of IAM role!" -ForegroundColor Red
            Write-Host ""
            Write-Host "Check Lambda environment variables:" -ForegroundColor Yellow
            Write-Host "  - AWS_ACCESS_KEY_ID (should NOT exist)" -ForegroundColor White
            Write-Host "  - AWS_SECRET_ACCESS_KEY (should NOT exist)" -ForegroundColor White
        } else {
            Write-Host ""
            Write-Host "✅ Lambda is using IAM role (correct)" -ForegroundColor Green
            Write-Host "But still getting UnrecognizedClientException..." -ForegroundColor Yellow
            Write-Host "This suggests the IAM role permissions aren't working." -ForegroundColor Yellow
        }
    } else {
        Write-Host "No credential logging found in recent logs." -ForegroundColor Yellow
        Write-Host "This might mean the Lambda hasn't initialized yet." -ForegroundColor Gray
    }
    
    Write-Host ""
    Write-Host "=== Full Recent Logs ===" -ForegroundColor Cyan
    Write-Host $logs -ForegroundColor Gray
} else {
    Write-Host "Error fetching logs: $logs" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Next Steps ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "If logs show 'Using explicit AWS credentials':" -ForegroundColor Yellow
Write-Host "  1. Go to Lambda Console -> Configuration -> Environment variables" -ForegroundColor White
Write-Host "  2. Delete AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY if they exist" -ForegroundColor White
Write-Host ""
Write-Host "If logs show 'Using IAM role' but still failing:" -ForegroundColor Yellow
Write-Host "  1. Try detaching and re-attaching AmazonDynamoDBFullAccess policy" -ForegroundColor White
Write-Host "  2. Wait 3-5 minutes for IAM to fully propagate" -ForegroundColor White
Write-Host "  3. Check if there's a permissions boundary or SCP blocking access" -ForegroundColor White

