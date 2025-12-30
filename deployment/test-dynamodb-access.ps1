# Test if Lambda can access DynamoDB
# This script invokes a test Lambda function to check DynamoDB access

$API_BASE_URL = "https://2cjvid84h1.execute-api.ap-south-1.amazonaws.com"

Write-Host "=== Testing Lambda DynamoDB Access ===" -ForegroundColor Cyan
Write-Host ""

# Test the /health endpoint first
Write-Host "1. Testing /health endpoint..." -ForegroundColor Yellow
$healthResponse = Invoke-WebRequest -Uri "$API_BASE_URL/health" -Method GET -UseBasicParsing -ErrorAction SilentlyContinue

if ($healthResponse.StatusCode -eq 200) {
    Write-Host "✅ Health endpoint working" -ForegroundColor Green
} else {
    Write-Host "❌ Health endpoint failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "2. Testing /api/auth/register endpoint (this will fail if DynamoDB access is broken)..." -ForegroundColor Yellow

$registerBody = @{
    email = "test@example.com"
    password = "testpassword123"
    name = "Test User"
} | ConvertTo-Json

try {
    $registerResponse = Invoke-WebRequest `
        -Uri "$API_BASE_URL/api/auth/register" `
        -Method POST `
        -Body $registerBody `
        -ContentType "application/json" `
        -UseBasicParsing `
        -ErrorAction Stop
    
    if ($registerResponse.StatusCode -eq 200 -or $registerResponse.StatusCode -eq 201) {
        Write-Host "✅ Register endpoint working - DynamoDB access is OK!" -ForegroundColor Green
    } elseif ($registerResponse.StatusCode -eq 400) {
        Write-Host "⚠️  Got 400 (Bad Request) - This might be expected if user already exists" -ForegroundColor Yellow
        Write-Host "   But DynamoDB access is working!" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Got status $($registerResponse.StatusCode)" -ForegroundColor Yellow
        Write-Host "   Response: $($registerResponse.Content)" -ForegroundColor Gray
    }
} catch {
    $errorResponse = $_.Exception.Response
    if ($errorResponse) {
        $statusCode = [int]$errorResponse.StatusCode
        $reader = New-Object System.IO.StreamReader($errorResponse.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        
        if ($statusCode -eq 500) {
            Write-Host "❌ Got 500 Internal Server Error" -ForegroundColor Red
            Write-Host ""
            Write-Host "This likely means DynamoDB access is broken." -ForegroundColor Yellow
            Write-Host "Check the error details:" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "Run: .\deployment\check-error-details.ps1" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "If you see 'UnrecognizedClientException', the IAM policy needs to be fixed." -ForegroundColor Yellow
        } else {
            Write-Host "Got status $statusCode" -ForegroundColor Yellow
            Write-Host "Response: $responseBody" -ForegroundColor Gray
        }
    } else {
        Write-Host "❌ Error: $_" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== Next Steps ===" -ForegroundColor Cyan
Write-Host "If you got a 500 error, check the IAM policy in AWS Console:" -ForegroundColor Yellow
Write-Host "1. Go to: https://console.aws.amazon.com/iam/" -ForegroundColor White
Write-Host "2. Click 'Roles' → search for 'hisab-lambda-role'" -ForegroundColor White
Write-Host "3. Click on the role → Check 'Permissions' tab" -ForegroundColor White
Write-Host "4. Look for inline policy 'HisabDynamoDBAccess'" -ForegroundColor White
Write-Host "5. If missing or incorrect, use the JSON from correct-dynamodb-policy.json" -ForegroundColor White

