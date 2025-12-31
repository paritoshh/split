# Test Lambda directly and check response format

$LAMBDA_FUNCTION = "hisab-api-v2"
$AWS_REGION = "ap-south-1"

Write-Host "=== Testing Lambda Response Format ===" -ForegroundColor Cyan
Write-Host ""

# Create test event matching API Gateway HTTP API v2.0
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

$testEvent | Out-File -FilePath "lambda-test-event.json" -Encoding ASCII -NoNewline

Write-Host "Invoking Lambda directly..." -ForegroundColor Yellow
$result = aws lambda invoke `
    --function-name $LAMBDA_FUNCTION `
    --region $AWS_REGION `
    --cli-binary-format raw-in-base64-out `
    --payload file://lambda-test-event.json `
    lambda-response.json 2>&1

Remove-Item -Force "lambda-test-event.json" -ErrorAction SilentlyContinue

if ($LASTEXITCODE -eq 0 -and (Test-Path "lambda-response.json")) {
    $response = Get-Content "lambda-response.json" | ConvertFrom-Json
    
    Write-Host ""
    Write-Host "=== Lambda Response ===" -ForegroundColor Cyan
    $responseJson = $response | ConvertTo-Json -Depth 10
    Write-Host $responseJson -ForegroundColor Gray
    Write-Host ""
    
    # Check response format
    Write-Host "=== Response Format Check ===" -ForegroundColor Cyan
    
    $requiredFields = @("statusCode", "headers", "body")
    $missingFields = @()
    
    foreach ($field in $requiredFields) {
        if ($response.PSObject.Properties.Name -contains $field) {
            Write-Host "✅ Has $field" -ForegroundColor Green
        } else {
            Write-Host "❌ Missing $field" -ForegroundColor Red
            $missingFields += $field
        }
    }
    
    if ($response.statusCode) {
        Write-Host ""
        Write-Host "Status Code: $($response.statusCode)" -ForegroundColor $(if ($response.statusCode -eq 200 -or $response.statusCode -eq 201) { "Green" } else { "Yellow" })
    }
    
    if ($response.headers) {
        Write-Host ""
        Write-Host "Headers:" -ForegroundColor Gray
        $response.headers | ConvertTo-Json | Write-Host -ForegroundColor Gray
    }
    
    if ($response.body) {
        Write-Host ""
        Write-Host "Body (first 200 chars):" -ForegroundColor Gray
        $bodyPreview = if ($response.body.Length -gt 200) { $response.body.Substring(0, 200) + "..." } else { $response.body }
        Write-Host $bodyPreview -ForegroundColor Gray
    }
    
    if ($missingFields.Count -gt 0) {
        Write-Host ""
        Write-Host "❌ Response is missing required fields for API Gateway!" -ForegroundColor Red
        Write-Host "Missing: $($missingFields -join ', ')" -ForegroundColor Red
    } else {
        Write-Host ""
        Write-Host "✅ Response format looks correct for API Gateway HTTP API v2.0" -ForegroundColor Green
    }
    
    Remove-Item -Force "lambda-response.json" -ErrorAction SilentlyContinue
} else {
    Write-Host "❌ Failed to invoke Lambda: $result" -ForegroundColor Red
}

