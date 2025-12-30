# Final Test Script
# Uses the known API Gateway URL

$API_URL = "https://2cjvid84h1.execute-api.ap-south-1.amazonaws.com"

Write-Host "=== Final API Test ===" -ForegroundColor Cyan
Write-Host "API URL: $API_URL" -ForegroundColor Gray
Write-Host ""

# Test 1: Health
Write-Host "1. Testing /health..." -ForegroundColor Yellow
try {
    $health = Invoke-WebRequest -Uri "$API_URL/health" -Method GET -UseBasicParsing -TimeoutSec 10
    Write-Host "   ✅ Status: $($health.StatusCode)" -ForegroundColor Green
    Write-Host "   Response: $($health.Content)" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 2: Register
Write-Host "2. Testing /api/auth/register..." -ForegroundColor Yellow
$testEmail = "test$(Get-Random)@test.com"
$body = @{
    name = "Test User"
    email = $testEmail
    password = "test123"
} | ConvertTo-Json

try {
    $register = Invoke-WebRequest -Uri "$API_URL/api/auth/register" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing -TimeoutSec 30
    Write-Host "   ✅ Status: $($register.StatusCode)" -ForegroundColor Green
    Write-Host "   Response: $($register.Content)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "🎉 SUCCESS! Registration works!" -ForegroundColor Green
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "   ❌ Status: $statusCode" -ForegroundColor Red
    
    if ($statusCode -eq 500) {
        Write-Host ""
        Write-Host "Still getting 500 error. Checking latest logs..." -ForegroundColor Yellow
        Write-Host ""
        
        # Get latest error
        $logs = aws logs tail /aws/lambda/hisab-api --since 1m --format short 2>&1
        if ($logs -match "UnrecognizedClientException") {
            Write-Host "❌ Error: UnrecognizedClientException" -ForegroundColor Red
            Write-Host ""
            Write-Host "This means the Lambda can't authenticate with DynamoDB." -ForegroundColor Yellow
            Write-Host ""
            Write-Host "SOLUTION: Update IAM policy with your ACTUAL account ID:" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "1. Go to IAM Console -> Roles -> hisab-lambda-role" -ForegroundColor White
            Write-Host "2. Find inline policy 'HisabDynamoDBAccess'" -ForegroundColor White
            Write-Host "3. Edit and replace the Resource ARN with:" -ForegroundColor White
            Write-Host ""
            Write-Host '   "arn:aws:dynamodb:ap-south-1:294618942342:table/hisab_*"' -ForegroundColor Green
            Write-Host '   "arn:aws:dynamodb:ap-south-1:294618942342:table/hisab_*/index/*"' -ForegroundColor Green
            Write-Host ""
            Write-Host "   (Use 294618942342 instead of *)" -ForegroundColor Yellow
        } else {
            Write-Host "Error details:" -ForegroundColor Yellow
            Write-Host $logs -ForegroundColor Gray
        }
    }
}

