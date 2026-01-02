# Set OPENAI_API_KEY in Lambda
# Usage: .\deployment\set-openai-key.ps1 -ApiKey "sk-your-key-here"

param(
    [Parameter(Mandatory=$true)]
    [string]$ApiKey
)

$LAMBDA_FUNCTION = "hisab-api-v2"
$AWS_REGION = "ap-south-1"

Write-Host "=== Setting OPENAI_API_KEY in Lambda ===" -ForegroundColor Cyan
Write-Host ""

# Get current environment variables
Write-Host "1. Getting current Lambda configuration..." -ForegroundColor Yellow
$config = aws lambda get-function-configuration --function-name $LAMBDA_FUNCTION --region $AWS_REGION --output json | ConvertFrom-Json
$currentEnvVars = $config.Environment.Variables

# Add/update OPENAI_API_KEY
$currentEnvVars.OPENAI_API_KEY = $ApiKey

# Convert to JSON format for AWS CLI
$envVarsJson = $currentEnvVars | ConvertTo-Json -Compress

Write-Host "2. Updating Lambda environment variables..." -ForegroundColor Yellow
Write-Host "   (This will update OPENAI_API_KEY and keep all other variables)" -ForegroundColor Gray

$updateCmd = "aws lambda update-function-configuration --function-name $LAMBDA_FUNCTION --environment `"Variables=$envVarsJson`" --region $AWS_REGION"
Invoke-Expression $updateCmd

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Success! OPENAI_API_KEY has been set." -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Wait 10-30 seconds for changes to propagate" -ForegroundColor Gray
    Write-Host "2. Test with: .\deployment\check-ai-status.ps1" -ForegroundColor Gray
    Write-Host "3. Try creating a voice expense - you should see 'Parsed with AI'" -ForegroundColor Gray
} else {
    Write-Host ""
    Write-Host "Failed to update Lambda configuration" -ForegroundColor Red
    Write-Host "Check the error above" -ForegroundColor Yellow
}

Write-Host ""

