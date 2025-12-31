# Verify IAM policy is correctly attached

$LAMBDA_FUNCTION = "hisab-api-v2"
$AWS_REGION = "ap-south-1"

Write-Host "=== Verifying IAM Policy ===" -ForegroundColor Cyan
Write-Host ""

# Get Lambda function configuration
$lambdaConfig = aws lambda get-function-configuration `
    --function-name $LAMBDA_FUNCTION `
    --region $AWS_REGION | ConvertFrom-Json

$roleArn = $lambdaConfig.Role
$roleName = $roleArn.Split('/')[-1]

Write-Host "Lambda Role: $roleName" -ForegroundColor Yellow
Write-Host ""

# List attached policies
Write-Host "Attached Policies:" -ForegroundColor Cyan
$attachedPolicies = aws iam list-attached-role-policies --role-name $roleName | ConvertFrom-Json

if ($attachedPolicies.AttachedPolicies) {
    foreach ($policy in $attachedPolicies.AttachedPolicies) {
        Write-Host "  - $($policy.PolicyName)" -ForegroundColor Green
        Write-Host "    ARN: $($policy.PolicyArn)" -ForegroundColor Gray
        
        # Get policy document
        $policyDoc = aws iam get-policy --policy-arn $policy.PolicyArn | ConvertFrom-Json
        $policyVersion = aws iam get-policy-version `
            --policy-arn $policy.PolicyArn `
            --version-id $policyDoc.Policy.DefaultVersionId | ConvertFrom-Json
        
        Write-Host "    Document:" -ForegroundColor Gray
        $policyVersion.PolicyVersion.Document | ConvertTo-Json -Depth 10 | Write-Host -ForegroundColor Gray
        Write-Host ""
    }
} else {
    Write-Host "  ❌ No policies attached!" -ForegroundColor Red
}

# Check inline policies
Write-Host "Inline Policies:" -ForegroundColor Cyan
$inlinePolicies = aws iam list-role-policies --role-name $roleName | ConvertFrom-Json

if ($inlinePolicies.PolicyNames) {
    foreach ($policyName in $inlinePolicies.PolicyNames) {
        Write-Host "  - $policyName" -ForegroundColor Green
        $policyDoc = aws iam get-role-policy --role-name $roleName --policy-name $policyName | ConvertFrom-Json
        $policyDoc.PolicyDocument | ConvertTo-Json -Depth 10 | Write-Host -ForegroundColor Gray
        Write-Host ""
    }
} else {
    Write-Host "  No inline policies" -ForegroundColor Gray
}

# Check trust relationship
Write-Host "Trust Relationship:" -ForegroundColor Cyan
$role = aws iam get-role --role-name $roleName | ConvertFrom-Json
$role.Role.AssumeRolePolicyDocument | ConvertTo-Json -Depth 10 | Write-Host -ForegroundColor Gray

