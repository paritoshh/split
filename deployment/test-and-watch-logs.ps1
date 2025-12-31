# Test register endpoint and immediately watch logs

$API_URL = "https://e65w7up0h8.execute-api.ap-south-1.amazonaws.com"
$LAMBDA_FUNCTION = "hisab-api-v2"
$AWS_REGION = "ap-south-1"

Write-Host "=== Testing Register and Watching Logs ===" -ForegroundColor Cyan
Write-Host ""

# Get current timestamp
$beforeTime = Get-Date

Write-Host "Sending request at: $($beforeTime.ToString('HH:mm:ss'))" -ForegroundColor Yellow
Write-Host ""

# Send request
$testEmail = "test$(Get-Random)@test.com"
$body = @{
    name = "Test User"
    email = $testEmail
    password = "test123456"
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest `
        -Uri "$API_URL/api/auth/register" `
        -Method POST `
        -Body $body `
        -ContentType "application/json" `
        -UseBasicParsing `
        -ErrorAction Stop
    
    Write-Host "✅ Success: $($response.StatusCode)" -ForegroundColor Green
} catch {
    $statusCode = $null
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
    }
    Write-Host "❌ Failed: $statusCode" -ForegroundColor Red
}

Write-Host ""
Write-Host "Waiting 5 seconds for logs to appear..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "=== Checking Lambda Logs ===" -ForegroundColor Cyan

# Get logs from the last 2 minutes
$logs = aws logs tail "/aws/lambda/$LAMBDA_FUNCTION" --since 2m --region $AWS_REGION --format short 2>&1

if ($logs) {
    # Filter for our test request
    $relevantLogs = $logs | Select-String -Pattern "Lambda Invoked|Path:|Method:|Status:|Result|ERROR|Exception|$testEmail" -Context 1
    
    if ($relevantLogs) {
        Write-Host "Found relevant logs:" -ForegroundColor Green
        Write-Host $relevantLogs -ForegroundColor Gray
    } else {
        Write-Host "No relevant logs found for this request" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "This suggests the request might not be reaching Lambda!" -ForegroundColor Red
        Write-Host ""
        Write-Host "Recent logs:" -ForegroundColor Yellow
        Write-Host $logs -ForegroundColor Gray
    }
} else {
    Write-Host "No logs found at all" -ForegroundColor Red
    Write-Host "This strongly suggests the request is not reaching Lambda" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Check Lambda Monitor Tab ===" -ForegroundColor Cyan
Write-Host "Go to Lambda Console -> hisab-api-v2 -> Monitor tab" -ForegroundColor Yellow
Write-Host "Check if 'Invocations' count increased" -ForegroundColor Yellow
Write-Host "If not, the request is not reaching Lambda" -ForegroundColor Yellow

