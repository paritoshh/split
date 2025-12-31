# Get the full error from Lambda logs

$LAMBDA_FUNCTION = "hisab-api-v2"
$AWS_REGION = "ap-south-1"

Write-Host "=== Getting Full Lambda Error ===" -ForegroundColor Cyan
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
Write-Host "Latest log stream: $latestStream" -ForegroundColor Yellow
Write-Host ""

# Get all events from the latest stream
$events = aws logs get-log-events `
    --log-group-name "/aws/lambda/$LAMBDA_FUNCTION" `
    --log-stream-name $latestStream `
    --limit 100 `
    --region $AWS_REGION | ConvertFrom-Json

Write-Host "=== Full Log Events ===" -ForegroundColor Cyan
Write-Host ""

foreach ($event in $events.events) {
    $message = $event.message
    $timestamp = [DateTimeOffset]::FromUnixTimeMilliseconds($event.timestamp).ToString("yyyy-MM-dd HH:mm:ss")
    
    if ($message -match "ERROR|Exception|Traceback|Failed|bcrypt|DynamoDB|UnrecognizedClientException") {
        Write-Host "[$timestamp] $message" -ForegroundColor Red
    } elseif ($message -match "INFO|Starting|Lambda") {
        Write-Host "[$timestamp] $message" -ForegroundColor Yellow
    } else {
        Write-Host "[$timestamp] $message" -ForegroundColor Gray
    }
}

