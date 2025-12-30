# Check Lambda Trust Relationship
# The Lambda role needs to trust the Lambda service

Write-Host "=== Checking Lambda Role Trust Relationship ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "The Lambda execution role needs a trust relationship with Lambda service." -ForegroundColor Yellow
Write-Host ""
Write-Host "Please verify in AWS Console:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Go to: https://console.aws.amazon.com/iam/" -ForegroundColor White
Write-Host "2. Click 'Roles' -> 'hisab-lambda-role'" -ForegroundColor White
Write-Host "3. Click 'Trust relationships' tab" -ForegroundColor White
Write-Host "4. The trust policy should look like this:" -ForegroundColor White
Write-Host ""

$trustPolicy = @"
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Service": "lambda.amazonaws.com"
            },
            "Action": "sts:AssumeRole"
        }
    ]
}
"@

Write-Host $trustPolicy -ForegroundColor Green
Write-Host ""
Write-Host "If the trust policy is different or missing, click 'Edit trust policy'" -ForegroundColor Yellow
Write-Host "and replace it with the JSON above." -ForegroundColor Yellow
Write-Host ""

# Try to invoke Lambda directly to get more details
Write-Host "Attempting to invoke Lambda directly for diagnostics..." -ForegroundColor Yellow
Write-Host ""

$testPayload = @{
    httpMethod = "GET"
    path = "/health"
    headers = @{}
    body = $null
} | ConvertTo-Json -Compress

# Encode payload to base64 for invoke
$payloadBytes = [System.Text.Encoding]::UTF8.GetBytes($testPayload)
$payloadFile = "lambda-test-payload.json"
$testPayload | Out-File -FilePath $payloadFile -Encoding UTF8

$result = aws lambda invoke `
    --function-name hisab-api `
    --region ap-south-1 `
    --payload "file://$payloadFile" `
    --log-type Tail `
    response.json 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "Lambda invoked successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Response:" -ForegroundColor Cyan
    Get-Content response.json
    Write-Host ""
    
    # Decode and show logs
    $resultJson = $result | ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($resultJson.LogResult) {
        $logBytes = [System.Convert]::FromBase64String($resultJson.LogResult)
        $logs = [System.Text.Encoding]::UTF8.GetString($logBytes)
        Write-Host "Logs:" -ForegroundColor Cyan
        Write-Host $logs -ForegroundColor Gray
    }
} else {
    Write-Host "Error invoking Lambda:" -ForegroundColor Red
    Write-Host $result -ForegroundColor Gray
}

# Cleanup
Remove-Item -Force $payloadFile -ErrorAction SilentlyContinue
Remove-Item -Force response.json -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "=== Next Steps ===" -ForegroundColor Cyan
Write-Host "1. Verify the trust relationship in IAM Console" -ForegroundColor White
Write-Host "2. Redeploy Lambda: .\deployment\build-lambda-docker.ps1" -ForegroundColor White
Write-Host "3. Test again: .\deployment\test-after-iam-fix.ps1" -ForegroundColor White

