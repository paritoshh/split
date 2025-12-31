# Check Lambda logs for login error

Write-Host "=== Checking Lambda Logs for Login Error ===" -ForegroundColor Cyan
Write-Host ""

$FUNCTION_NAME = "hisab-api-v2"
$LOG_GROUP = "/aws/lambda/$FUNCTION_NAME"

Write-Host "Fetching recent logs (last 5 minutes)..." -ForegroundColor Yellow
Write-Host ""

# Get recent log streams
$logStreams = aws logs describe-log-streams `
    --log-group-name $LOG_GROUP `
    --order-by LastEventTime `
    --descending `
    --max-items 1 `
    --query "logStreams[0].logStreamName" `
    --output text

if ($logStreams -eq "None" -or [string]::IsNullOrWhiteSpace($logStreams)) {
    Write-Host "❌ No log streams found" -ForegroundColor Red
    exit 1
}

Write-Host "Latest log stream: $logStreams" -ForegroundColor Gray
Write-Host ""

# Get recent log events
$events = aws logs get-log-events `
    --log-group-name $LOG_GROUP `
    --log-stream-name $logStreams `
    --limit 50 `
    --start-from-head false `
    --query "events[*].[timestamp,message]" `
    --output text

if ($events) {
    Write-Host "Recent log entries:" -ForegroundColor Yellow
    Write-Host ""
    $events | ForEach-Object {
        $parts = $_ -split "`t"
        if ($parts.Length -ge 2) {
            $timestamp = [DateTimeOffset]::FromUnixTimeMilliseconds([long]$parts[0]).ToString("yyyy-MM-dd HH:mm:ss")
            $message = $parts[1]
            
            # Highlight errors
            if ($message -match "ERROR|Exception|Traceback|500|Internal Server Error") {
                Write-Host "$timestamp $message" -ForegroundColor Red
            } elseif ($message -match "login|/api/auth/login") {
                Write-Host "$timestamp $message" -ForegroundColor Yellow
            } else {
                Write-Host "$timestamp $message" -ForegroundColor Gray
            }
        }
    }
} else {
    Write-Host "No recent log events found" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Next Steps ===" -ForegroundColor Cyan
Write-Host "1. Try logging in again" -ForegroundColor Yellow
Write-Host "2. Run this script again to see the error" -ForegroundColor Yellow
Write-Host "3. Or check CloudWatch Logs in AWS Console" -ForegroundColor Yellow

