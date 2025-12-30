# Test API Gateway Endpoints

Write-Host "=== Testing API Gateway ===" -ForegroundColor Green
Write-Host ""

# Test 1: Health endpoint
Write-Host "1. Testing /health endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "https://2cjvid84h1.execute-api.ap-south-1.amazonaws.com/health" -Method GET
    Write-Host "   Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "   Response: $($response.Content)" -ForegroundColor Gray
} catch {
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "   Response: $responseBody" -ForegroundColor Gray
    }
}

Write-Host ""

# Test 2: Register endpoint
Write-Host "2. Testing /api/auth/register endpoint..." -ForegroundColor Yellow
$registerData = @{
    name = "Test User"
    email = "test$(Get-Random)@test.com"
    password = "test123"
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest `
        -Uri "https://2cjvid84h1.execute-api.ap-south-1.amazonaws.com/api/auth/register" `
        -Method POST `
        -ContentType "application/json" `
        -Body $registerData
    
    Write-Host "   Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "   Response: $($response.Content)" -ForegroundColor Gray
} catch {
    Write-Host "   Status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $responseBody = $reader.ReadToEnd()
    Write-Host "   Response: $responseBody" -ForegroundColor Gray
}

Write-Host ""

