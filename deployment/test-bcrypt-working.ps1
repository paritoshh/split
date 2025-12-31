# Test if bcrypt is actually working in Lambda by calling register endpoint

$LAMBDA_FUNCTION = "hisab-api-v2"
$AWS_REGION = "ap-south-1"
$API_URL = "https://e65w7up0h8.execute-api.ap-south-1.amazonaws.com"

Write-Host "=== Testing if bcrypt is working ===" -ForegroundColor Cyan
Write-Host ""

# Test 1: Health endpoint (should work)
Write-Host "1. Testing /health endpoint..." -ForegroundColor Yellow
try {
    $healthResponse = Invoke-WebRequest -Uri "$API_URL/health" -Method GET -UseBasicParsing
    Write-Host "   Status: $($healthResponse.StatusCode)" -ForegroundColor Green
    Write-Host "   Response: $($healthResponse.Content)" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Health check failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 2: Register endpoint (requires bcrypt)
Write-Host "2. Testing /api/auth/register endpoint (requires bcrypt)..." -ForegroundColor Yellow

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
    Write-Host "   ✅ bcrypt is working! Registration succeeded." -ForegroundColor Green
    Write-Host "   Response: $($registerResponse.Content)" -ForegroundColor Gray
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    $errorBody = $_.Exception.Response | ConvertFrom-Json -ErrorAction SilentlyContinue
    
    Write-Host "   Status: $statusCode" -ForegroundColor $(if ($statusCode -eq 400) { "Yellow" } else { "Red" })
    
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "   Response: $responseBody" -ForegroundColor Gray
        
        if ($responseBody -match "bcrypt|MissingBackendError") {
            Write-Host "   ❌ bcrypt error detected!" -ForegroundColor Red
        } elseif ($statusCode -eq 400 -and $responseBody -match "already exists|email") {
            Write-Host "   ✅ bcrypt is working! (User already exists error is expected)" -ForegroundColor Green
        } elseif ($statusCode -eq 500) {
            Write-Host "   ⚠️  Server error - check Lambda logs for details" -ForegroundColor Yellow
        }
    } else {
        Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== Next Steps ===" -ForegroundColor Cyan
Write-Host "If bcrypt error persists, check Lambda logs:" -ForegroundColor Yellow
Write-Host "  aws logs tail /aws/lambda/$LAMBDA_FUNCTION --since 5m --region $AWS_REGION" -ForegroundColor Gray

