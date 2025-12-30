# Test Lambda Function Directly (Bypass API Gateway)

$LAMBDA_FUNCTION = "hisab-api"
$AWS_REGION = "ap-south-1"

Write-Host "=== Testing Lambda Function Directly ===" -ForegroundColor Cyan
Write-Host ""

# Create test event payload (API Gateway HTTP API v2.0 format)
$testEmail = "test$(Get-Random)@test.com"
$bodyJson = (@{
    name = "Test User"
    email = $testEmail
    password = "test123"
} | ConvertTo-Json -Compress)

$testPayload = @{
    version = "2.0"
    routeKey = "POST /api/auth/register"
    rawPath = "/api/auth/register"
    rawQueryString = ""
    headers = @{
        "content-type" = "application/json"
        "host" = "e65w7up0h8.execute-api.ap-south-1.amazonaws.com"
    }
    requestContext = @{
        accountId = "294618942342"
        apiId = "e65w7up0h8"
        domainName = "e65w7up0h8.execute-api.ap-south-1.amazonaws.com"
        domainPrefix = "e65w7up0h8"
        http = @{
            method = "POST"
            path = "/api/auth/register"
            protocol = "HTTP/1.1"
            sourceIp = "127.0.0.1"
            userAgent = "test"
        }
        requestId = "test-request-id"
        routeKey = "POST /api/auth/register"
        stage = "`$default"
        time = "30/Dec/2025:18:00:00 +0000"
        timeEpoch = 1735574400000
    }
    body = $bodyJson
    isBase64Encoded = $false
} | ConvertTo-Json -Depth 10

# Save to file
$testPayload | Out-File -FilePath "lambda-test-payload.json" -Encoding UTF8

Write-Host "Test payload:" -ForegroundColor Yellow
Write-Host $testPayload -ForegroundColor Gray
Write-Host ""

Write-Host "Invoking Lambda function..." -ForegroundColor Yellow
Write-Host ""

# Invoke Lambda
$result = aws lambda invoke `
    --function-name $LAMBDA_FUNCTION `
    --region $AWS_REGION `
    --payload "file://lambda-test-payload.json" `
    --log-type Tail `
    lambda-response.json 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Lambda invoked successfully!" -ForegroundColor Green
    Write-Host ""
    
    # Parse result
    $resultJson = $result | ConvertFrom-Json -ErrorAction SilentlyContinue
    
    # Show response
    if (Test-Path "lambda-response.json") {
        Write-Host "=== Lambda Response ===" -ForegroundColor Cyan
        $response = Get-Content "lambda-response.json" -Raw | ConvertFrom-Json
        Write-Host ($response | ConvertTo-Json -Depth 10) -ForegroundColor White
        Write-Host ""
    }
    
    # Decode and show logs
    if ($resultJson.LogResult) {
        Write-Host "=== Lambda Logs ===" -ForegroundColor Cyan
        $logBytes = [System.Convert]::FromBase64String($resultJson.LogResult)
        $logs = [System.Text.Encoding]::UTF8.GetString($logBytes)
        Write-Host $logs -ForegroundColor Gray
        
        # Check for errors
        if ($logs -match "UnrecognizedClientException") {
            Write-Host ""
            Write-Host "❌ Still seeing UnrecognizedClientException!" -ForegroundColor Red
            Write-Host "This confirms it's a Lambda/DynamoDB permissions issue." -ForegroundColor Yellow
        } elseif ($logs -match "ERROR|Exception") {
            Write-Host ""
            Write-Host "⚠️  Error found in logs (see above)" -ForegroundColor Yellow
        } else {
            Write-Host ""
            Write-Host "✅ No errors in logs!" -ForegroundColor Green
        }
    }
    
    # Cleanup
    Remove-Item -Force "lambda-response.json" -ErrorAction SilentlyContinue
} else {
    Write-Host "❌ Failed to invoke Lambda" -ForegroundColor Red
    Write-Host $result -ForegroundColor Gray
}

# Cleanup
Remove-Item -Force "lambda-test-payload.json" -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "=== Next Steps ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "If Lambda works directly:" -ForegroundColor Yellow
Write-Host "  - The issue is with API Gateway configuration" -ForegroundColor White
Write-Host ""
Write-Host "If Lambda fails with UnrecognizedClientException:" -ForegroundColor Yellow
Write-Host "  - The issue is with Lambda IAM role permissions" -ForegroundColor White
Write-Host "  - Verify role has AmazonDynamoDBFullAccess" -ForegroundColor White
Write-Host "  - Redeploy Lambda: .\deployment\build-lambda-docker.ps1" -ForegroundColor White

