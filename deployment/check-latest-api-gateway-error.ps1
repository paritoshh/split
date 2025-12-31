# Check the latest error from API Gateway requests

$LAMBDA_FUNCTION = "hisab-api-v2"
$AWS_REGION = "ap-south-1"

Write-Host "=== Latest API Gateway Error ===" -ForegroundColor Cyan
Write-Host ""

# Get the latest log stream
$streams = aws logs describe-log-streams `
    --log-group-name "/aws/lambda/$LAMBDA_FUNCTION" `
    --order-by LastEventTime `
    --descending `
    --max-items 1 `
    --region $AWS_REGION | ConvertFrom-Json

if ($streams.logStreams.Count -eq 0) {
    Write-Host "No log streams found" -ForegroundColor Red
    exit 1
}

$latestStream = $streams.logStreams[0].logStreamName

# Get recent events
$events = aws logs get-log-events `
    --log-group-name "/aws/lambda/$LAMBDA_FUNCTION" `
    --log-stream-name $latestStream `
    --limit 100 `
    --region $AWS_REGION | ConvertFrom-Json

Write-Host "Looking for errors in the last 100 events..." -ForegroundColor Yellow
Write-Host ""

$foundError = $false
foreach ($event in $events.events) {
    $message = $event.message
    
    # Look for errors, exceptions, or our debug logs
    if ($message -match "ERROR|Exception|Traceback|Failed|UnrecognizedClientException|Lambda invoked|Lambda completed|Result") {
        $foundError = $true
        $timestamp = [DateTimeOffset]::FromUnixTimeMilliseconds($event.timestamp).ToString("yyyy-MM-dd HH:mm:ss")
        
        if ($message -match "ERROR|Exception|Traceback|UnrecognizedClientException") {
            Write-Host "[$timestamp] $message" -ForegroundColor Red
        } elseif ($message -match "Lambda invoked|Lambda completed|Result") {
            Write-Host "[$timestamp] $message" -ForegroundColor Yellow
        } else {
            Write-Host "[$timestamp] $message" -ForegroundColor Gray
        }
    }
}

if (-not $foundError) {
    Write-Host "No errors found in recent logs" -ForegroundColor Green
    Write-Host ""
    Write-Host "Showing last 10 events:" -ForegroundColor Yellow
    $events.events[-10..-1] | ForEach-Object {
        $timestamp = [DateTimeOffset]::FromUnixTimeMilliseconds($_.timestamp).ToString("HH:mm:ss")
        Write-Host "[$timestamp] $($_.message)" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "=== Next Steps ===" -ForegroundColor Cyan
if ($foundError) {
    Write-Host "If you see UnrecognizedClientException, the Lambda code might not be updated." -ForegroundColor Yellow
    Write-Host "Make sure you rebuilt Lambda after the code changes." -ForegroundColor Yellow
} else {
    Write-Host "No errors in logs. The 500 might be from API Gateway itself." -ForegroundColor Yellow
    Write-Host "Check API Gateway logs in AWS Console." -ForegroundColor Yellow
}

