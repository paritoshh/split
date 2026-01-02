# Check CloudWatch logs for /auth/me endpoint errors
# This helps diagnose 500 errors on the /auth/me endpoint

$LAMBDA_FUNCTION = "hisab-api-v2"
$AWS_REGION = "ap-south-1"

Write-Host "=== Checking /auth/me Logs ===" -ForegroundColor Cyan
Write-Host ""

# Get logs from the last 15 minutes
$logGroup = "/aws/lambda/$LAMBDA_FUNCTION"
$startTime = (Get-Date).AddMinutes(-15).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

Write-Host "Fetching logs from the last 15 minutes..." -ForegroundColor Yellow
Write-Host ""

try {
    $startTimeMs = [DateTimeOffset]::Parse($startTime).ToUnixTimeMilliseconds()
    
    $logs = aws logs filter-log-events `
        --log-group-name $logGroup `
        --start-time $startTimeMs `
        --region $AWS_REGION `
        --output json 2>&1 | ConvertFrom-Json
    
    if ($logs.events) {
        Write-Host "Found $($logs.events.Count) log entries" -ForegroundColor Gray
        Write-Host ""
        
        # Filter for /auth/me related logs
        $authMeLogs = $logs.events | Where-Object {
            $_.message -match "/auth/me|get_me|get_current_user|Getting user profile" -or
            $_.message -match "auth.*me|ERROR.*auth" -or
            $_.message -match "User data|missing.*field|Failed to get user"
        }
        
        if ($authMeLogs) {
            Write-Host "=== /auth/me Related Logs ===" -ForegroundColor Yellow
            Write-Host ""
            foreach ($log in $authMeLogs) {
                $timestamp = [DateTimeOffset]::FromUnixTimeMilliseconds($log.timestamp).LocalDateTime.ToString("HH:mm:ss")
                $level = if ($log.message -match "ERROR") { "ERROR" } elseif ($log.message -match "WARNING|WARN") { "WARN" } else { "INFO" }
                $color = if ($level -eq "ERROR") { "Red" } elseif ($level -eq "WARN") { "Yellow" } else { "Gray" }
                Write-Host "[$timestamp] [$level] $($log.message)" -ForegroundColor $color
            }
        } else {
            Write-Host "No /auth/me related logs found" -ForegroundColor Yellow
        }
        
        # Check for all errors
        $allErrors = $logs.events | Where-Object {
            $_.message -match "ERROR|Exception|Traceback|Failed"
        }
        
        if ($allErrors) {
            Write-Host ""
            Write-Host "=== All Recent Errors ===" -ForegroundColor Red
            Write-Host ""
            foreach ($error in $allErrors | Select-Object -First 20) {
                $timestamp = [DateTimeOffset]::FromUnixTimeMilliseconds($error.timestamp).LocalDateTime.ToString("HH:mm:ss")
                Write-Host "[$timestamp] $($error.message)" -ForegroundColor Red
            }
        }
        
        # Check for Lambda invocation logs
        $invocations = $logs.events | Where-Object {
            $_.message -match "START RequestId|END RequestId|Lambda Invoked|Path:.*auth"
        }
        
        if ($invocations) {
            Write-Host ""
            Write-Host "=== Recent Lambda Invocations ===" -ForegroundColor Cyan
            Write-Host ""
            foreach ($inv in $invocations | Select-Object -First 10) {
                $timestamp = [DateTimeOffset]::FromUnixTimeMilliseconds($inv.timestamp).LocalDateTime.ToString("HH:mm:ss")
                Write-Host "[$timestamp] $($inv.message)" -ForegroundColor Gray
            }
        }
    } else {
        Write-Host "No logs found in the last 15 minutes" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "This could mean:" -ForegroundColor Yellow
        Write-Host "1. The Lambda hasn't been invoked recently" -ForegroundColor Gray
        Write-Host "2. Logs are in a different time range" -ForegroundColor Gray
        Write-Host "3. The code hasn't been deployed yet" -ForegroundColor Gray
    }
} catch {
    Write-Host "Error fetching logs: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Alternative: Check logs manually in AWS Console:" -ForegroundColor Yellow
    Write-Host "1. Go to CloudWatch > Log groups > /aws/lambda/$LAMBDA_FUNCTION" -ForegroundColor Gray
    Write-Host "2. Open the latest log stream" -ForegroundColor Gray
    Write-Host "3. Search for 'auth' or 'me' or 'ERROR'" -ForegroundColor Gray
}

Write-Host ""
Write-Host "=== Tips ===" -ForegroundColor Cyan
Write-Host "1. Make sure you've deployed the latest code" -ForegroundColor Yellow
Write-Host "2. Try calling /auth/me again and immediately run this script" -ForegroundColor Yellow
Write-Host "3. Check if the Lambda function is being invoked (look for START RequestId)" -ForegroundColor Yellow
Write-Host ""

