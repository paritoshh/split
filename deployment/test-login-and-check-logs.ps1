# Test login and immediately check logs

param(
    [Parameter(Mandatory=$true)]
    [string]$Email,
    
    [Parameter(Mandatory=$true)]
    [string]$Password
)

$API_URL = "https://e65w7up0h8.execute-api.ap-south-1.amazonaws.com"
$FUNCTION_NAME = "hisab-api-v2"
$LOG_GROUP = "/aws/lambda/$FUNCTION_NAME"

Write-Host "=== Testing Login and Checking Logs ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. Testing login endpoint..." -ForegroundColor Yellow
Write-Host "   Email: $Email" -ForegroundColor Gray
Write-Host "   URL: $API_URL/api/auth/login" -ForegroundColor Gray
Write-Host ""

try {
    $response = Invoke-WebRequest `
        -Uri "$API_URL/api/auth/login" `
        -Method POST `
        -ContentType "application/x-www-form-urlencoded" `
        -Body "username=$Email&password=$Password" `
        -ErrorAction Stop
    
    Write-Host "   ✅ Success: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "   Response: $($response.Content)" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "   Status Code: $statusCode" -ForegroundColor Red
        
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "   Response: $responseBody" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "2. Waiting 5 seconds for logs to appear..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "3. Checking Lambda logs..." -ForegroundColor Yellow

# Get latest log stream
$latestStream = aws logs describe-log-streams `
    --log-group-name $LOG_GROUP `
    --order-by LastEventTime `
    --descending `
    --max-items 1 `
    --query "logStreams[0].logStreamName" `
    --output text 2>&1

if ($latestStream -and $latestStream -ne "None" -and $latestStream -notmatch "ResourceNotFoundException") {
    Write-Host "   Latest stream: $latestStream" -ForegroundColor Gray
    Write-Host ""
    
    # Get recent events
    $events = aws logs get-log-events `
        --log-group-name $LOG_GROUP `
        --log-stream-name $latestStream `
        --limit 20 `
        --start-from-head false `
        --query "events[*].[timestamp,message]" `
        --output text 2>&1
    
    if ($events) {
        Write-Host "Recent log entries:" -ForegroundColor Cyan
        Write-Host ""
        $events | ForEach-Object {
            $parts = $_ -split "`t"
            if ($parts.Length -ge 2) {
                try {
                    $timestamp = [DateTimeOffset]::FromUnixTimeMilliseconds([long]$parts[0]).ToString("HH:mm:ss")
                    $message = $parts[1]
                    
                    if ($message -match "ERROR|Exception|Traceback|500") {
                        Write-Host "$timestamp $message" -ForegroundColor Red
                    } elseif ($message -match "login|authenticate") {
                        Write-Host "$timestamp $message" -ForegroundColor Yellow
                    } else {
                        Write-Host "$timestamp $message" -ForegroundColor Gray
                    }
                } catch {
                    Write-Host $_ -ForegroundColor Gray
                }
            }
        }
    } else {
        Write-Host "   No recent events found" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ⚠️  No log streams found yet" -ForegroundColor Yellow
    Write-Host "   Try checking in AWS Console: CloudWatch → Log groups → $LOG_GROUP" -ForegroundColor Gray
}

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Cyan

