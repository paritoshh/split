# Check and fix API Gateway integration settings

$API_ID = "e65w7up0h8"
$AWS_REGION = "ap-south-1"
$LAMBDA_FUNCTION = "hisab-api-v2"
$LAMBDA_ARN = "arn:aws:lambda:${AWS_REGION}:294618942342:function:${LAMBDA_FUNCTION}"

Write-Host "=== Checking API Gateway Integration ===" -ForegroundColor Cyan
Write-Host ""

# Get current integration
$integrations = aws apigatewayv2 get-integrations --api-id $API_ID --region $AWS_REGION | ConvertFrom-Json

if ($integrations.Items) {
    $integration = $integrations.Items[0]
    Write-Host "Current Integration:" -ForegroundColor Yellow
    Write-Host "  ID: $($integration.IntegrationId)" -ForegroundColor Gray
    Write-Host "  Type: $($integration.IntegrationType)" -ForegroundColor Gray
    Write-Host "  URI: $($integration.IntegrationUri)" -ForegroundColor Gray
    Write-Host "  Payload Format Version: $($integration.PayloadFormatVersion)" -ForegroundColor Gray
    Write-Host ""
    
    if ($integration.IntegrationType -ne "AWS_PROXY") {
        Write-Host "⚠️  Integration type should be AWS_PROXY for HTTP API" -ForegroundColor Yellow
        Write-Host "Current type: $($integration.IntegrationType)" -ForegroundColor Red
    } else {
        Write-Host "✅ Integration type is correct (AWS_PROXY)" -ForegroundColor Green
    }
    
    if ($integration.PayloadFormatVersion -ne "2.0") {
        Write-Host "⚠️  Payload format version should be 2.0 for HTTP API" -ForegroundColor Yellow
        Write-Host "Current version: $($integration.PayloadFormatVersion)" -ForegroundColor Red
        Write-Host ""
        Write-Host "Updating payload format version..." -ForegroundColor Yellow
        
        aws apigatewayv2 update-integration `
            --api-id $API_ID `
            --integration-id $integration.IntegrationId `
            --payload-format-version "2.0" `
            --region $AWS_REGION | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Updated payload format version to 2.0" -ForegroundColor Green
        } else {
            Write-Host "❌ Failed to update" -ForegroundColor Red
        }
    } else {
        Write-Host "✅ Payload format version is correct (2.0)" -ForegroundColor Green
    }
    
    # Check timeout
    if ($integration.TimeoutInMillis) {
        Write-Host "  Timeout: $($integration.TimeoutInMillis)ms" -ForegroundColor Gray
        if ($integration.TimeoutInMillis -lt 30000) {
            Write-Host "⚠️  Timeout might be too short (recommended: 30000ms)" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "❌ No integrations found!" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Checking Routes ===" -ForegroundColor Cyan
$routes = aws apigatewayv2 get-routes --api-id $API_ID --region $AWS_REGION | ConvertFrom-Json

if ($routes.Items) {
    foreach ($route in $routes.Items) {
        Write-Host "Route: $($route.RouteKey)" -ForegroundColor Gray
        Write-Host "  Target: $($route.Target)" -ForegroundColor Gray
        
        if ($route.RouteKey -eq "ANY /{proxy+}") {
            if ($route.Target -match "integrations/(.+)") {
                $integrationId = $matches[1]
                Write-Host "  ✅ Proxy route configured" -ForegroundColor Green
            }
        }
    }
}

Write-Host ""
Write-Host "=== Next Steps ===" -ForegroundColor Cyan
Write-Host "1. Test API Gateway again" -ForegroundColor Yellow
Write-Host "2. If still 500, check API Gateway logs in AWS Console" -ForegroundColor Yellow
Write-Host "3. Enable API Gateway execution logs for debugging" -ForegroundColor Yellow

