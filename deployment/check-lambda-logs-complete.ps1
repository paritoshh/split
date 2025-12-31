# Comprehensive Lambda logs checker

Write-Host "=== Checking Lambda Logs ===" -ForegroundColor Cyan
Write-Host ""

$FUNCTION_NAME = "hisab-api-v2"
$LOG_GROUP = "/aws/lambda/$FUNCTION_NAME"

# Step 1: Check if function exists
Write-Host "1. Checking if Lambda function exists..." -ForegroundColor Yellow
$functionInfo = aws lambda get-function --function-name $FUNCTION_NAME 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Lambda function '$FUNCTION_NAME' not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Available functions:" -ForegroundColor Yellow
    aws lambda list-functions --query "Functions[*].FunctionName" --output table
    exit 1
}

Write-Host "   ✅ Function found" -ForegroundColor Green
Write-Host ""

# Step 2: Check if log group exists
Write-Host "2. Checking if log group exists..." -ForegroundColor Yellow
$logGroupInfo = aws logs describe-log-groups --log-group-name-prefix $LOG_GROUP 2>&1

if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($logGroupInfo)) {
    Write-Host "   ⚠️  Log group not found. This is normal if Lambda hasn't been invoked yet." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   Let's trigger a request to create logs..." -ForegroundColor Cyan
    Write-Host ""
    
    # Test health endpoint to trigger Lambda
    Write-Host "   Testing /health endpoint..." -ForegroundColor Gray
    $healthResponse = Invoke-WebRequest -Uri "https://e65w7up0h8.execute-api.ap-south-1.amazonaws.com/health" -Method GET -ErrorAction SilentlyContinue
    
    if ($healthResponse.StatusCode -eq 200) {
        Write-Host "   ✅ Health check successful" -ForegroundColor Green
        Write-Host ""
        Write-Host "   Waiting 5 seconds for logs to appear..." -ForegroundColor Yellow
        Start-Sleep -Seconds 5
    } else {
        Write-Host "   ❌ Health check failed" -ForegroundColor Red
    }
} else {
    Write-Host "   ✅ Log group found" -ForegroundColor Green
}

Write-Host ""

# Step 3: List log streams
Write-Host "3. Fetching log streams..." -ForegroundColor Yellow
$logStreams = aws logs describe-log-streams `
    --log-group-name $LOG_GROUP `
    --order-by LastEventTime `
    --descending `
    --max-items 5 `
    --query "logStreams[*].[logStreamName,lastEventTime]" `
    --output table 2>&1

if ($logStreams -and $logStreams -notmatch "ResourceNotFoundException") {
    Write-Host $logStreams
    Write-Host ""
    
    # Get the latest stream
    $latestStream = aws logs describe-log-streams `
        --log-group-name $LOG_GROUP `
        --order-by LastEventTime `
        --descending `
        --max-items 1 `
        --query "logStreams[0].logStreamName" `
        --output text 2>&1
    
    if ($latestStream -and $latestStream -ne "None") {
        Write-Host "4. Fetching recent logs from latest stream..." -ForegroundColor Yellow
        Write-Host "   Stream: $latestStream" -ForegroundColor Gray
        Write-Host ""
        
        $events = aws logs get-log-events `
            --log-group-name $LOG_GROUP `
            --log-stream-name $latestStream `
            --limit 30 `
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
                        $timestamp = [DateTimeOffset]::FromUnixTimeMilliseconds([long]$parts[0]).ToString("yyyy-MM-dd HH:mm:ss")
                        $message = $parts[1]
                        
                        # Highlight errors and login-related messages
                        if ($message -match "ERROR|Exception|Traceback|500|Internal Server Error") {
                            Write-Host "$timestamp $message" -ForegroundColor Red
                        } elseif ($message -match "login|/api/auth/login|authenticate") {
                            Write-Host "$timestamp $message" -ForegroundColor Yellow
                        } elseif ($message -match "START|END|REPORT") {
                            Write-Host "$timestamp $message" -ForegroundColor Gray
                        } else {
                            Write-Host "$timestamp $message" -ForegroundColor White
                        }
                    } catch {
                        Write-Host $_ -ForegroundColor Gray
                    }
                }
            }
        } else {
            Write-Host "   No log events found in this stream" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "   ❌ No log streams found" -ForegroundColor Red
    Write-Host ""
    Write-Host "   This means Lambda hasn't been invoked yet, or logs haven't been created." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   Try:" -ForegroundColor Cyan
    Write-Host "   1. Make a request to the API (login, register, etc.)" -ForegroundColor Gray
    Write-Host "   2. Wait 10-15 seconds" -ForegroundColor Gray
    Write-Host "   3. Run this script again" -ForegroundColor Gray
}

Write-Host ""
Write-Host "=== Alternative: Check in AWS Console ===" -ForegroundColor Cyan
Write-Host "1. Go to CloudWatch → Log groups" -ForegroundColor Yellow
Write-Host "2. Find: $LOG_GROUP" -ForegroundColor Gray
Write-Host "3. Click on the latest log stream" -ForegroundColor Gray
Write-Host "4. Look for errors (red text)" -ForegroundColor Gray

