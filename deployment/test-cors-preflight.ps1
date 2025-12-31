# Test CORS preflight (OPTIONS request)

$API_URL = "https://e65w7up0h8.execute-api.ap-south-1.amazonaws.com"

Write-Host "=== Testing CORS Preflight ===" -ForegroundColor Cyan
Write-Host ""

# Test OPTIONS request (CORS preflight)
Write-Host "1. Testing OPTIONS request (CORS preflight)..." -ForegroundColor Yellow

$headers = @{
    "Origin" = "https://hisab.paritoshagarwal.com"
    "Access-Control-Request-Method" = "POST"
    "Access-Control-Request-Headers" = "content-type"
}

try {
    $optionsResponse = Invoke-WebRequest `
        -Uri "$API_URL/api/auth/register" `
        -Method OPTIONS `
        -Headers $headers `
        -UseBasicParsing `
        -ErrorAction Stop
    
    Write-Host "   ✅ OPTIONS: $($optionsResponse.StatusCode)" -ForegroundColor Green
    Write-Host "   Headers:" -ForegroundColor Gray
    $optionsResponse.Headers.GetEnumerator() | ForEach-Object {
        Write-Host "     $($_.Key): $($_.Value)" -ForegroundColor Gray
    }
} catch {
    $statusCode = $null
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
    }
    Write-Host "   ❌ OPTIONS failed: $statusCode" -ForegroundColor Red
    Write-Host "   This might be causing the 500 error!" -ForegroundColor Yellow
}

Write-Host ""

# Test actual POST request
Write-Host "2. Testing POST request..." -ForegroundColor Yellow

$body = @{
    name = "Test User"
    email = "test$(Get-Random)@test.com"
    password = "test123456"
} | ConvertTo-Json

try {
    $postResponse = Invoke-WebRequest `
        -Uri "$API_URL/api/auth/register" `
        -Method POST `
        -Body $body `
        -ContentType "application/json" `
        -Headers @{"Origin" = "https://hisab.paritoshagarwal.com"} `
        -UseBasicParsing `
        -ErrorAction Stop
    
    Write-Host "   ✅ POST: $($postResponse.StatusCode)" -ForegroundColor Green
    Write-Host "   Response: $($postResponse.Content)" -ForegroundColor Gray
} catch {
    $statusCode = $null
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
    }
    Write-Host "   ❌ POST failed: $statusCode" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Note ===" -ForegroundColor Cyan
Write-Host "If OPTIONS fails, API Gateway might be blocking the request" -ForegroundColor Yellow
Write-Host "Check if CORS is configured in API Gateway (not just Lambda)" -ForegroundColor Yellow

