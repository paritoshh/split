# Complete IAM Fix Script
# This script helps verify and fix IAM permissions for Lambda

$ROLE_NAME = "hisab-lambda-role"
$AWS_REGION = "ap-south-1"
$AWS_ACCOUNT_ID = "294618942342"

Write-Host "=== Complete IAM Fix ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "This script will help you verify and fix IAM permissions." -ForegroundColor Yellow
Write-Host ""

# Get account ID
$identity = aws sts get-caller-identity --output json 2>&1
if ($LASTEXITCODE -eq 0) {
    $identityJson = $identity | ConvertFrom-Json
    $detectedAccountId = $identityJson.Account
    Write-Host "✅ Detected AWS Account ID: $detectedAccountId" -ForegroundColor Green
    if ($detectedAccountId -ne $AWS_ACCOUNT_ID) {
        Write-Host "⚠️  Warning: Script uses $AWS_ACCOUNT_ID but your account is $detectedAccountId" -ForegroundColor Yellow
        $AWS_ACCOUNT_ID = $detectedAccountId
    }
} else {
    Write-Host "⚠️  Could not detect account ID, using: $AWS_ACCOUNT_ID" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== SOLUTION ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Since you have 'AmazonDynamoDBFullAccess_v2' attached, the inline policy" -ForegroundColor Yellow
Write-Host "might be causing conflicts. Let's try TWO approaches:" -ForegroundColor Yellow
Write-Host ""

Write-Host "APPROACH 1: Remove inline policy (use only managed policy)" -ForegroundColor Green
Write-Host "-----------------------------------------------------------" -ForegroundColor Green
Write-Host ""
Write-Host "1. Go to IAM Console: https://console.aws.amazon.com/iam/" -ForegroundColor White
Write-Host "2. Click 'Roles' -> '$ROLE_NAME'" -ForegroundColor White
Write-Host "3. Click 'Permissions' tab" -ForegroundColor White
Write-Host "4. Find inline policy 'HisabDynamoDBAccess'" -ForegroundColor White
Write-Host "5. Click on it -> Click 'Delete' -> Confirm deletion" -ForegroundColor White
Write-Host ""
Write-Host "Since you have 'AmazonDynamoDBFullAccess_v2', you don't need the inline policy!" -ForegroundColor Green
Write-Host ""

Write-Host "APPROACH 2: Fix inline policy (if you want to keep it)" -ForegroundColor Green
Write-Host "-------------------------------------------------------" -ForegroundColor Green
Write-Host ""
Write-Host "If you want to keep the inline policy, make sure it uses your account ID:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Go to IAM Console -> Roles -> $ROLE_NAME -> Permissions" -ForegroundColor White
Write-Host "2. Click on 'HisabDynamoDBAccess' -> Edit -> JSON" -ForegroundColor White
Write-Host "3. Replace with this (using account ID $AWS_ACCOUNT_ID):" -ForegroundColor White
Write-Host ""

$correctPolicy = @"
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "dynamodb:PutItem",
                "dynamodb:GetItem",
                "dynamodb:UpdateItem",
                "dynamodb:DeleteItem",
                "dynamodb:Query",
                "dynamodb:Scan",
                "dynamodb:BatchGetItem",
                "dynamodb:BatchWriteItem",
                "dynamodb:DescribeTable"
            ],
            "Resource": [
                "arn:aws:dynamodb:$AWS_REGION:$AWS_ACCOUNT_ID:table/hisab_*",
                "arn:aws:dynamodb:$AWS_REGION:$AWS_ACCOUNT_ID:table/hisab_*/index/*"
            ]
        }
    ]
}
"@

Write-Host $correctPolicy -ForegroundColor Cyan
Write-Host ""
Write-Host "4. Click 'Next' -> 'Save changes'" -ForegroundColor White
Write-Host ""

Write-Host "=== RECOMMENDED: Try Approach 1 First ===" -ForegroundColor Yellow
Write-Host ""
Write-Host "Since 'AmazonDynamoDBFullAccess_v2' gives full DynamoDB access," -ForegroundColor Yellow
Write-Host "the inline policy is redundant and might be causing conflicts." -ForegroundColor Yellow
Write-Host ""

Write-Host "=== After Fixing ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Wait 30-60 seconds for IAM to propagate" -ForegroundColor White
Write-Host "2. Test again in browser console:" -ForegroundColor White
Write-Host ""
Write-Host '   fetch("https://e65w7up0h8.execute-api.ap-south-1.amazonaws.com/api/auth/register", {' -ForegroundColor Gray
Write-Host '     method: "POST",' -ForegroundColor Gray
Write-Host '     headers: { "Content-Type": "application/json" },' -ForegroundColor Gray
Write-Host '     body: JSON.stringify({' -ForegroundColor Gray
Write-Host '       name: "Test",' -ForegroundColor Gray
Write-Host '       email: "test" + Date.now() + "@test.com",' -ForegroundColor Gray
Write-Host '       password: "test123"' -ForegroundColor Gray
Write-Host '     })' -ForegroundColor Gray
Write-Host '   }).then(r => r.json()).then(console.log).catch(console.error)' -ForegroundColor Gray
Write-Host ""

