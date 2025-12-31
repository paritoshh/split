# Check ALL Lambda log streams, not just the latest

$LAMBDA_FUNCTION = "hisab-api-v2"
$AWS_REGION = "ap-south-1"

Write-Host "=== Checking ALL Lambda Log Streams ===" -ForegroundColor Cyan
Write-Host ""

# Get all recent log streams
$streams = aws logs describe-log-streams `
    --log-group-name "/aws/lambda/$LAMBDA_FUNCTION" `
    --order-by LastEventTime `
    --descending `
    --max-items 5 `
    --region $AWS_REGION | ConvertFrom-Json

if ($streams.logStreams.Count -eq 0) {
    Write-Host "No log streams found" -ForegroundColor Red
    exit 1
}

Write-Host "Found $($streams.logStreams.Count) recent log streams" -ForegroundColor Yellow
Write-Host ""

foreach ($stream in $streams.logStreams) {
    Write-Host "=== Stream: $($stream.logStreamName) ===" -ForegroundColor Cyan
    Write-Host "Last Event: $([DateTimeOffset]::FromUnixTimeMilliseconds($stream.lastEventTime).ToString('yyyy-MM-dd HH:mm:ss'))" -ForegroundColor Gray
    Write-Host ""
    
    # Get events from this stream
    $events = aws logs get-log-events `
        --log-group-name "/aws/lambda/$LAMBDA_FUNCTION" `
        --log-stream-name $stream.logStreamName `
        --limit 50 `
        --region $AWS_REGION | ConvertFrom-Json
    
    if ($events.events) {
        $hasErrors = $false
        foreach ($event in $events.events) {
            $message = $event.message
            if ($message -match "ERROR|Exception|Traceback|Failed|500|statusCode|Lambda invoked|Lambda completed") {
                $hasErrors = $true
                $timestamp = [DateTimeOffset]::FromUnixTimeMilliseconds($event.timestamp).ToString("HH:mm:ss")
                if ($message -match "ERROR|Exception|Traceback|Failed") {
                    Write-Host "[$timestamp] $message" -ForegroundColor Red
                } else {
                    Write-Host "[$timestamp] $message" -ForegroundColor Yellow
                }
            }
        }
        
        if (-not $hasErrors) {
            Write-Host "No errors in this stream" -ForegroundColor Gray
        }
    } else {
        Write-Host "No events in this stream" -ForegroundColor Gray
    }
    
    Write-Host ""
}

