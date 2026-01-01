# Check Lambda logs for register/login errors

Write-Host "=== Checking Register/Login Errors ===" -ForegroundColor Cyan
Write-Host ""

$FUNCTION_NAME = "hisab-api-v2"
$LOG_GROUP = "/aws/lambda/$FUNCTION_NAME"

# Get latest log stream
$latestStream = aws logs describe-log-streams `
    --log-group-name $LOG_GROUP `
    --order-by LastEventTime `
    --descending `
    --max-items 1 `
    --query "logStreams[0].logStreamName" `
    --output text 2>&1

if ($latestStream -and $latestStream -ne "None" -and $latestStream -notmatch "ResourceNotFoundException") {
    Write-Host "Latest log stream: $latestStream" -ForegroundColor Gray
    Write-Host ""
    
    # Get recent events
    $events = aws logs get-log-events `
        --log-group-name $LOG_GROUP `
        --log-stream-name $latestStream `
        --limit 50 `
        --start-from-head false `
        --query "events[*].[timestamp,message]" `
        --output text 2>&1
    
    if ($events) {
        Write-Host "Recent log entries (showing register/login errors):" -ForegroundColor Cyan
        Write-Host ""
        
        $foundError = $false
        $events | ForEach-Object {
            $parts = $_ -split "`t"
            if ($parts.Length -ge 2) {
                try {
                    $timestamp = [DateTimeOffset]::FromUnixTimeMilliseconds([long]$parts[0]).ToString("HH:mm:ss")
                    $message = $parts[1]
                    
                    if ($message -match "register|login|/api/auth" -or $message -match "ERROR|Exception|Traceback|500") {
                        if ($message -match "ERROR|Exception|Traceback|500") {
                            Write-Host "$timestamp [ERROR] $message" -ForegroundColor Red
                            $foundError = $true
                        } else {
                            Write-Host "$timestamp [INFO] $message" -ForegroundColor Yellow
                        }
                    }
                } catch {
                    # Skip invalid entries
                }
            }
        }
        
        if (-not $foundError) {
            Write-Host ""
            Write-Host "No errors found in recent logs." -ForegroundColor Yellow
            Write-Host "Try making a register/login request and run this script again." -ForegroundColor Gray
        }
    } else {
        Write-Host "No recent log events found" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ No log streams found" -ForegroundColor Red
    Write-Host "Make a request to trigger Lambda, then run this script again." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Test Endpoints ===" -ForegroundColor Cyan
Write-Host "Register: .\deployment\test-register-endpoint.ps1 -Email 'test@example.com' -Password 'test123'" -ForegroundColor Gray
Write-Host "Login: .\deployment\test-login-endpoint.ps1 -Email 'test@example.com' -Password 'test123'" -ForegroundColor Gray

