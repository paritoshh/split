# Check Lambda Environment Variables

$LAMBDA_FUNCTION = "hisab-api-v2"
$AWS_REGION = "ap-south-1"

Write-Host "=== Checking Lambda Environment Variables ===" -ForegroundColor Cyan
Write-Host ""

$envVars = aws lambda get-function-configuration --function-name $LAMBDA_FUNCTION --region $AWS_REGION --query "Environment.Variables" --output json 2>&1

if ($LASTEXITCODE -eq 0) {
    $envJson = $envVars | ConvertFrom-Json
    
    Write-Host "Environment variables:" -ForegroundColor Yellow
    Write-Host ""
    
    $hasEndpointUrl = $false
    $hasAwsCreds = $false
    
    foreach ($prop in $envJson.PSObject.Properties) {
        $name = $prop.Name
        $value = $prop.Value
        
        # Mask sensitive values
        if ($name -match "SECRET|KEY|PASSWORD|TOKEN") {
            $displayValue = "***MASKED***"
        } else {
            $displayValue = $value
        }
        
        Write-Host "  $name = $displayValue" -ForegroundColor White
        
        # Check for problematic variables
        if ($name -eq "DYNAMODB_ENDPOINT_URL") {
            $hasEndpointUrl = $true
            if ($value -and $value -ne "") {
                Write-Host "    ⚠️  WARNING: DYNAMODB_ENDPOINT_URL is set!" -ForegroundColor Red
                Write-Host "    This makes Lambda try to connect to local DynamoDB!" -ForegroundColor Red
                Write-Host "    DELETE this variable if you're using AWS DynamoDB!" -ForegroundColor Yellow
            }
        }
        
        if ($name -eq "AWS_ACCESS_KEY_ID" -or $name -eq "AWS_SECRET_ACCESS_KEY") {
            $hasAwsCreds = $true
            Write-Host "    ❌ ERROR: AWS credentials found in environment!" -ForegroundColor Red
            Write-Host "    DELETE these - Lambda should use IAM role!" -ForegroundColor Red
        }
    }
    
    Write-Host ""
    
    if (-not $hasEndpointUrl) {
        Write-Host "✅ DYNAMODB_ENDPOINT_URL is not set (correct for AWS)" -ForegroundColor Green
    }
    
    if (-not $hasAwsCreds) {
        Write-Host "✅ No AWS credentials in environment (correct)" -ForegroundColor Green
    }
} else {
    Write-Host "❌ Error getting environment variables" -ForegroundColor Red
    Write-Host $envVars -ForegroundColor Gray
}

Write-Host ""
Write-Host "=== Critical Check ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Since the simple test Lambda works, but main Lambda doesn't:" -ForegroundColor Yellow
Write-Host "1. Check if DYNAMODB_ENDPOINT_URL is set (should be empty/not set)" -ForegroundColor White
Write-Host "2. Verify DATABASE_TYPE = dynamodb" -ForegroundColor White
Write-Host "3. Verify AWS_REGION is correct (or not set, should use default)" -ForegroundColor White

