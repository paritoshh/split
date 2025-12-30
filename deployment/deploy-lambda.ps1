# ===========================================
# DEPLOY BACKEND TO AWS LAMBDA (PowerShell)
# ===========================================
# This script:
# 1. Creates a deployment package with dependencies
# 2. Uploads to AWS Lambda
#
# Prerequisites:
#   - AWS CLI configured with credentials
#   - Lambda function created
#   - IAM role with DynamoDB permissions
#
# Usage:
#   .\deploy-lambda.ps1
# ===========================================

# Configuration
$LAMBDA_FUNCTION_NAME = "hisab-api"
$AWS_REGION = "ap-south-1"

Write-Host "========================================" -ForegroundColor Green
Write-Host "  HISAB - Lambda Deployment" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

# Check if AWS CLI is installed
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    Write-Host "Error: AWS CLI not installed" -ForegroundColor Red
    exit 1
}

# Navigate to backend directory
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendPath = Join-Path $scriptPath ".." "backend"
Set-Location $backendPath

# Create deployment directory
Write-Host ""
Write-Host "📦 Creating deployment package..." -ForegroundColor Yellow

# Clean up old package
if (Test-Path "lambda_package") {
    Remove-Item -Recurse -Force lambda_package
}
if (Test-Path "lambda_deployment.zip") {
    Remove-Item -Force lambda_deployment.zip
}

New-Item -ItemType Directory -Path lambda_package | Out-Null

# Install dependencies to package directory
Write-Host "Installing dependencies..." -ForegroundColor Gray
pip install -r requirements.txt -t lambda_package/ --quiet --disable-pip-version-check

# Copy application code
Write-Host "Copying application code..." -ForegroundColor Gray
Copy-Item -Recurse app lambda_package/
Copy-Item lambda_handler.py lambda_package/

# Create zip file
Write-Host "Creating zip file..." -ForegroundColor Gray
Set-Location lambda_package
Compress-Archive -Path * -DestinationPath ..\lambda_deployment.zip -Force
Set-Location ..

# Get zip size
$zipSize = (Get-Item lambda_deployment.zip).Length / 1MB
Write-Host "✅ Package created: $([math]::Round($zipSize, 2)) MB" -ForegroundColor Green

# Check if Lambda function exists
Write-Host ""
Write-Host "🚀 Uploading to Lambda..." -ForegroundColor Yellow
try {
    aws lambda update-function-code `
        --function-name $LAMBDA_FUNCTION_NAME `
        --zip-file fileb://lambda_deployment.zip `
        --region $AWS_REGION `
        --no-cli-pager | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Lambda function updated successfully!" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to update Lambda function" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
    exit 1
}

# Clean up
Write-Host ""
Write-Host "Cleaning up..." -ForegroundColor Gray
Remove-Item -Recurse -Force lambda_package
Remove-Item -Force lambda_deployment.zip

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "✅ Lambda deployment complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "Function: $LAMBDA_FUNCTION_NAME" -ForegroundColor Yellow
Write-Host "Region: $AWS_REGION" -ForegroundColor Yellow
Write-Host ""

