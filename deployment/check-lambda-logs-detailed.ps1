# Check Lambda logs in detail

$LAMBDA_FUNCTION = "hisab-api-v2"
$AWS_REGION = "ap-south-1"

Write-Host "=== Checking Lambda Logs (Last 5 minutes) ===" -ForegroundColor Cyan
Write-Host ""

# Get logs using AWS CLI
$logs = aws logs tail "/aws/lambda/$LAMBDA_FUNCTION" --since 5m --region $AWS_REGION --format short 2>&1

if ($LASTEXITCODE -eq 0) {
    if ($logs) {
        Write-Host $logs -ForegroundColor Gray
    } else {
        Write-Host "No logs found in last 5 minutes" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Trying to get all recent log streams..." -ForegroundColor Yellow
        
        # Get log streams
        $streams = aws logs describe-log-streams `
            --log-group-name "/aws/lambda/$LAMBDA_FUNCTION" `
            --order-by LastEventTime `
            --descending `
            --max-items 3 `
            --region $AWS_REGION | ConvertFrom-Json
        
        if ($streams.logStreams) {
            Write-Host ""
            Write-Host "Recent log streams:" -ForegroundColor Cyan
            foreach ($stream in $streams.logStreams) {
                Write-Host "  $($stream.logStreamName) - Last: $($stream.lastEventTime)" -ForegroundColor Gray
                
                # Get events from this stream
                $events = aws logs get-log-events `
                    --log-group-name "/aws/lambda/$LAMBDA_FUNCTION" `
                    --log-stream-name $stream.logStreamName `
                    --limit 20 `
                    --region $AWS_REGION | ConvertFrom-Json
                
                if ($events.events) {
                    Write-Host ""
                    Write-Host "  Events from this stream:" -ForegroundColor Yellow
                    foreach ($event in $events.events) {
                        $message = $event.message
                        if ($message -match "ERROR|Exception|Traceback|bcrypt|Failed") {
                            Write-Host "    $message" -ForegroundColor Red
                        } else {
                            Write-Host "    $message" -ForegroundColor Gray
                        }
                    }
                }
            }
        }
    }
} else {
    Write-Host "Failed to get logs: $logs" -ForegroundColor Red
}

