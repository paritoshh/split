# ===========================================
# BUILD LAMBDA PACKAGE USING DOCKER
# ===========================================
# This builds the Lambda package in a Linux container
# to ensure all dependencies (especially pydantic-core) 
# are compiled for Linux (Lambda's runtime)
# ===========================================

$LAMBDA_FUNCTION_NAME = "hisab-api-v2"
$AWS_REGION = "ap-south-1"

Write-Host "========================================" -ForegroundColor Green
Write-Host "  Building Lambda Package (Docker)" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Check if Docker is running
Write-Host "Checking Docker..." -ForegroundColor Yellow
try {
    docker ps | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}

# Navigate to project root
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptPath
Set-Location $projectRoot

# Clean up old files
Write-Host ""
Write-Host "Cleaning up old files..." -ForegroundColor Yellow
if (Test-Path "lambda_deployment.zip") {
    Remove-Item -Force "lambda_deployment.zip"
}

# Build Docker image and create package
Write-Host ""
Write-Host "Building Lambda package in Docker (this may take 2-5 minutes)..." -ForegroundColor Yellow
Write-Host "This will install all Python dependencies compiled for Linux..." -ForegroundColor Gray
Write-Host ""

Write-Host "Building Docker image (this may take a few minutes)..." -ForegroundColor Gray
$buildOutput = docker build -f deployment/Dockerfile.lambda -t hisab-lambda-builder . 2>&1
$buildExitCode = $LASTEXITCODE

if ($buildExitCode -ne 0) {
    Write-Host "❌ Docker build failed!" -ForegroundColor Red
    Write-Host "Build output:" -ForegroundColor Yellow
    Write-Host $buildOutput -ForegroundColor Gray
    exit 1
}

Write-Host "✅ Docker build completed successfully" -ForegroundColor Green

# Check for bcrypt in build output
if ($buildOutput -match "bcrypt") {
    Write-Host ""
    Write-Host "=== Bcrypt Status ===" -ForegroundColor Cyan
    $bcryptLines = $buildOutput | Select-String -Pattern "bcrypt" -Context 0,2
    Write-Host $bcryptLines -ForegroundColor Gray
}

# Extract zip file from container
Write-Host ""
Write-Host "Extracting deployment package..." -ForegroundColor Yellow
docker create --name lambda-builder-temp hisab-lambda-builder 2>&1 | Out-Null

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to create container" -ForegroundColor Red
    exit 1
}

docker cp lambda-builder-temp:/build/lambda_deployment.zip ./lambda_deployment.zip
docker rm lambda-builder-temp 2>&1 | Out-Null

if (-not (Test-Path "lambda_deployment.zip")) {
    Write-Host "❌ Failed to extract zip file from container" -ForegroundColor Red
    Write-Host "Checking container contents..." -ForegroundColor Yellow
    docker run --rm hisab-lambda-builder ls -la /build/ 2>&1
    exit 1
}

# Get zip size and verify it's reasonable
$zipSize = (Get-Item lambda_deployment.zip).Length / 1MB
Write-Host "✅ Package created: $([math]::Round($zipSize, 2)) MB" -ForegroundColor Green

if ($zipSize -lt 10) {
    Write-Host "⚠️  Warning: Package seems too small. It should be 20-40 MB." -ForegroundColor Yellow
}
if ($zipSize -gt 50) {
    Write-Host "⚠️  Warning: Package is larger than 50MB. Lambda direct upload limit is 50MB." -ForegroundColor Yellow
}

# Upload to Lambda
Write-Host ""
Write-Host "🚀 Uploading to Lambda..." -ForegroundColor Yellow
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

# Clean up (keep zip for inspection if needed)
Write-Host ""
Write-Host "Cleaning up..." -ForegroundColor Gray
Write-Host "Note: lambda_deployment.zip is kept for inspection. Delete manually if needed." -ForegroundColor Gray
# Remove-Item -Force lambda_deployment.zip  # Commented out to allow package inspection

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "✅ Lambda deployment complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "Function: $LAMBDA_FUNCTION_NAME" -ForegroundColor Yellow
Write-Host "Region: $AWS_REGION" -ForegroundColor Yellow
Write-Host ""
Write-Host "Testing Lambda..." -ForegroundColor Yellow
Write-Host "Check logs with: aws logs tail /aws/lambda/$LAMBDA_FUNCTION_NAME --since 1m" -ForegroundColor Gray
Write-Host ""

