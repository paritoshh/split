# Check Lambda Environment Variables

Write-Host "=== Checking Lambda Environment Variables ===" -ForegroundColor Green
Write-Host ""

$config = aws lambda get-function-configuration --function-name hisab-api --output json | ConvertFrom-Json
$envVars = $config.Environment.Variables

Write-Host "Current environment variables:" -ForegroundColor Yellow
$envVars.PSObject.Properties | ForEach-Object {
    $key = $_.Name
    $value = $_.Value
    
    # Mask sensitive values
    if ($key -match "KEY|SECRET|PASSWORD|TOKEN") {
        $value = "***MASKED***"
    }
    
    Write-Host "  $key = $value" -ForegroundColor Gray
}

Write-Host ""

# Check for problematic AWS credentials
if ($envVars.aws_access_key_id -or $envVars.aws_secret_access_key -or $envVars.AWS_ACCESS_KEY_ID -or $envVars.AWS_SECRET_ACCESS_KEY) {
    Write-Host "⚠️  WARNING: AWS credentials found in environment variables!" -ForegroundColor Red
    Write-Host "   These should be REMOVED - Lambda should use IAM role instead" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To fix, remove these variables:" -ForegroundColor Yellow
    if ($envVars.aws_access_key_id) { Write-Host "   - aws_access_key_id" -ForegroundColor Gray }
    if ($envVars.aws_secret_access_key) { Write-Host "   - aws_secret_access_key" -ForegroundColor Gray }
    if ($envVars.AWS_ACCESS_KEY_ID) { Write-Host "   - AWS_ACCESS_KEY_ID" -ForegroundColor Gray }
    if ($envVars.AWS_SECRET_ACCESS_KEY) { Write-Host "   - AWS_SECRET_ACCESS_KEY" -ForegroundColor Gray }
} else {
    Write-Host "✅ No AWS credentials in environment variables (good!)" -ForegroundColor Green
}

Write-Host ""

