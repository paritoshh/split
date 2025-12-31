# Test API Gateway directly

$API_URL = "https://e65w7up0h8.execute-api.ap-south-1.amazonaws.com"

Write-Host "=== Testing API Gateway ===" -ForegroundColor Cyan
Write-Host ""

# Test 1: Health endpoint
Write-Host "1. Testing /health endpoint..." -ForegroundColor Yellow
try {
    $healthResponse = Invoke-WebRequest -Uri "$API_URL/health" -Method GET -UseBasicParsing
    Write-Host "   ✅ Status: $($healthResponse.StatusCode)" -ForegroundColor Green
    Write-Host "   Response: $($healthResponse.Content)" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "   Status Code: $statusCode" -ForegroundColor Yellow
    }
}

Write-Host ""

# Test 2: Register endpoint
Write-Host "2. Testing /api/auth/register endpoint..." -ForegroundColor Yellow

$testEmail = "test$(Get-Random)@test.com"
$registerBody = @{
    name = "Test User"
    email = $testEmail
    password = "test123456"
} | ConvertTo-Json

try {
    $registerResponse = Invoke-WebRequest `
        -Uri "$API_URL/api/auth/register" `
        -Method POST `
        -Body $registerBody `
        -ContentType "application/json" `
        -UseBasicParsing `
        -ErrorAction Stop

    Write-Host "   ✅ Status: $($registerResponse.StatusCode)" -ForegroundColor Green
    Write-Host "   Response: $($registerResponse.Content)" -ForegroundColor Gray
} catch {
    $statusCode = $null
    $responseBody = ""
    
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        try {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            $reader.Close()
        } catch {
            $responseBody = "Could not read response"
        }
    }
    
    Write-Host "   ❌ Status: $statusCode" -ForegroundColor Red
    Write-Host "   Response: $responseBody" -ForegroundColor Gray
    
    if ($responseBody -match "CORS") {
        Write-Host ""
        Write-Host "   ⚠️  CORS Error detected!" -ForegroundColor Yellow
        Write-Host "   Check Lambda CORS settings and ALLOWED_ORIGINS" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "=== Next Steps ===" -ForegroundColor Cyan
Write-Host "If health works but register fails, check:" -ForegroundColor Yellow
Write-Host "  1. API Gateway route configuration" -ForegroundColor Gray
Write-Host "  2. Lambda integration settings" -ForegroundColor Gray
Write-Host "  3. CORS settings in Lambda" -ForegroundColor Gray

