# Test if bcrypt is working in Lambda

$LAMBDA_FUNCTION = "hisab-api-v2"
$AWS_REGION = "ap-south-1"

Write-Host "=== Testing bcrypt in Lambda ===" -ForegroundColor Cyan
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
    body = '{"name":"Test User","email":"test' + (Get-Random) + '@test.com","password":"test123"}'
    isBase64Encoded = $false
} | ConvertTo-Json -Depth 10

$testEvent | Out-File -FilePath "bcrypt-test.json" -Encoding ASCII -NoNewline

Write-Host "Testing register endpoint (this will fail if bcrypt is missing)..." -ForegroundColor Yellow
Write-Host ""

$result = aws lambda invoke `
    --function-name $LAMBDA_FUNCTION `
    --region $AWS_REGION `
    --cli-binary-format raw-in-base64-out `
    --payload file://bcrypt-test.json `
    --log-type Tail `
    bcrypt-response.json 2>&1

Remove-Item -Force "bcrypt-test.json" -ErrorAction SilentlyContinue

if ($LASTEXITCODE -eq 0) {
    $resultJson = $result | ConvertFrom-Json
    if ($resultJson.LogResult) {
        $logBytes = [System.Convert]::FromBase64String($resultJson.LogResult)
        $logs = [System.Text.Encoding]::UTF8.GetString($logBytes)
        
        Write-Host "=== Lambda Logs ===" -ForegroundColor Cyan
        Write-Host $logs -ForegroundColor Gray
        Write-Host ""
        
        if ($logs -match "MissingBackendError.*bcrypt") {
            Write-Host "❌ bcrypt is still missing!" -ForegroundColor Red
            Write-Host ""
            Write-Host "The package might not include bcrypt." -ForegroundColor Yellow
            Write-Host "Try rebuilding with verbose output to see what's happening." -ForegroundColor White
        } elseif ($logs -match "UnrecognizedClientException") {
            Write-Host "❌ DynamoDB error (but bcrypt might be working)" -ForegroundColor Yellow
        } elseif ($logs -match "statusCode.*200|statusCode.*201") {
            Write-Host "✅ SUCCESS! Lambda is working!" -ForegroundColor Green
        } else {
            Write-Host "Check logs above for the actual error" -ForegroundColor Yellow
        }
    }
    
    Remove-Item -Force "bcrypt-response.json" -ErrorAction SilentlyContinue
} else {
    Write-Host "❌ Failed to invoke Lambda" -ForegroundColor Red
}

