# Test register and login endpoints directly

$API_URL = "https://e65w7up0h8.execute-api.ap-south-1.amazonaws.com"

Write-Host "=== Testing Register and Login Endpoints ===" -ForegroundColor Cyan
Write-Host ""

# Test 1: Register
Write-Host "1. Testing /api/auth/register..." -ForegroundColor Yellow
$registerData = @{
    email = "test$(Get-Random)@example.com"
    name = "Test User"
    password = "test123456"
} | ConvertTo-Json

try {
    $registerResponse = Invoke-WebRequest `
        -Uri "$API_URL/api/auth/register" `
        -Method POST `
        -ContentType "application/json" `
        -Body $registerData `
        -ErrorAction Stop
    
    Write-Host "   ✅ Register Success: $($registerResponse.StatusCode)" -ForegroundColor Green
    $registerBody = $registerResponse.Content | ConvertFrom-Json
    Write-Host "   User ID: $($registerBody.id)" -ForegroundColor Gray
    Write-Host "   Email: $($registerBody.email)" -ForegroundColor Gray
    $testEmail = $registerBody.email
    $testPassword = "test123456"
} catch {
    Write-Host "   ❌ Register Failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "   Status Code: $statusCode" -ForegroundColor Red
        
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "   Response: $responseBody" -ForegroundColor Yellow
    }
    $testEmail = "test@example.com"
    $testPassword = "test123456"
}

Write-Host ""

# Test 2: Login
Write-Host "2. Testing /api/auth/login..." -ForegroundColor Yellow
Write-Host "   Email: $testEmail" -ForegroundColor Gray

try {
    $loginResponse = Invoke-WebRequest `
        -Uri "$API_URL/api/auth/login" `
        -Method POST `
        -ContentType "application/x-www-form-urlencoded" `
        -Body "username=$testEmail&password=$testPassword" `
        -ErrorAction Stop
    
    Write-Host "   ✅ Login Success: $($loginResponse.StatusCode)" -ForegroundColor Green
    $loginBody = $loginResponse.Content | ConvertFrom-Json
    Write-Host "   Token received: $($loginBody.access_token.Substring(0, 20))..." -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Login Failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "   Status Code: $statusCode" -ForegroundColor Red
        
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "   Response: $responseBody" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "=== Next Steps ===" -ForegroundColor Cyan
Write-Host "If both failed, check:" -ForegroundColor Yellow
Write-Host "1. Lambda function status: aws lambda get-function --function-name hisab-api-v2" -ForegroundColor Gray
Write-Host "2. API Gateway integration" -ForegroundColor Gray
Write-Host "3. Lambda was rebuilt after latest changes" -ForegroundColor Gray

