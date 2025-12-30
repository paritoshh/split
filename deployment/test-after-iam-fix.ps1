# Test API after IAM policy fix
# This script tests the API and provides clear feedback

$API_BASE_URL = "https://2cjvid84h1.execute-api.ap-south-1.amazonaws.com"

Write-Host "=== Testing API After IAM Policy Fix ===" -ForegroundColor Cyan
Write-Host ""

# Test 1: Health endpoint
Write-Host "1. Testing /health endpoint..." -ForegroundColor Yellow
try {
    $healthResponse = Invoke-WebRequest -Uri "$API_BASE_URL/health" -Method GET -UseBasicParsing
    Write-Host "   ✅ Status: $($healthResponse.StatusCode)" -ForegroundColor Green
    Write-Host "   Response: $($healthResponse.Content)" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Health check failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test 2: Register endpoint (this will test DynamoDB access)
Write-Host "2. Testing /api/auth/register endpoint..." -ForegroundColor Yellow
Write-Host "   (This tests DynamoDB access)" -ForegroundColor Gray
Write-Host ""

$testEmail = "test$(Get-Random)@example.com"
$registerBody = @{
    email = $testEmail
    password = "testpassword123"
    name = "Test User $(Get-Random)"
} | ConvertTo-Json

try {
    $registerResponse = Invoke-WebRequest `
        -Uri "$API_BASE_URL/api/auth/register" `
        -Method POST `
        -Body $registerBody `
        -ContentType "application/json" `
        -UseBasicParsing `
        -ErrorAction Stop
    
    Write-Host "   ✅ Status: $($registerResponse.StatusCode)" -ForegroundColor Green
    Write-Host "   Response: $($registerResponse.Content)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "🎉 SUCCESS! DynamoDB access is working!" -ForegroundColor Green
    
} catch {
    $errorResponse = $_.Exception.Response
    if ($errorResponse) {
        $statusCode = [int]$errorResponse.StatusCode
        $reader = New-Object System.IO.StreamReader($errorResponse.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        
        Write-Host "   ❌ Status: $statusCode" -ForegroundColor Red
        Write-Host "   Response: $responseBody" -ForegroundColor Gray
        Write-Host ""
        
        if ($statusCode -eq 500) {
            Write-Host "⚠️  Still getting 500 error. Checking logs..." -ForegroundColor Yellow
            Write-Host ""
            Write-Host "Run this to see detailed error:" -ForegroundColor Cyan
            Write-Host "   .\deployment\check-error-details.ps1" -ForegroundColor White
            Write-Host ""
            
            if ($responseBody -match "UnrecognizedClientException") {
                Write-Host "❌ Still seeing UnrecognizedClientException!" -ForegroundColor Red
                Write-Host ""
                Write-Host "Possible issues:" -ForegroundColor Yellow
                Write-Host "1. IAM policy not saved correctly" -ForegroundColor White
                Write-Host "2. Need to wait longer for IAM propagation (try 2-3 minutes)" -ForegroundColor White
                Write-Host "3. Check if policy JSON has any syntax errors" -ForegroundColor White
                Write-Host "4. Verify the inline policy is actually attached to the role" -ForegroundColor White
            }
        } elseif ($statusCode -eq 400) {
            Write-Host "⚠️  Got 400 (Bad Request)" -ForegroundColor Yellow
            Write-Host "   This might mean the user already exists, but DynamoDB access is working!" -ForegroundColor Green
        }
    } else {
        Write-Host "   ❌ Error: $_" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== Next Steps ===" -ForegroundColor Cyan
Write-Host "If still failing:" -ForegroundColor Yellow
Write-Host "1. Check error details: .\deployment\check-error-details.ps1" -ForegroundColor White
Write-Host "2. Verify policy in AWS Console (make sure it's saved)" -ForegroundColor White
Write-Host "3. Wait 2-3 minutes and try again (IAM can take time to propagate)" -ForegroundColor White
Write-Host "4. Check CloudWatch logs: .\deployment\check-logs.ps1" -ForegroundColor White

