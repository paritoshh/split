# Debug Lambda credential issues
# This script helps diagnose why Lambda can't access DynamoDB

Write-Host "=== Debugging Lambda Credential Issues ===" -ForegroundColor Cyan
Write-Host ""

# Check 1: Lambda environment variables
Write-Host "1. Checking Lambda environment variables..." -ForegroundColor Yellow
$envVars = aws lambda get-function-configuration --function-name hisab-api --region ap-south-1 --query "Environment.Variables" --output json 2>&1

if ($LASTEXITCODE -eq 0) {
    $envJson = $envVars | ConvertFrom-Json
    Write-Host "   Environment variables:" -ForegroundColor Gray
    
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
        
        Write-Host "   - $name = $displayValue" -ForegroundColor White
        
        # Check for AWS credential environment variables
        if ($name -eq "AWS_ACCESS_KEY_ID" -or $name -eq "AWS_SECRET_ACCESS_KEY") {
            $hasAwsCreds = $true
            Write-Host "     ⚠️  WARNING: AWS credentials found in environment!" -ForegroundColor Red
        }
    }
    
    if (-not $hasAwsCreds) {
        Write-Host ""
        Write-Host "   ✅ No AWS credentials in environment (good - will use IAM role)" -ForegroundColor Green
    }
} else {
    Write-Host "   ❌ Error getting environment variables" -ForegroundColor Red
}

Write-Host ""

# Check 2: Lambda execution role
Write-Host "2. Checking Lambda execution role..." -ForegroundColor Yellow
$roleArn = aws lambda get-function-configuration --function-name hisab-api --region ap-south-1 --query "Role" --output text 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "   Role ARN: $roleArn" -ForegroundColor Cyan
    
    # Extract role name
    if ($roleArn -match "role/(.+)$") {
        $roleName = $matches[1]
        Write-Host "   Role Name: $roleName" -ForegroundColor Cyan
    }
} else {
    Write-Host "   ❌ Error getting role ARN" -ForegroundColor Red
}

Write-Host ""

# Check 3: Lambda last modified time
Write-Host "3. Checking Lambda last modified time..." -ForegroundColor Yellow
$lastModified = aws lambda get-function-configuration --function-name hisab-api --region ap-south-1 --query "LastModified" --output text 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "   Last Modified: $lastModified" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "   If this is old, you need to redeploy the Lambda!" -ForegroundColor Yellow
    Write-Host "   Run: .\deployment\build-lambda-docker.ps1" -ForegroundColor White
} else {
    Write-Host "   ❌ Error getting last modified time" -ForegroundColor Red
}

Write-Host ""

# Check 4: DynamoDB tables exist
Write-Host "4. Checking if DynamoDB tables exist..." -ForegroundColor Yellow
$tables = aws dynamodb list-tables --region ap-south-1 --query "TableNames[?starts_with(@, 'hisab_')]" --output json 2>&1

if ($LASTEXITCODE -eq 0) {
    $tablesJson = $tables | ConvertFrom-Json
    if ($tablesJson.Count -gt 0) {
        Write-Host "   ✅ Found $($tablesJson.Count) hisab_ tables:" -ForegroundColor Green
        foreach ($table in $tablesJson) {
            Write-Host "      - $table" -ForegroundColor Cyan
        }
    } else {
        Write-Host "   ❌ No hisab_ tables found!" -ForegroundColor Red
        Write-Host "   You need to create the DynamoDB tables first." -ForegroundColor Yellow
    }
} else {
    Write-Host "   ❌ Error listing tables (may not have permission)" -ForegroundColor Red
    Write-Host "   Output: $tables" -ForegroundColor Gray
}

Write-Host ""
Write-Host "=== Recommendation ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "The 'UnrecognizedClientException' error usually means:" -ForegroundColor Yellow
Write-Host "1. The Lambda code is outdated and needs redeployment" -ForegroundColor White
Write-Host "2. The DynamoDB tables don't exist" -ForegroundColor White
Write-Host "3. There's a region mismatch" -ForegroundColor White
Write-Host ""
Write-Host "Try these steps:" -ForegroundColor Cyan
Write-Host "1. Rebuild and redeploy Lambda:" -ForegroundColor White
Write-Host "   .\deployment\build-lambda-docker.ps1" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Wait 30 seconds, then test again:" -ForegroundColor White
Write-Host "   .\deployment\test-after-iam-fix.ps1" -ForegroundColor Gray

