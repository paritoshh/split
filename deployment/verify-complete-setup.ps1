# Complete AWS Setup Verification Script
# This script checks all components of the AWS deployment

$AWS_REGION = "ap-south-1"
$LAMBDA_FUNCTION = "hisab-api"
$TABLE_PREFIX = "hisab_"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  COMPLETE AWS SETUP VERIFICATION" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$allPassed = $true

# ============================================
# STEP 1: AWS CLI Configuration
# ============================================
Write-Host "STEP 1: AWS CLI Configuration" -ForegroundColor Yellow
Write-Host "------------------------------" -ForegroundColor Yellow

$identity = aws sts get-caller-identity --output json 2>&1
if ($LASTEXITCODE -eq 0) {
    $identityJson = $identity | ConvertFrom-Json
    Write-Host "✅ AWS CLI configured" -ForegroundColor Green
    Write-Host "   Account: $($identityJson.Account)" -ForegroundColor Gray
    Write-Host "   User: $($identityJson.Arn)" -ForegroundColor Gray
    $AWS_ACCOUNT_ID = $identityJson.Account
} else {
    Write-Host "❌ AWS CLI not configured" -ForegroundColor Red
    Write-Host "   Run: aws configure" -ForegroundColor Yellow
    $allPassed = $false
}
Write-Host ""

# ============================================
# STEP 2: DynamoDB Tables
# ============================================
Write-Host "STEP 2: DynamoDB Tables" -ForegroundColor Yellow
Write-Host "------------------------------" -ForegroundColor Yellow

$requiredTables = @("users", "groups", "group_members", "expenses", "expense_splits", "settlements", "notifications")
$missingTables = @()

foreach ($table in $requiredTables) {
    $fullName = "$TABLE_PREFIX$table"
    $tableCheck = aws dynamodb describe-table --table-name $fullName --region $AWS_REGION 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Table exists: $fullName" -ForegroundColor Green
    } else {
        Write-Host "❌ Table missing: $fullName" -ForegroundColor Red
        $missingTables += $fullName
        $allPassed = $false
    }
}

if ($missingTables.Count -gt 0) {
    Write-Host ""
    Write-Host "   Missing tables. Create them via:" -ForegroundColor Yellow
    Write-Host "   .\deployment\create-dynamodb-tables.ps1" -ForegroundColor White
}
Write-Host ""

# ============================================
# STEP 3: Lambda Function
# ============================================
Write-Host "STEP 3: Lambda Function" -ForegroundColor Yellow
Write-Host "------------------------------" -ForegroundColor Yellow

$lambdaConfig = aws lambda get-function-configuration --function-name $LAMBDA_FUNCTION --region $AWS_REGION --output json 2>&1
if ($LASTEXITCODE -eq 0) {
    $lambdaJson = $lambdaConfig | ConvertFrom-Json
    Write-Host "✅ Lambda function exists: $LAMBDA_FUNCTION" -ForegroundColor Green
    Write-Host "   Runtime: $($lambdaJson.Runtime)" -ForegroundColor Gray
    Write-Host "   Memory: $($lambdaJson.MemorySize) MB" -ForegroundColor Gray
    Write-Host "   Timeout: $($lambdaJson.Timeout) seconds" -ForegroundColor Gray
    Write-Host "   Last Modified: $($lambdaJson.LastModified)" -ForegroundColor Gray
    Write-Host "   Role: $($lambdaJson.Role)" -ForegroundColor Gray
    
    # Extract role name
    if ($lambdaJson.Role -match "role/(.+)$") {
        $roleName = $matches[1]
    }
} else {
    Write-Host "❌ Lambda function not found: $LAMBDA_FUNCTION" -ForegroundColor Red
    Write-Host "   Create it in AWS Console or via CLI" -ForegroundColor Yellow
    $allPassed = $false
}
Write-Host ""

# ============================================
# STEP 4: Lambda Environment Variables
# ============================================
Write-Host "STEP 4: Lambda Environment Variables" -ForegroundColor Yellow
Write-Host "------------------------------" -ForegroundColor Yellow

if ($lambdaJson) {
    $envVars = $lambdaJson.Environment.Variables
    
    $requiredEnvVars = @("DATABASE_TYPE", "DYNAMODB_TABLE_PREFIX", "SECRET_KEY", "ALLOWED_ORIGINS")
    $badEnvVars = @("AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY")
    
    foreach ($var in $requiredEnvVars) {
        if ($envVars.$var) {
            Write-Host "✅ $var is set" -ForegroundColor Green
        } else {
            Write-Host "❌ $var is missing" -ForegroundColor Red
            $allPassed = $false
        }
    }
    
    foreach ($var in $badEnvVars) {
        if ($envVars.$var) {
            Write-Host "⚠️  WARNING: $var is set (SHOULD NOT BE!)" -ForegroundColor Red
            Write-Host "   Lambda should use IAM role, not explicit credentials" -ForegroundColor Yellow
            $allPassed = $false
        } else {
            Write-Host "✅ $var is NOT set (correct)" -ForegroundColor Green
        }
    }
    
    # Check DATABASE_TYPE value
    if ($envVars.DATABASE_TYPE -ne "dynamodb") {
        Write-Host "⚠️  DATABASE_TYPE should be 'dynamodb', got '$($envVars.DATABASE_TYPE)'" -ForegroundColor Yellow
    }
}
Write-Host ""

# ============================================
# STEP 5: Lambda IAM Role Permissions
# ============================================
Write-Host "STEP 5: Lambda IAM Role Permissions" -ForegroundColor Yellow
Write-Host "------------------------------" -ForegroundColor Yellow

if ($roleName) {
    # Check inline policies
    $inlinePolicies = aws iam list-role-policies --role-name $roleName --output json 2>&1
    if ($LASTEXITCODE -eq 0) {
        $inlineJson = $inlinePolicies | ConvertFrom-Json
        if ($inlineJson.PolicyNames -contains "HisabDynamoDBAccess") {
            Write-Host "✅ Inline policy 'HisabDynamoDBAccess' exists" -ForegroundColor Green
            
            # Get policy content
            $policyContent = aws iam get-role-policy --role-name $roleName --policy-name "HisabDynamoDBAccess" --output json 2>&1
            if ($LASTEXITCODE -eq 0) {
                $policyJson = $policyContent | ConvertFrom-Json
                $policyDoc = $policyJson.PolicyDocument | ConvertTo-Json -Depth 10
                
                # Check for common issues
                if ($policyDoc -match "dynamodb:Query") {
                    Write-Host "✅ DynamoDB Query permission exists" -ForegroundColor Green
                } else {
                    Write-Host "❌ DynamoDB Query permission missing" -ForegroundColor Red
                    $allPassed = $false
                }
                
                # Check for wildcard account ID (bad)
                if ($policyDoc -match ':\*:table') {
                    Write-Host "⚠️  Policy uses wildcard (*) for account ID" -ForegroundColor Yellow
                    Write-Host "   Consider using your actual account ID: $AWS_ACCOUNT_ID" -ForegroundColor Gray
                }
                
                # Check for empty account ID (very bad)
                if ($policyDoc -match '::table') {
                    Write-Host "❌ Policy has INVALID ARN (missing account ID)" -ForegroundColor Red
                    Write-Host "   Fix: Replace '::table' with ':$AWS_ACCOUNT_ID`:table'" -ForegroundColor Yellow
                    $allPassed = $false
                }
            }
        } else {
            Write-Host "❌ Inline policy 'HisabDynamoDBAccess' missing" -ForegroundColor Red
            Write-Host "   Add it to the role with DynamoDB permissions" -ForegroundColor Yellow
            $allPassed = $false
        }
    } else {
        Write-Host "⚠️  Cannot check inline policies (may not have permission)" -ForegroundColor Yellow
    }
    
    # Check attached policies
    $attachedPolicies = aws iam list-attached-role-policies --role-name $roleName --output json 2>&1
    if ($LASTEXITCODE -eq 0) {
        $attachedJson = $attachedPolicies | ConvertFrom-Json
        $hasBasicExecution = $false
        $hasDynamoDBFull = $false
        
        foreach ($policy in $attachedJson.AttachedPolicies) {
            if ($policy.PolicyName -eq "AWSLambdaBasicExecutionRole") {
                $hasBasicExecution = $true
            }
            if ($policy.PolicyName -eq "AmazonDynamoDBFullAccess") {
                $hasDynamoDBFull = $true
            }
        }
        
        if ($hasBasicExecution) {
            Write-Host "✅ AWSLambdaBasicExecutionRole attached" -ForegroundColor Green
        } else {
            Write-Host "⚠️  AWSLambdaBasicExecutionRole not attached" -ForegroundColor Yellow
        }
        
        if ($hasDynamoDBFull) {
            Write-Host "✅ AmazonDynamoDBFullAccess attached" -ForegroundColor Green
        }
    }
} else {
    Write-Host "⚠️  Cannot check role permissions (role name unknown)" -ForegroundColor Yellow
}
Write-Host ""

# ============================================
# STEP 6: API Gateway
# ============================================
Write-Host "STEP 6: API Gateway" -ForegroundColor Yellow
Write-Host "------------------------------" -ForegroundColor Yellow

$apis = aws apigatewayv2 get-apis --region $AWS_REGION --output json 2>&1
if ($LASTEXITCODE -eq 0) {
    $apisJson = $apis | ConvertFrom-Json
    $hisabApi = $apisJson.Items | Where-Object { $_.Name -like "*hisab*" }
    
    if ($hisabApi) {
        Write-Host "✅ API Gateway found: $($hisabApi.Name)" -ForegroundColor Green
        Write-Host "   Endpoint: $($hisabApi.ApiEndpoint)" -ForegroundColor Cyan
        $API_ENDPOINT = $hisabApi.ApiEndpoint
    } else {
        Write-Host "⚠️  No API Gateway with 'hisab' in name found" -ForegroundColor Yellow
        Write-Host "   Available APIs:" -ForegroundColor Gray
        foreach ($api in $apisJson.Items) {
            Write-Host "   - $($api.Name): $($api.ApiEndpoint)" -ForegroundColor Gray
        }
    }
} else {
    Write-Host "⚠️  Cannot list API Gateways" -ForegroundColor Yellow
}
Write-Host ""

# ============================================
# STEP 7: Test API Endpoints
# ============================================
Write-Host "STEP 7: Test API Endpoints" -ForegroundColor Yellow
Write-Host "------------------------------" -ForegroundColor Yellow

if ($API_ENDPOINT) {
    # Test health
    Write-Host "Testing /health..." -ForegroundColor Gray
    try {
        $healthResponse = Invoke-WebRequest -Uri "$API_ENDPOINT/health" -Method GET -UseBasicParsing -TimeoutSec 10
        if ($healthResponse.StatusCode -eq 200) {
            Write-Host "✅ Health endpoint: OK" -ForegroundColor Green
            Write-Host "   Response: $($healthResponse.Content)" -ForegroundColor Gray
        }
    } catch {
        Write-Host "❌ Health endpoint failed" -ForegroundColor Red
        $allPassed = $false
    }
    
    # Test register
    Write-Host "Testing /api/auth/register..." -ForegroundColor Gray
    $testEmail = "test$(Get-Random)@test.com"
    $registerBody = @{
        name = "Test User"
        email = $testEmail
        password = "test123"
    } | ConvertTo-Json
    
    try {
        $registerResponse = Invoke-WebRequest -Uri "$API_ENDPOINT/api/auth/register" -Method POST -Body $registerBody -ContentType "application/json" -UseBasicParsing -TimeoutSec 30
        Write-Host "✅ Register endpoint: OK (Status $($registerResponse.StatusCode))" -ForegroundColor Green
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode -eq 400) {
            Write-Host "✅ Register endpoint: OK (user may exist)" -ForegroundColor Green
        } elseif ($statusCode -eq 500) {
            Write-Host "❌ Register endpoint: 500 Internal Server Error" -ForegroundColor Red
            Write-Host "   This usually means DynamoDB access issue" -ForegroundColor Yellow
            Write-Host "   Check: .\deployment\check-error-details.ps1" -ForegroundColor White
            $allPassed = $false
        } else {
            Write-Host "❌ Register endpoint: Status $statusCode" -ForegroundColor Red
            $allPassed = $false
        }
    }
} else {
    Write-Host "⚠️  Skipping API tests (no endpoint found)" -ForegroundColor Yellow
}
Write-Host ""

# ============================================
# SUMMARY
# ============================================
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  VERIFICATION SUMMARY" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

if ($allPassed) {
    Write-Host "✅ ALL CHECKS PASSED!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Your AWS deployment is correctly configured." -ForegroundColor Green
} else {
    Write-Host "❌ SOME CHECKS FAILED" -ForegroundColor Red
    Write-Host ""
    Write-Host "Review the issues above and fix them." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Common fixes:" -ForegroundColor Cyan
    Write-Host "1. Create missing DynamoDB tables" -ForegroundColor White
    Write-Host "2. Fix IAM policy (use correct account ID)" -ForegroundColor White
    Write-Host "3. Remove AWS credentials from Lambda env vars" -ForegroundColor White
    Write-Host "4. Redeploy Lambda: .\deployment\build-lambda-docker.ps1" -ForegroundColor White
}
Write-Host ""

