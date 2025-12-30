# Get the correct API Gateway URL for the Lambda function

$FUNCTION_NAME = "hisab-api"
$AWS_REGION = "ap-south-1"

Write-Host "=== Finding API Gateway URL ===" -ForegroundColor Cyan
Write-Host ""

# Get Lambda function configuration
Write-Host "1. Checking Lambda function..." -ForegroundColor Yellow
$lambdaConfig = aws lambda get-function-configuration --function-name $FUNCTION_NAME --region $AWS_REGION 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error getting Lambda configuration:" -ForegroundColor Red
    Write-Host $lambdaConfig
    exit 1
}

$configJson = $lambdaConfig | ConvertFrom-Json
Write-Host "✅ Lambda function found: $FUNCTION_NAME" -ForegroundColor Green
Write-Host ""

# Try to find API Gateway URL
Write-Host "2. Searching for API Gateway..." -ForegroundColor Yellow

# List all API Gateways
$apis = aws apigatewayv2 get-apis --region $AWS_REGION 2>&1
if ($LASTEXITCODE -eq 0) {
    $apisJson = $apis | ConvertFrom-Json
    Write-Host "Found HTTP APIs:" -ForegroundColor Cyan
    foreach ($api in $apisJson.Items) {
        Write-Host "  - Name: $($api.Name)" -ForegroundColor White
        Write-Host "    ID: $($api.ApiId)" -ForegroundColor Gray
        Write-Host "    Endpoint: $($api.ApiEndpoint)" -ForegroundColor Green
        Write-Host ""
    }
} else {
    Write-Host "⚠️  Could not list APIs (may not have permission)" -ForegroundColor Yellow
    Write-Host ""
}

# Alternative: Check if there's a custom domain or known URL
Write-Host "3. Checking for custom domain configuration..." -ForegroundColor Yellow
Write-Host ""
Write-Host "If you have a custom domain, the API URL might be:" -ForegroundColor Cyan
Write-Host "  https://hisab.paritoshagarwal.com" -ForegroundColor Green
Write-Host ""
Write-Host "Or check your API Gateway console:" -ForegroundColor Yellow
Write-Host "  https://console.aws.amazon.com/apigateway/main/apis?region=$AWS_REGION" -ForegroundColor White
Write-Host ""
Write-Host "Common API Gateway URL formats:" -ForegroundColor Cyan
Write-Host "  - HTTP API: https://<api-id>.execute-api.<region>.amazonaws.com" -ForegroundColor Gray
Write-Host "  - REST API: https://<api-id>.execute-api.<region>.amazonaws.com/<stage>" -ForegroundColor Gray
Write-Host "  - Custom domain: https://<your-domain>" -ForegroundColor Gray

