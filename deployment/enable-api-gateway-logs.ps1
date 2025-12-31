# Enable API Gateway execution logs

$API_ID = "e65w7up0h8"
$AWS_REGION = "ap-south-1"
$STAGE_NAME = "$default"  # Default stage for HTTP API

Write-Host "=== Enabling API Gateway Execution Logs ===" -ForegroundColor Cyan
Write-Host ""

# Create CloudWatch log group for API Gateway
$LOG_GROUP_NAME = "/aws/apigateway/$API_ID"

Write-Host "1. Creating CloudWatch log group..." -ForegroundColor Yellow
aws logs create-log-group --log-group-name $LOG_GROUP_NAME --region $AWS_REGION 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Log group created" -ForegroundColor Green
} else {
    Write-Host "   ℹ️  Log group might already exist (that's okay)" -ForegroundColor Gray
}

# Set log format
$LOG_FORMAT = @{
    requestId = '$context.requestId'
    ip = '$context.identity.sourceIp'
    requestTime = '$context.requestTime'
    httpMethod = '$context.httpMethod'
    routeKey = '$context.routeKey'
    status = '$context.status'
    protocol = '$context.protocol'
    responseLength = '$context.responseLength'
    integrationErrorMessage = '$context.integrationErrorMessage'
    integrationStatus = '$context.integrationStatus'
    integrationLatency = '$context.integrationLatency'
    responseLatency = '$context.responseLatency'
} | ConvertTo-Json -Compress

Write-Host ""
Write-Host "2. Enabling access logging for API Gateway stage..." -ForegroundColor Yellow

# Enable access logging
aws apigatewayv2 update-stage `
    --api-id $API_ID `
    --stage-name $STAGE_NAME `
    --access-log-settings "Format=`"$LOG_FORMAT`",DestinationArn=`"arn:aws:logs:${AWS_REGION}:294618942342:log-group:${LOG_GROUP_NAME}`"" `
    --region $AWS_REGION 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Access logging enabled" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Failed to enable access logging" -ForegroundColor Yellow
    Write-Host "   You may need to enable it manually in AWS Console" -ForegroundColor Gray
}

Write-Host ""
Write-Host "3. Checking current stage configuration..." -ForegroundColor Yellow
$stage = aws apigatewayv2 get-stage --api-id $API_ID --stage-name $STAGE_NAME --region $AWS_REGION | ConvertFrom-Json

Write-Host "   Stage: $($stage.StageName)" -ForegroundColor Gray
Write-Host "   Auto deploy: $($stage.AutoDeploy)" -ForegroundColor Gray

if ($stage.DefaultRouteSettings) {
    Write-Host "   Logging level: $($stage.DefaultRouteSettings.LoggingLevel)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "=== Next Steps ===" -ForegroundColor Cyan
Write-Host "1. Make a test request to API Gateway" -ForegroundColor Yellow
Write-Host "2. Check logs in CloudWatch:" -ForegroundColor Yellow
Write-Host "   aws logs tail $LOG_GROUP_NAME --since 5m --region $AWS_REGION" -ForegroundColor Gray
Write-Host ""
Write-Host "Or check in AWS Console:" -ForegroundColor Yellow
Write-Host "   CloudWatch → Log groups → $LOG_GROUP_NAME" -ForegroundColor Gray

