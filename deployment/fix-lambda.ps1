# Fix Lambda Configuration Script
# Run this from PowerShell in the split directory

Write-Host "=== Fixing Lambda Configuration ===" -ForegroundColor Green
Write-Host ""

# Step 1: Generate a secure SECRET_KEY
Write-Host "1. Generating SECRET_KEY..." -ForegroundColor Yellow
$SECRET_KEY = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
Write-Host "   Generated: $SECRET_KEY" -ForegroundColor Gray
Write-Host ""

# Step 2: Update Lambda environment variables
Write-Host "2. Updating Lambda environment variables..." -ForegroundColor Yellow
$envVars = @{
    DATABASE_TYPE = "dynamodb"
    AWS_REGION = "ap-south-1"
    DYNAMODB_TABLE_PREFIX = "hisab_"
    SECRET_KEY = $SECRET_KEY
    ALLOWED_ORIGINS = "https://hisab.paritoshagarwal.com,http://localhost:5173,capacitor://localhost,http://127.0.0.1:5173"
    DEBUG = "false"
}

$envJson = ($envVars.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join ','
$envString = "{Variables={$envJson}}"

aws lambda update-function-configuration `
    --function-name hisab-api `
    --environment $envString

if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Environment variables updated!" -ForegroundColor Green
} else {
    Write-Host "   ❌ Failed to update environment variables" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 3: Check CloudWatch logs
Write-Host "3. Checking recent CloudWatch logs..." -ForegroundColor Yellow
Write-Host "   (This will show the last 20 log entries)" -ForegroundColor Gray
aws logs tail /aws/lambda/hisab-api --since 5m --format short --max-items 20
Write-Host ""

# Step 4: Verify DynamoDB tables
Write-Host "4. Verifying DynamoDB tables..." -ForegroundColor Yellow
$tables = aws dynamodb list-tables --query "TableNames[?starts_with(@, 'hisab_')]" --output json | ConvertFrom-Json
if ($tables.Count -gt 0) {
    Write-Host "   ✅ Found $($tables.Count) tables:" -ForegroundColor Green
    $tables | ForEach-Object { Write-Host "      - $_" -ForegroundColor Gray }
} else {
    Write-Host "   ⚠️  No tables found! Run: python backend/scripts/init_dynamodb.py" -ForegroundColor Yellow
}
Write-Host ""

# Step 5: Test Lambda function
Write-Host "5. Testing Lambda function..." -ForegroundColor Yellow
$testEvent = @{
    httpMethod = "GET"
    path = "/health"
    headers = @{
        origin = "https://hisab.paritoshagarwal.com"
    }
} | ConvertTo-Json

$testEvent | Out-File -FilePath test-event.json -Encoding utf8
aws lambda invoke --function-name hisab-api --payload file://test-event.json response.json | Out-Null

$response = Get-Content response.json | ConvertFrom-Json
if ($response.statusCode -eq 200) {
    Write-Host "   ✅ Lambda function is working!" -ForegroundColor Green
} else {
    Write-Host "   ❌ Lambda returned status code: $($response.statusCode)" -ForegroundColor Red
    Write-Host "   Response: $($response | ConvertTo-Json -Depth 5)" -ForegroundColor Gray
}
Write-Host ""

Write-Host "=== Next Steps ===" -ForegroundColor Green
Write-Host "1. Check CloudWatch logs if errors persist" -ForegroundColor White
Write-Host "2. Verify IAM role has DynamoDB permissions" -ForegroundColor White
Write-Host "3. Redeploy Lambda code if you made code changes:" -ForegroundColor White
Write-Host "   cd backend" -ForegroundColor Gray
Write-Host "   # Follow deploy-lambda.sh steps" -ForegroundColor Gray
Write-Host ""

