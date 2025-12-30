# Trigger Lambda and check logs immediately

$LAMBDA_FUNCTION = "hisab-api-v2"
$AWS_REGION = "ap-south-1"

Write-Host "=== Triggering Lambda and Checking Logs ===" -ForegroundColor Cyan
Write-Host ""

# Create test payload as JSON string directly
$testPayloadJson = '{"version":"2.0","routeKey":"POST /api/auth/register","rawPath":"/api/auth/register","headers":{"content-type":"application/json"},"requestContext":{"accountId":"294618942342","apiId":"e65w7up0h8","http":{"method":"POST","path":"/api/auth/register"}},"body":"{\"name\":\"Test User\",\"email\":\"test@test.com\",\"password\":\"test123\"}","isBase64Encoded":false}'

$testPayloadJson | Out-File -FilePath "lambda-trigger.json" -Encoding ASCII -NoNewline

Write-Host "Invoking Lambda..." -ForegroundColor Yellow
Write-Host ""

# Invoke Lambda
$result = aws lambda invoke `
    --function-name $LAMBDA_FUNCTION `
    --region $AWS_REGION `
    --payload "file://lambda-trigger.json" `
    --log-type Tail `
    lambda-response.json 2>&1

Remove-Item -Force "lambda-trigger.json" -ErrorAction SilentlyContinue

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Lambda invoked" -ForegroundColor Green
    Write-Host ""
    
    # Decode logs
    $resultJson = $result | ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($resultJson.LogResult) {
        Write-Host "=== Lambda Logs ===" -ForegroundColor Cyan
        $logBytes = [System.Convert]::FromBase64String($resultJson.LogResult)
        $logs = [System.Text.Encoding]::UTF8.GetString($logBytes)
        Write-Host $logs -ForegroundColor Gray
        Write-Host ""
        
        # Check for credential logging
        if ($logs -match "Using explicit AWS credentials") {
            Write-Host "❌ Lambda is using explicit credentials!" -ForegroundColor Red
            Write-Host "Check Lambda environment variables for AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY" -ForegroundColor Yellow
        } elseif ($logs -match "Using IAM role") {
            Write-Host "✅ Lambda is using IAM role (correct)" -ForegroundColor Green
            Write-Host ""
            if ($logs -match "UnrecognizedClientException") {
                Write-Host "❌ Still getting UnrecognizedClientException with IAM role" -ForegroundColor Red
                Write-Host "This suggests the IAM role permissions aren't working." -ForegroundColor Yellow
            }
        } else {
            Write-Host "⚠️  No credential logging found in logs" -ForegroundColor Yellow
            Write-Host "The DynamoDB client might not be initializing, or logging isn't working." -ForegroundColor Gray
        }
        
        # Check for errors
        if ($logs -match "ERROR|Exception") {
            Write-Host ""
            Write-Host "=== Errors Found ===" -ForegroundColor Red
            $errorLines = $logs | Select-String -Pattern "ERROR|Exception" -Context 2,5
            Write-Host $errorLines -ForegroundColor Red
        }
    }
    
    Remove-Item -Force "lambda-response.json" -ErrorAction SilentlyContinue
} else {
    Write-Host "❌ Failed to invoke Lambda" -ForegroundColor Red
    Write-Host $result -ForegroundColor Gray
}

Write-Host ""
Write-Host "=== Also Check CloudWatch Logs ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Run: aws logs tail /aws/lambda/$LAMBDA_FUNCTION --since 1m --region $AWS_REGION" -ForegroundColor White

