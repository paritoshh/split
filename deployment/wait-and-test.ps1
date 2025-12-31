# Wait for IAM propagation and test Lambda

$LAMBDA_FUNCTION = "hisab-api-v2"
$AWS_REGION = "ap-south-1"

Write-Host "=== Waiting for IAM Propagation ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "IAM changes can take 1-5 minutes to propagate..." -ForegroundColor Yellow
Write-Host "Waiting 30 seconds, then testing..." -ForegroundColor Yellow
Write-Host ""

for ($i = 30; $i -gt 0; $i--) {
    Write-Host "`rWaiting $i seconds... " -NoNewline -ForegroundColor Gray
    Start-Sleep -Seconds 1
}
Write-Host "`r" -NoNewline
Write-Host ""

Write-Host "Testing Lambda function..." -ForegroundColor Yellow
Write-Host ""

# Create test event
$testEvent = @{
    version = "2.0"
    routeKey = "POST /api/auth/register"
    rawPath = "/api/auth/register"
    headers = @{
        "content-type" = "application/json"
    }
    requestContext = @{
        accountId = "294618942342"
        apiId = "e65w7up0h8"
        http = @{
            method = "POST"
            path = "/api/auth/register"
            sourceIp = "127.0.0.1"
        }
    }
    body = '{"name":"Test User","email":"test' + (Get-Random) + '@test.com","password":"test123456"}'
    isBase64Encoded = $false
} | ConvertTo-Json -Depth 10

$testEvent | Out-File -FilePath "lambda-test-event.json" -Encoding ASCII -NoNewline

# Invoke Lambda
$result = aws lambda invoke `
    --function-name $LAMBDA_FUNCTION `
    --region $AWS_REGION `
    --cli-binary-format raw-in-base64-out `
    --payload file://lambda-test-event.json `
    --log-type Tail `
    lambda-response.json 2>&1

Remove-Item -Force "lambda-test-event.json" -ErrorAction SilentlyContinue

if ($LASTEXITCODE -eq 0) {
    if (Test-Path "lambda-response.json") {
        $response = Get-Content "lambda-response.json" | ConvertFrom-Json
        
        if ($response.statusCode -eq 200 -or $response.statusCode -eq 201) {
            Write-Host "✅ SUCCESS! Status: $($response.statusCode)" -ForegroundColor Green
            Write-Host "Response: $($response.body)" -ForegroundColor Gray
        } elseif ($response.statusCode -eq 500) {
            Write-Host "❌ Still getting 500 error" -ForegroundColor Red
            Write-Host ""
            Write-Host "Check if error is still UnrecognizedClientException:" -ForegroundColor Yellow
            Write-Host "  .\deployment\get-full-error.ps1" -ForegroundColor Gray
            Write-Host ""
            Write-Host "If it's still the same error, try:" -ForegroundColor Yellow
            Write-Host "  1. Wait 2-3 more minutes for IAM propagation" -ForegroundColor Gray
            Write-Host "  2. Or update Lambda function code to force a fresh cold start" -ForegroundColor Gray
        } else {
            Write-Host "Status: $($response.statusCode)" -ForegroundColor Yellow
            Write-Host "Response: $($response.body)" -ForegroundColor Gray
        }
        
        Remove-Item -Force "lambda-response.json" -ErrorAction SilentlyContinue
    }
} else {
    Write-Host "Failed to invoke Lambda: $result" -ForegroundColor Red
}

