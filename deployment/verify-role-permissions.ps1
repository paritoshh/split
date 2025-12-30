# Verify IAM Role Permissions for Lambda

$ROLE_NAME = "hisab-lambda-role-v2"
$AWS_REGION = "ap-south-1"

Write-Host "=== Verify IAM Role Permissions ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "Please verify these in AWS Console:" -ForegroundColor Yellow
Write-Host ""

Write-Host "STEP 1: Check Role Permissions" -ForegroundColor Green
Write-Host "-------------------------------" -ForegroundColor Green
Write-Host "1. Go to: https://console.aws.amazon.com/iam/" -ForegroundColor White
Write-Host "2. Click 'Roles' -> '$ROLE_NAME'" -ForegroundColor White
Write-Host "3. Click 'Permissions' tab" -ForegroundColor White
Write-Host "4. Verify these policies are ATTACHED:" -ForegroundColor White
Write-Host "   ✅ AmazonDynamoDBFullAccess" -ForegroundColor Green
Write-Host "   ✅ AWSLambdaBasicExecutionRole" -ForegroundColor Green
Write-Host ""
Write-Host "5. Verify:" -ForegroundColor White
Write-Host "   ✅ NO inline policies exist" -ForegroundColor Green
Write-Host "   ✅ Permissions boundary: 'Not set'" -ForegroundColor Green
Write-Host ""

Write-Host "STEP 2: Check Trust Relationship" -ForegroundColor Green
Write-Host "-------------------------------" -ForegroundColor Green
Write-Host "1. Click 'Trust relationships' tab" -ForegroundColor White
Write-Host "2. Should show:" -ForegroundColor White
Write-Host ""
Write-Host '   "Service": "lambda.amazonaws.com"' -ForegroundColor Cyan
Write-Host ""
Write-Host "3. If different, click 'Edit trust policy' and fix it" -ForegroundColor Yellow
Write-Host ""

Write-Host "STEP 3: Verify Lambda is Using This Role" -ForegroundColor Green
Write-Host "----------------------------------------" -ForegroundColor Green
Write-Host "1. Go to: https://console.aws.amazon.com/lambda/" -ForegroundColor White
Write-Host "2. Click on 'hisab-api-v2'" -ForegroundColor White
Write-Host "3. Go to 'Configuration' -> 'Permissions'" -ForegroundColor White
Write-Host "4. Verify 'Execution role' shows: $ROLE_NAME" -ForegroundColor White
Write-Host ""

Write-Host "STEP 4: Check for Organization/SCP Policies" -ForegroundColor Green
Write-Host "-------------------------------------------" -ForegroundColor Green
Write-Host "If you're in an AWS Organization, there might be Service Control Policies" -ForegroundColor Yellow
Write-Host "blocking DynamoDB access. Check with your AWS admin." -ForegroundColor Yellow
Write-Host ""

Write-Host "=== Alternative: Try Different Approach ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "If still failing, try attaching the policy directly to the role:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. IAM Console -> Roles -> $ROLE_NAME -> Permissions" -ForegroundColor White
Write-Host "2. Click 'Add permissions' -> 'Attach policies'" -ForegroundColor White
Write-Host "3. Search for 'AmazonDynamoDBFullAccess'" -ForegroundColor White
Write-Host "4. If it's already attached, try:" -ForegroundColor White
Write-Host "   - Detach it" -ForegroundColor Gray
Write-Host "   - Wait 30 seconds" -ForegroundColor Gray
Write-Host "   - Re-attach it" -ForegroundColor Gray
Write-Host "   - Wait 2-3 minutes" -ForegroundColor Gray
Write-Host "   - Test Lambda again" -ForegroundColor Gray
Write-Host ""

Write-Host "=== Debug: Check What Permissions Lambda Actually Has ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "You can also test by creating a simple test Lambda that tries to:" -ForegroundColor Yellow
Write-Host "1. List DynamoDB tables" -ForegroundColor White
Write-Host "2. Query a table" -ForegroundColor White
Write-Host ""
Write-Host "This will help isolate if it's a permissions issue or code issue." -ForegroundColor Yellow

