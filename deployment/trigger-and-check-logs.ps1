# Trigger Lambda and immediately check logs

$LAMBDA_FUNCTION = "hisab-api-v2"
$AWS_REGION = "ap-south-1"
$API_URL = "https://e65w7up0h8.execute-api.ap-south-1.amazonaws.com"

Write-Host "=== Triggering Register Endpoint ===" -ForegroundColor Cyan
Write-Host ""

$testEmail = "test$(Get-Random)@test.com"
$registerBody = @{
    name = "Test User"
    email = $testEmail
    password = "test123456"
} | ConvertTo-Json

Write-Host "Email: $testEmail" -ForegroundColor Gray
Write-Host ""

# Trigger the request
try {
    $response = Invoke-WebRequest `
        -Uri "$API_URL/api/auth/register" `
        -Method POST `
        -Body $registerBody `
        -ContentType "application/json" `
        -UseBasicParsing `
        -ErrorAction Stop
    
    Write-Host "✅ Success! Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($response.Content)" -ForegroundColor Gray
} catch {
    $statusCode = $null
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
    }
    Write-Host "❌ Error! Status: $statusCode" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Waiting 2 seconds for logs to propagate ===" -ForegroundColor Yellow
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "=== Checking ALL Recent Logs ===" -ForegroundColor Cyan
Write-Host ""

# Get ALL recent logs (not just errors)
$logs = aws logs tail "/aws/lambda/$LAMBDA_FUNCTION" --since 1m --region $AWS_REGION 2>&1

if ($LASTEXITCODE -eq 0) {
    if ($logs) {
        Write-Host $logs -ForegroundColor Gray
    } else {
        Write-Host "No logs found" -ForegroundColor Yellow
    }
} else {
    Write-Host "Failed to get logs: $logs" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Checking for specific errors ===" -ForegroundColor Cyan

# Check for specific error patterns
$errorPatterns = @(
    "bcrypt",
    "MissingBackendError",
    "UnrecognizedClientException",
    "ERROR",
    "Exception",
    "Traceback"
)

foreach ($pattern in $errorPatterns) {
    $matches = $logs | Select-String -Pattern $pattern -CaseSensitive:$false
    if ($matches) {
        Write-Host ""
        Write-Host "Found '$pattern':" -ForegroundColor Yellow
        foreach ($match in $matches) {
            Write-Host "  $match" -ForegroundColor $(if ($pattern -match "bcrypt|MissingBackendError") { "Red" } else { "Yellow" })
        }
    }
}
