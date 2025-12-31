# Check Lambda logs for specific endpoint errors

param(
    [Parameter(Mandatory=$false)]
    [string]$Endpoint = ""
)

$FUNCTION_NAME = "hisab-api-v2"
$LOG_GROUP = "/aws/lambda/$FUNCTION_NAME"

Write-Host "=== Checking Lambda Logs for Errors ===" -ForegroundColor Cyan
Write-Host ""

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
        Write-Host "Recent log entries (showing errors and relevant requests):" -ForegroundColor Cyan
        Write-Host ""
        
        $foundError = $false
        $events | ForEach-Object {
            $parts = $_ -split "`t"
            if ($parts.Length -ge 2) {
                try {
                    $timestamp = [DateTimeOffset]::FromUnixTimeMilliseconds([long]$parts[0]).ToString("HH:mm:ss")
                    $message = $parts[1]
                    
                    # Filter by endpoint if provided
                    $showMessage = $true
                    if ($Endpoint -and $message -notmatch $Endpoint) {
                        $showMessage = $false
                    }
                    
                    if ($showMessage) {
                        if ($message -match "ERROR|Exception|Traceback|500|Internal Server Error") {
                            Write-Host "$timestamp [ERROR] $message" -ForegroundColor Red
                            $foundError = $true
                        } elseif ($message -match "unread|groups|/api/notifications|/api/groups") {
                            Write-Host "$timestamp [INFO] $message" -ForegroundColor Yellow
                        } elseif ($message -match "START|END") {
                            Write-Host "$timestamp $message" -ForegroundColor Gray
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
            Write-Host "Try making a request to the failing endpoint and run this script again." -ForegroundColor Gray
        }
    } else {
        Write-Host "No recent log events found" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ No log streams found" -ForegroundColor Red
    Write-Host "Make a request to trigger Lambda, then run this script again." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Usage ===" -ForegroundColor Cyan
Write-Host "Check all errors: .\check-specific-errors.ps1" -ForegroundColor Gray
Write-Host "Check unread-count: .\check-specific-errors.ps1 -Endpoint 'unread'" -ForegroundColor Gray
Write-Host "Check groups: .\check-specific-errors.ps1 -Endpoint 'groups'" -ForegroundColor Gray

