# Test Lambda Function DIRECTLY (No API Gateway)
# This invokes Lambda using AWS CLI, bypassing API Gateway completely

$LAMBDA_FUNCTION = "hisab-api-v2"
$AWS_REGION = "ap-south-1"

Write-Host "=== Testing Lambda DIRECTLY (No API Gateway) ===" -ForegroundColor Cyan
Write-Host "This uses 'aws lambda invoke' - completely bypasses API Gateway" -ForegroundColor Gray
Write-Host ""

# Create minimal test event (API Gateway format that Mangum expects)
$testEmail = "test$(Get-Random)@test.com"
$bodyJson = (@{
    name = "Test User"
    email = $testEmail
    password = "test123"
} | ConvertTo-Json -Compress)

# Complete API Gateway HTTP API v2.0 event format
$testEvent = @{
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
        time = "30/Dec/2025:19:00:00 +0000"
        timeEpoch = 1735574400000
    }
    body = $bodyJson
    isBase64Encoded = $false
}

# Convert to JSON and save
$testEventJson = $testEvent | ConvertTo-Json -Depth 10
$testEventJson | Out-File -FilePath "lambda-direct-test.json" -Encoding ASCII -NoNewline

Write-Host "Test email: $testEmail" -ForegroundColor Gray
Write-Host ""
Write-Host "Invoking Lambda DIRECTLY (bypassing API Gateway)..." -ForegroundColor Yellow
Write-Host ""

# Invoke Lambda directly using AWS CLI
$result = aws lambda invoke `
    --function-name $LAMBDA_FUNCTION `
    --region $AWS_REGION `
    --cli-binary-format raw-in-base64-out `
    --payload file://lambda-direct-test.json `
    --log-type Tail `
    lambda-direct-response.json 2>&1

# Cleanup
Remove-Item -Force "lambda-direct-test.json" -ErrorAction SilentlyContinue

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Lambda invoked successfully (directly, no API Gateway)" -ForegroundColor Green
    Write-Host ""
    
    # Show response
    if (Test-Path "lambda-direct-response.json") {
        Write-Host "=== Lambda Response ===" -ForegroundColor Cyan
        $response = Get-Content "lambda-direct-response.json" -Raw | ConvertFrom-Json
        Write-Host ($response | ConvertTo-Json -Depth 10) -ForegroundColor White
        Write-Host ""
        
        if ($response.statusCode -eq 200 -or $response.statusCode -eq 201) {
            Write-Host "🎉 SUCCESS! Lambda works directly!" -ForegroundColor Green
            Write-Host "This means the issue is with API Gateway, not Lambda." -ForegroundColor Yellow
        } elseif ($response.statusCode -eq 500) {
            Write-Host "❌ Lambda returned 500 (issue is in Lambda code/IAM)" -ForegroundColor Red
        }
        
        Remove-Item -Force "lambda-direct-response.json" -ErrorAction SilentlyContinue
    }
    
    # Show logs
    $resultJson = $result | ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($resultJson.LogResult) {
        Write-Host "=== Lambda Execution Logs ===" -ForegroundColor Cyan
        $logBytes = [System.Convert]::FromBase64String($resultJson.LogResult)
        $logs = [System.Text.Encoding]::UTF8.GetString($logBytes)
        Write-Host $logs -ForegroundColor Gray
        
        if ($logs -match "UnrecognizedClientException") {
            Write-Host ""
            Write-Host "❌ UnrecognizedClientException - Lambda IAM issue" -ForegroundColor Red
        } elseif ($logs -match "ERROR|Exception") {
            Write-Host ""
            Write-Host "=== Error Details ===" -ForegroundColor Red
            $logs | Select-String -Pattern "ERROR|Exception" -Context 2,10
        }
    }
} else {
    Write-Host "❌ Failed to invoke Lambda" -ForegroundColor Red
    Write-Host $result -ForegroundColor Gray
}

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host "If Lambda works here:" -ForegroundColor Yellow
Write-Host "  → Issue is with API Gateway configuration" -ForegroundColor White
Write-Host ""
Write-Host "If Lambda fails here:" -ForegroundColor Yellow
Write-Host "  → Issue is with Lambda code/IAM permissions" -ForegroundColor White

