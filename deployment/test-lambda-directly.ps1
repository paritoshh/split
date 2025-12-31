# Test Lambda function directly (bypass API Gateway)

$LAMBDA_FUNCTION = "hisab-api-v2"
$AWS_REGION = "ap-south-1"

Write-Host "=== Testing Lambda Function Directly ===" -ForegroundColor Cyan
Write-Host ""

# Create a test event that mimics API Gateway HTTP API v2.0
$testEvent = @{
    version = "2.0"
    routeKey = "POST /api/auth/register"
    rawPath = "/api/auth/register"
    headers = @{
        "content-type" = "application/json"
        "host" = "e65w7up0h8.execute-api.ap-south-1.amazonaws.com"
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

# Save to file
$testEvent | Out-File -FilePath "lambda-test-event.json" -Encoding ASCII -NoNewline

Write-Host "Invoking Lambda function directly..." -ForegroundColor Yellow
Write-Host ""

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
    Write-Host "✅ Lambda invocation successful" -ForegroundColor Green
    Write-Host ""
    
    # Parse response
    if (Test-Path "lambda-response.json") {
        $response = Get-Content "lambda-response.json" | ConvertFrom-Json
        
        Write-Host "=== Lambda Response ===" -ForegroundColor Cyan
        Write-Host $response | ConvertTo-Json -Depth 10 -ForegroundColor Gray
        Write-Host ""
        
        # Check status code
        if ($response.statusCode) {
            if ($response.statusCode -eq 200 -or $response.statusCode -eq 201) {
                Write-Host "✅ Status: $($response.statusCode) - SUCCESS!" -ForegroundColor Green
            } else {
                Write-Host "❌ Status: $($response.statusCode)" -ForegroundColor Red
            }
        }
        
        # Check body
        if ($response.body) {
            Write-Host "Response Body: $($response.body)" -ForegroundColor Gray
        }
        
        Remove-Item -Force "lambda-response.json" -ErrorAction SilentlyContinue
    }
    
    # Check logs from the invocation
    Write-Host ""
    Write-Host "=== Checking Logs ===" -ForegroundColor Cyan
    
    # Wait a moment for logs
    Start-Sleep -Seconds 2
    
    $logs = aws logs tail "/aws/lambda/$LAMBDA_FUNCTION" --since 1m --region $AWS_REGION 2>&1
    
    if ($logs) {
        Write-Host $logs -ForegroundColor Gray
    } else {
        Write-Host "No logs found" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ Lambda invocation failed" -ForegroundColor Red
    Write-Host $result -ForegroundColor Red
}
