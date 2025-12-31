# Check Lambda CORS settings

$LAMBDA_FUNCTION = "hisab-api-v2"
$AWS_REGION = "ap-south-1"

Write-Host "=== Checking Lambda CORS Settings ===" -ForegroundColor Cyan
Write-Host ""

# Get Lambda environment variables
$lambdaConfig = aws lambda get-function-configuration `
    --function-name $LAMBDA_FUNCTION `
    --region $AWS_REGION | ConvertFrom-Json

Write-Host "Environment Variables:" -ForegroundColor Yellow

if ($lambdaConfig.Environment.Variables) {
    foreach ($key in $lambdaConfig.Environment.Variables.PSObject.Properties.Name) {
        $value = $lambdaConfig.Environment.Variables.$key
        
        if ($key -eq "ALLOWED_ORIGINS") {
            Write-Host "  $key = $value" -ForegroundColor $(if ($value -match "hisab.paritoshagarwal.com") { "Green" } else { "Yellow" })
            
            if ($value -match "hisab.paritoshagarwal.com") {
                Write-Host "    ✅ CloudFront domain is included" -ForegroundColor Green
            } else {
                Write-Host "    ⚠️  CloudFront domain might be missing!" -ForegroundColor Yellow
                Write-Host "    Should include: https://hisab.paritoshagarwal.com" -ForegroundColor Gray
            }
        } elseif ($key -match "SECRET|KEY|PASSWORD") {
            Write-Host "  $key = **MASKED**" -ForegroundColor Gray
        } else {
            Write-Host "  $key = $value" -ForegroundColor Gray
        }
    }
} else {
    Write-Host "  ❌ No environment variables found!" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== CORS Configuration Check ===" -ForegroundColor Cyan

$allowedOrigins = $lambdaConfig.Environment.Variables.ALLOWED_ORIGINS

if ($allowedOrigins) {
    $origins = $allowedOrigins -split ","
    Write-Host "Allowed origins:" -ForegroundColor Yellow
    foreach ($origin in $origins) {
        $origin = $origin.Trim()
        if ($origin -match "hisab.paritoshagarwal.com") {
            Write-Host "  ✅ $origin" -ForegroundColor Green
        } else {
            Write-Host "  - $origin" -ForegroundColor Gray
        }
    }
} else {
    Write-Host "  ❌ ALLOWED_ORIGINS not set!" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Recommendation ===" -ForegroundColor Cyan
Write-Host "ALLOWED_ORIGINS should include:" -ForegroundColor Yellow
Write-Host "  - https://hisab.paritoshagarwal.com" -ForegroundColor Gray
Write-Host "  - http://localhost:5173 (for local dev)" -ForegroundColor Gray
Write-Host "  - capacitor://localhost (for mobile)" -ForegroundColor Gray

