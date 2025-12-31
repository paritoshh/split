# Test API Gateway and immediately check Lambda logs

$API_URL = "https://e65w7up0h8.execute-api.ap-south-1.amazonaws.com"
$LAMBDA_FUNCTION = "hisab-api-v2"
$AWS_REGION = "ap-south-1"

Write-Host "=== Testing API Gateway with Log Monitoring ===" -ForegroundColor Cyan
Write-Host ""

# Test register endpoint
$testEmail = "test$(Get-Random)@test.com"
$registerBody = @{
    name = "Test User"
    email = $testEmail
    password = "test123456"
} | ConvertTo-Json

Write-Host "Sending request to: $API_URL/api/auth/register" -ForegroundColor Yellow
Write-Host "Email: $testEmail" -ForegroundColor Gray
Write-Host ""

try {
    $registerResponse = Invoke-WebRequest `
        -Uri "$API_URL/api/auth/register" `
        -Method POST `
        -Body $registerBody `
        -ContentType "application/json" `
        -UseBasicParsing `
        -ErrorAction Stop

    Write-Host "✅ Status: $($registerResponse.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($registerResponse.Content)" -ForegroundColor Gray
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
    
    Write-Host "❌ Status: $statusCode" -ForegroundColor Red
    Write-Host "Response: $responseBody" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Waiting 3 seconds for logs to propagate..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "=== Recent Lambda Logs ===" -ForegroundColor Cyan
$logs = aws logs tail "/aws/lambda/$LAMBDA_FUNCTION" --since 1m --region $AWS_REGION 2>&1

if ($logs) {
    # Filter for errors and important messages
    $errorLines = $logs | Select-String -Pattern "ERROR|Exception|Traceback|Failed|500|statusCode" -Context 2
    
    if ($errorLines) {
        Write-Host $errorLines -ForegroundColor Red
    } else {
        Write-Host "No errors found in logs" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Full recent logs:" -ForegroundColor Gray
        Write-Host $logs -ForegroundColor Gray
    }
} else {
    Write-Host "No logs found" -ForegroundColor Yellow
}

