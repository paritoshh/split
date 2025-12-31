# Check API Gateway integration details

$API_ID = "e65w7up0h8"
$AWS_REGION = "ap-south-1"
$LAMBDA_FUNCTION = "hisab-api-v2"

Write-Host "=== Checking API Gateway Integration ===" -ForegroundColor Cyan
Write-Host ""

# Get API details
Write-Host "1. Getting API Gateway details..." -ForegroundColor Yellow
$api = aws apigatewayv2 get-api --api-id $API_ID --region $AWS_REGION | ConvertFrom-Json

Write-Host "   API Name: $($api.Name)" -ForegroundColor Gray
Write-Host "   Protocol: $($api.ProtocolType)" -ForegroundColor Gray
Write-Host "   API Endpoint: $($api.ApiEndpoint)" -ForegroundColor Gray
Write-Host ""

# Get integrations
Write-Host "2. Checking integrations..." -ForegroundColor Yellow
$integrations = aws apigatewayv2 get-integrations --api-id $API_ID --region $AWS_REGION | ConvertFrom-Json

if ($integrations.Items) {
    foreach ($integration in $integrations.Items) {
        Write-Host "   Integration ID: $($integration.IntegrationId)" -ForegroundColor Gray
        Write-Host "   Integration URI: $($integration.IntegrationUri)" -ForegroundColor Gray
        Write-Host "   Integration Type: $($integration.IntegrationType)" -ForegroundColor Gray
        
        if ($integration.IntegrationType -eq "AWS_PROXY") {
            Write-Host "   ✅ Using AWS_PROXY (correct)" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  Integration type: $($integration.IntegrationType)" -ForegroundColor Yellow
        }
        Write-Host ""
    }
} else {
    Write-Host "   ❌ No integrations found!" -ForegroundColor Red
}

# Get routes
Write-Host "3. Checking routes..." -ForegroundColor Yellow
$routes = aws apigatewayv2 get-routes --api-id $API_ID --region $AWS_REGION | ConvertFrom-Json

if ($routes.Items) {
    foreach ($route in $routes.Items) {
        Write-Host "   Route: $($route.RouteKey)" -ForegroundColor Gray
        Write-Host "   Target: $($route.Target)" -ForegroundColor Gray
        
        if ($route.RouteKey -eq "ANY /{proxy+}") {
            Write-Host "   ✅ Proxy route found (correct)" -ForegroundColor Green
        }
        Write-Host ""
    }
} else {
    Write-Host "   ❌ No routes found!" -ForegroundColor Red
}

# Check Lambda permissions
Write-Host "4. Checking Lambda permissions..." -ForegroundColor Yellow
$lambdaPolicy = aws lambda get-policy --function-name $LAMBDA_FUNCTION --region $AWS_REGION | ConvertFrom-Json
$policyDoc = $lambdaPolicy.Policy | ConvertFrom-Json

$hasApiGatewayPermission = $false
foreach ($statement in $policyDoc.Statement) {
    if ($statement.Principal.Service -eq "apigateway.amazonaws.com") {
        $hasApiGatewayPermission = $true
        Write-Host "   ✅ API Gateway has permission to invoke Lambda" -ForegroundColor Green
        break
    }
}

if (-not $hasApiGatewayPermission) {
    Write-Host "   ❌ API Gateway does NOT have permission to invoke Lambda!" -ForegroundColor Red
    Write-Host ""
    Write-Host "   Fix: Add API Gateway as a trigger in Lambda console" -ForegroundColor Yellow
}

