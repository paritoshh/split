# Check API Gateway stage and integration settings

$API_ID = "e65w7up0h8"
$AWS_REGION = "ap-south-1"
$STAGE_NAME = '`$default'

Write-Host "=== Checking API Gateway Settings ===" -ForegroundColor Cyan
Write-Host ""

# Get stage details
Write-Host "1. Checking Stage Settings..." -ForegroundColor Yellow
$stage = aws apigatewayv2 get-stage --api-id $API_ID --stage-name $STAGE_NAME --region $AWS_REGION | ConvertFrom-Json

Write-Host "   Stage: $($stage.StageName)" -ForegroundColor Gray
Write-Host "   Auto Deploy: $($stage.AutoDeploy)" -ForegroundColor Gray

if ($stage.DefaultRouteSettings) {
    Write-Host "   Default Route Settings:" -ForegroundColor Gray
    Write-Host "     Throttling Burst Limit: $($stage.DefaultRouteSettings.ThrottlingBurstLimit)" -ForegroundColor Gray
    Write-Host "     Throttling Rate Limit: $($stage.DefaultRouteSettings.ThrottlingRateLimit)" -ForegroundColor Gray
    Write-Host "     Logging Level: $($stage.DefaultRouteSettings.LoggingLevel)" -ForegroundColor Gray
    Write-Host "     Data Trace Enabled: $($stage.DefaultRouteSettings.DataTraceEnabled)" -ForegroundColor Gray
    Write-Host "     Detailed Metrics Enabled: $($stage.DefaultRouteSettings.DetailedMetricsEnabled)" -ForegroundColor Gray
}

Write-Host ""

# Get integration details
Write-Host "2. Checking Integration Settings..." -ForegroundColor Yellow
$integrations = aws apigatewayv2 get-integrations --api-id $API_ID --region $AWS_REGION | ConvertFrom-Json

if ($integrations.Items) {
    foreach ($integration in $integrations.Items) {
        Write-Host "   Integration: $($integration.IntegrationId)" -ForegroundColor Gray
        Write-Host "     Type: $($integration.IntegrationType)" -ForegroundColor Gray
        Write-Host "     Timeout: $($integration.TimeoutInMillis)ms" -ForegroundColor Gray
        
        if ($integration.TimeoutInMillis -lt 30000) {
            Write-Host "     ⚠️  Timeout might be too short!" -ForegroundColor Yellow
        }
        
        Write-Host "     Payload Format: $($integration.PayloadFormatVersion)" -ForegroundColor Gray
        Write-Host ""
    }
}

# Check routes
Write-Host "3. Checking Routes..." -ForegroundColor Yellow
$routes = aws apigatewayv2 get-routes --api-id $API_ID --region $AWS_REGION | ConvertFrom-Json

if ($routes.Items) {
    foreach ($route in $routes.Items) {
        Write-Host "   Route: $($route.RouteKey)" -ForegroundColor Gray
        Write-Host "     Target: $($route.Target)" -ForegroundColor Gray
        
        if ($route.RouteKey -eq "ANY /{proxy+}") {
            Write-Host "     ✅ Proxy route should catch /api/auth/register" -ForegroundColor Green
        }
        Write-Host ""
    }
}

Write-Host "=== Recommendations ===" -ForegroundColor Cyan
Write-Host "If timeout is < 30000ms, increase it to 30000ms" -ForegroundColor Yellow
Write-Host "Enable Data Trace to see what API Gateway receives" -ForegroundColor Yellow

