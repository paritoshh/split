# Verify Lambda IAM Role Configuration
# This script checks if the Lambda function has the correct IAM role attached

$FUNCTION_NAME = "hisab-api"

Write-Host "=== Verifying Lambda IAM Role ===" -ForegroundColor Cyan
Write-Host ""

# Get Lambda function configuration
Write-Host "1. Checking Lambda function configuration..." -ForegroundColor Yellow
try {
    $lambdaConfig = aws lambda get-function-configuration --function-name $FUNCTION_NAME --region ap-south-1 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Error getting Lambda configuration:" -ForegroundColor Red
        Write-Host $lambdaConfig
        exit 1
    }
    
    $configJson = $lambdaConfig | ConvertFrom-Json
    $roleArn = $configJson.Role
    
    Write-Host "✅ Lambda function found: $FUNCTION_NAME" -ForegroundColor Green
    Write-Host "   Role ARN: $roleArn" -ForegroundColor Cyan
    Write-Host ""
    
    # Extract role name from ARN
    if ($roleArn -match "arn:aws:iam::(\d+):role/(.+)") {
        $roleName = $matches[2]
        Write-Host "2. Checking IAM role: $roleName" -ForegroundColor Yellow
        
        # Get role details
        $roleDetails = aws iam get-role --role-name $roleName 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ Error getting role details:" -ForegroundColor Red
            Write-Host $roleDetails
            exit 1
        }
        
        $roleJson = $roleDetails | ConvertFrom-Json
        Write-Host "✅ Role found: $roleName" -ForegroundColor Green
        Write-Host ""
        
        # Check trust relationship
        Write-Host "3. Checking trust relationship..." -ForegroundColor Yellow
        $trustPolicy = $roleJson.Role.AssumeRolePolicyDocument | ConvertTo-Json -Depth 10
        Write-Host "Trust Policy:" -ForegroundColor Cyan
        Write-Host $trustPolicy
        Write-Host ""
        
        # List attached policies
        Write-Host "4. Checking attached policies..." -ForegroundColor Yellow
        $attachedPolicies = aws iam list-attached-role-policies --role-name $roleName 2>&1
        if ($LASTEXITCODE -eq 0) {
            $policiesJson = $attachedPolicies | ConvertFrom-Json
            if ($policiesJson.AttachedPolicies.Count -gt 0) {
                Write-Host "✅ Attached managed policies:" -ForegroundColor Green
                foreach ($policy in $policiesJson.AttachedPolicies) {
                    Write-Host "   - $($policy.PolicyName)" -ForegroundColor Cyan
                }
            } else {
                Write-Host "⚠️  No managed policies attached" -ForegroundColor Yellow
            }
        }
        Write-Host ""
        
        # List inline policies
        Write-Host "5. Checking inline policies..." -ForegroundColor Yellow
        $inlinePolicies = aws iam list-role-policies --role-name $roleName 2>&1
        if ($LASTEXITCODE -eq 0) {
            $inlineJson = $inlinePolicies | ConvertFrom-Json
            if ($inlineJson.PolicyNames.Count -gt 0) {
                Write-Host "✅ Inline policies:" -ForegroundColor Green
                foreach ($policyName in $inlineJson.PolicyNames) {
                    Write-Host "   - $policyName" -ForegroundColor Cyan
                    
                    # Get policy document
                    $policyDoc = aws iam get-role-policy --role-name $roleName --policy-name $policyName 2>&1
                    if ($LASTEXITCODE -eq 0) {
                        $policyJson = $policyDoc | ConvertFrom-Json
                        $policyDocument = $policyJson.PolicyDocument | ConvertTo-Json -Depth 10
                        Write-Host "     Policy Document:" -ForegroundColor Gray
                        Write-Host $policyDocument
                    }
                }
            } else {
                Write-Host "❌ No inline policies found!" -ForegroundColor Red
                Write-Host "   This is likely the problem - the Lambda needs a policy with DynamoDB permissions." -ForegroundColor Yellow
            }
        }
        Write-Host ""
        
        # Check if role has basic Lambda execution permissions
        Write-Host "6. Verifying basic Lambda execution permissions..." -ForegroundColor Yellow
        $hasBasicLambda = $false
        if ($policiesJson.AttachedPolicies) {
            foreach ($policy in $policiesJson.AttachedPolicies) {
                if ($policy.PolicyArn -like "*AWSLambdaBasicExecutionRole*") {
                    $hasBasicLambda = $true
                    Write-Host "✅ Basic Lambda execution role attached" -ForegroundColor Green
                    break
                }
            }
        }
        if (-not $hasBasicLambda) {
            Write-Host "⚠️  Basic Lambda execution role not found (may be in inline policy)" -ForegroundColor Yellow
        }
        
    } else {
        Write-Host "❌ Could not parse role ARN: $roleArn" -ForegroundColor Red
    }
    
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host "If you see 'No inline policies found', you need to:" -ForegroundColor Yellow
Write-Host "1. Go to IAM Console → Roles → $roleName" -ForegroundColor White
Write-Host "2. Click 'Add permissions' → 'Create inline policy'" -ForegroundColor White
Write-Host "3. Use the JSON from correct-dynamodb-policy.json" -ForegroundColor White
Write-Host "4. Name it 'HisabDynamoDBAccess' and save" -ForegroundColor White

