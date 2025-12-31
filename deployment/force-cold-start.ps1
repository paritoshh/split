# Force Lambda cold start by updating function code

$LAMBDA_FUNCTION = "hisab-api-v2"
$AWS_REGION = "ap-south-1"

Write-Host "=== Forcing Lambda Cold Start ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "Updating Lambda function code to force cold start..." -ForegroundColor Yellow
Write-Host "This will clear any cached credentials." -ForegroundColor Gray
Write-Host ""

# Get current function code
$functionCode = aws lambda get-function `
    --function-name $LAMBDA_FUNCTION `
    --region $AWS_REGION | ConvertFrom-Json

$codeLocation = $functionCode.Code.Location

# Download current code
Write-Host "Downloading current function code..." -ForegroundColor Yellow
$tempZip = "temp-lambda-code.zip"
Invoke-WebRequest -Uri $codeLocation -OutFile $tempZip

# Update function with same code (forces cold start)
Write-Host "Uploading code back (forces cold start)..." -ForegroundColor Yellow
aws lambda update-function-code `
    --function-name $LAMBDA_FUNCTION `
    --region $AWS_REGION `
    --zip-file fileb://$tempZip `
    --no-cli-pager | Out-Null

Remove-Item -Force $tempZip -ErrorAction SilentlyContinue

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Lambda function updated - cold start forced" -ForegroundColor Green
    Write-Host ""
    Write-Host "Waiting 10 seconds for update to complete..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
    Write-Host ""
    Write-Host "Now test the function:" -ForegroundColor Yellow
    Write-Host "  .\deployment\test-lambda-directly.ps1" -ForegroundColor Gray
} else {
    Write-Host "❌ Failed to update Lambda function" -ForegroundColor Red
}

