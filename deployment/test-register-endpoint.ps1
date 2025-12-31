# Test register endpoint specifically

$API_URL = "https://e65w7up0h8.execute-api.ap-south-1.amazonaws.com"

Write-Host "=== Testing Register Endpoint ===" -ForegroundColor Cyan
Write-Host ""

# Test 1: Health (should work)
Write-Host "1. Testing /health (baseline)..." -ForegroundColor Yellow
try {
    $health = Invoke-WebRequest -Uri "$API_URL/health" -UseBasicParsing
    Write-Host "   ✅ Health: $($health.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Health failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 2: Register endpoint
Write-Host "2. Testing /api/auth/register..." -ForegroundColor Yellow

$testEmail = "test$(Get-Random)@test.com"
$registerBody = @{
    name = "Test User"
    email = $testEmail
    password = "test123456"
} | ConvertTo-Json

Write-Host "   Email: $testEmail" -ForegroundColor Gray
Write-Host "   Body: $registerBody" -ForegroundColor Gray
Write-Host ""

try {
    $register = Invoke-WebRequest `
        -Uri "$API_URL/api/auth/register" `
        -Method POST `
        -Body $registerBody `
        -ContentType "application/json" `
        -UseBasicParsing `
        -ErrorAction Stop
    
    Write-Host "   ✅ Register: $($register.StatusCode)" -ForegroundColor Green
    Write-Host "   Response: $($register.Content)" -ForegroundColor Gray
} catch {
    $statusCode = $null
    $responseBody = ""
    $responseHeaders = @{}
    
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        
        # Get response headers
        $_.Exception.Response.Headers.GetEnumerator() | ForEach-Object {
            $responseHeaders[$_.Key] = $_.Value
        }
        
        # Get response body
        try {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            $reader.Close()
        } catch {
            $responseBody = "Could not read response body"
        }
    }
    
    Write-Host "   ❌ Register failed!" -ForegroundColor Red
    Write-Host "   Status Code: $statusCode" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   Response Headers:" -ForegroundColor Cyan
    if ($responseHeaders.Count -gt 0) {
        $responseHeaders.GetEnumerator() | ForEach-Object {
            Write-Host "     $($_.Key): $($_.Value)" -ForegroundColor Gray
        }
    } else {
        Write-Host "     (No headers)" -ForegroundColor Gray
    }
    Write-Host ""
    Write-Host "   Response Body:" -ForegroundColor Cyan
    if ($responseBody) {
        Write-Host "     $responseBody" -ForegroundColor Gray
    } else {
        Write-Host "     (Empty)" -ForegroundColor Gray
    }
    
    Write-Host ""
    Write-Host "   Exception:" -ForegroundColor Cyan
    Write-Host "     $($_.Exception.Message)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "=== Comparison ===" -ForegroundColor Cyan
Write-Host "If /health works but /api/auth/register doesn't:" -ForegroundColor Yellow
Write-Host "  - Check if route /api/auth/register is configured" -ForegroundColor Gray
Write-Host "  - Check Lambda logs for register endpoint errors" -ForegroundColor Gray
Write-Host "  - Check if request body format is correct" -ForegroundColor Gray

