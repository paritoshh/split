# Quick check for latest Lambda error

$LAMBDA_FUNCTION = "hisab-api-v2"
$AWS_REGION = "ap-south-1"

Write-Host "=== Latest Lambda Error ===" -ForegroundColor Cyan
Write-Host ""

aws logs tail /aws/lambda/$LAMBDA_FUNCTION --since 2m --format short --region $AWS_REGION | Select-String -Pattern "ERROR|Exception|Traceback" -Context 0,20

Write-Host ""
Write-Host "=== Full Recent Logs ===" -ForegroundColor Cyan
Write-Host ""

aws logs tail /aws/lambda/$LAMBDA_FUNCTION --since 2m --format detailed --region $AWS_REGION

