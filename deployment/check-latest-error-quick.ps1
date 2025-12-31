# Quick check of latest Lambda error

$LAMBDA_FUNCTION = "hisab-api-v2"
$AWS_REGION = "ap-south-1"

Write-Host "=== Latest Lambda Error ===" -ForegroundColor Cyan
Write-Host ""

# Get the latest logs
$logs = aws logs tail "/aws/lambda/$LAMBDA_FUNCTION" --since 5m --region $AWS_REGION 2>&1

if ($LASTEXITCODE -eq 0) {
    # Filter for errors
    $errorLines = $logs | Select-String -Pattern "ERROR|Exception|Traceback|Error|bcrypt|MissingBackendError|UnrecognizedClientException" -Context 2
    
    if ($errorLines) {
        Write-Host "=== Errors Found ===" -ForegroundColor Red
        foreach ($line in $errorLines) {
            if ($line -match "bcrypt|MissingBackendError") {
                Write-Host $line -ForegroundColor Red
            } elseif ($line -match "UnrecognizedClientException") {
                Write-Host $line -ForegroundColor Yellow
            } else {
                Write-Host $line -ForegroundColor Yellow
            }
        }
    } else {
        Write-Host "No errors found in recent logs" -ForegroundColor Green
        Write-Host ""
        Write-Host "Full recent logs:" -ForegroundColor Cyan
        Write-Host $logs -ForegroundColor Gray
    }
} else {
    Write-Host "Failed to get logs: $logs" -ForegroundColor Red
}
