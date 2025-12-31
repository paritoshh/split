# Test Lambda Function Directly (Without API Gateway)

$LAMBDA_FUNCTION = "hisab-api-v2"
$AWS_REGION = "ap-south-1"

Write-Host "=== Testing Lambda Directly (No API Gateway) ===" -ForegroundColor Cyan
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
        time = "30/Dec/2025:19:00:00 +0000"
        timeEpoch = 1735574400000
    }
    body = $bodyJson
    isBase64Encoded = $false
} | ConvertTo-Json -Depth 10

# Save to file
$testPayload | Out-File -FilePath "lambda-test.json" -Encoding ASCII -NoNewline

Write-Host "Test payload created" -ForegroundColor Gray
Write-Host "Testing with email: $testEmail" -ForegroundColor Gray
Write-Host ""
Write-Host "Invoking Lambda directly..." -ForegroundColor Yellow
Write-Host ""

# Invoke Lambda
$result = aws lambda invoke `
    --function-name $LAMBDA_FUNCTION `
    --region $AWS_REGION `
    --cli-binary-format raw-in-base64-out `
    --payload file://lambda-test.json `
    --log-type Tail `
    lambda-response.json 2>&1

# Cleanup
Remove-Item -Force "lambda-test.json" -ErrorAction SilentlyContinue

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Lambda invoked successfully" -ForegroundColor Green
    Write-Host ""
    
    # Show response
    if (Test-Path "lambda-response.json") {
        Write-Host "=== Lambda Response ===" -ForegroundColor Cyan
        $response = Get-Content "lambda-response.json" -Raw | ConvertFrom-Json
        Write-Host ($response | ConvertTo-Json -Depth 10) -ForegroundColor White
        Write-Host ""
        
        # Check status code
        if ($response.statusCode -eq 200 -or $response.statusCode -eq 201) {
            Write-Host "✅ SUCCESS! Lambda returned status $($response.statusCode)" -ForegroundColor Green
        } elseif ($response.statusCode -eq 500) {
            Write-Host "❌ Lambda returned 500 error" -ForegroundColor Red
        }
        
        Remove-Item -Force "lambda-response.json" -ErrorAction SilentlyContinue
    }
    
    # Decode and show logs
    $resultJson = $result | ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($resultJson.LogResult) {
        Write-Host "=== Lambda Execution Logs ===" -ForegroundColor Cyan
        $logBytes = [System.Convert]::FromBase64String($resultJson.LogResult)
        $logs = [System.Text.Encoding]::UTF8.GetString($logBytes)
        Write-Host $logs -ForegroundColor Gray
        Write-Host ""
        
        # Check for errors
        if ($logs -match "UnrecognizedClientException") {
            Write-Host "❌ Still seeing UnrecognizedClientException!" -ForegroundColor Red
            Write-Host "This means the issue is in Lambda, not API Gateway." -ForegroundColor Yellow
        } elseif ($logs -match "ERROR|Exception") {
            Write-Host ""
            Write-Host "=== Error Found ===" -ForegroundColor Red
            $errorLines = $logs | Select-String -Pattern "ERROR|Exception" -Context 2,10
            Write-Host $errorLines -ForegroundColor Red
        } else {
            Write-Host "✅ No errors in logs" -ForegroundColor Green
        }
    }
} else {
    Write-Host "❌ Failed to invoke Lambda" -ForegroundColor Red
    Write-Host $result -ForegroundColor Gray
}

Write-Host ""
Write-Host "=== Interpretation ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "If Lambda works here but fails via API Gateway:" -ForegroundColor Yellow
Write-Host "  → Issue is with API Gateway configuration" -ForegroundColor White
Write-Host ""
Write-Host "If Lambda fails here too:" -ForegroundColor Yellow
Write-Host "  → Issue is with Lambda code/IAM permissions" -ForegroundColor White

