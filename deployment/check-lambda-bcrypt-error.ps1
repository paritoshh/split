# Check the latest Lambda error to see if bcrypt is still failing

$LAMBDA_FUNCTION = "hisab-api-v2"
$AWS_REGION = "ap-south-1"

Write-Host "=== Checking Latest Lambda Error ===" -ForegroundColor Cyan
Write-Host ""

# Get the latest log stream
$logStreams = aws logs describe-log-streams `
    --log-group-name "/aws/lambda/$LAMBDA_FUNCTION" `
    --order-by LastEventTime `
    --descending `
    --max-items 1 `
    --region $AWS_REGION | ConvertFrom-Json

if ($logStreams.logStreams.Count -eq 0) {
    Write-Host "❌ No log streams found" -ForegroundColor Red
    exit 1
}

$latestStream = $logStreams.logStreams[0].logStreamName
Write-Host "Latest log stream: $latestStream" -ForegroundColor Yellow
Write-Host ""

# Get recent log events
$logs = aws logs get-log-events `
    --log-group-name "/aws/lambda/$LAMBDA_FUNCTION" `
    --log-stream-name $latestStream `
    --limit 50 `
    --region $AWS_REGION | ConvertFrom-Json

Write-Host "=== Recent Logs (last 50 events) ===" -ForegroundColor Cyan
Write-Host ""

$bcryptError = $false
$errorFound = $false

foreach ($event in $logs.events) {
    $message = $event.message
    
    if ($message -match "bcrypt|MissingBackendError") {
        $bcryptError = $true
        $errorFound = $true
        Write-Host $message -ForegroundColor Red
    } elseif ($message -match "ERROR|Exception|Traceback|Error") {
        $errorFound = $true
        Write-Host $message -ForegroundColor Yellow
    } else {
        Write-Host $message -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan

if ($bcryptError) {
    Write-Host "❌ bcrypt error is still present!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Even though bcrypt is verified in the build, Lambda can't find it." -ForegroundColor Yellow
    Write-Host "This might be a runtime path issue or missing compiled libraries." -ForegroundColor Yellow
} elseif ($errorFound) {
    Write-Host "⚠️  Other errors found (not bcrypt)" -ForegroundColor Yellow
} else {
    Write-Host "✅ No errors found in recent logs" -ForegroundColor Green
}

