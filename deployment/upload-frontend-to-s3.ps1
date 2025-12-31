# Upload frontend dist folder to S3

param(
    [Parameter(Mandatory=$true)]
    [string]$BucketName,
    
    [Parameter(Mandatory=$false)]
    [string]$DistPath = ".\frontend\dist"
)

Write-Host "=== Uploading Frontend to S3 ===" -ForegroundColor Cyan
Write-Host ""

# Check if dist folder exists
if (-not (Test-Path $DistPath)) {
    Write-Host "❌ Error: dist folder not found at: $DistPath" -ForegroundColor Red
    Write-Host "   Please run 'npm run build' in the frontend folder first" -ForegroundColor Yellow
    exit 1
}

# Check if index.html exists
if (-not (Test-Path "$DistPath\index.html")) {
    Write-Host "❌ Error: index.html not found in dist folder" -ForegroundColor Red
    Write-Host "   Please run 'npm run build' in the frontend folder first" -ForegroundColor Yellow
    exit 1
}

Write-Host "📦 Source folder: $DistPath" -ForegroundColor Gray
Write-Host "🪣 S3 Bucket: $BucketName" -ForegroundColor Gray
Write-Host ""

# Check if AWS CLI is installed
$awsCli = Get-Command aws -ErrorAction SilentlyContinue
if (-not $awsCli) {
    Write-Host "❌ Error: AWS CLI not found" -ForegroundColor Red
    Write-Host "   Please install AWS CLI: https://aws.amazon.com/cli/" -ForegroundColor Yellow
    exit 1
}

# Verify bucket exists
Write-Host "1. Verifying S3 bucket exists..." -ForegroundColor Yellow
try {
    aws s3 ls "s3://$BucketName" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Error: Bucket '$BucketName' not found or not accessible" -ForegroundColor Red
        exit 1
    }
    Write-Host "   ✅ Bucket found" -ForegroundColor Green
} catch {
    Write-Host "❌ Error: Could not access bucket '$BucketName'" -ForegroundColor Red
    Write-Host "   Make sure you're logged in: aws configure" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "2. Uploading files (this may take a minute)..." -ForegroundColor Yellow

# Sync dist folder to S3
# --delete removes files in S3 that don't exist in dist
aws s3 sync $DistPath "s3://$BucketName/" --delete

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Upload complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "3. Next steps:" -ForegroundColor Cyan
    Write-Host "   - Go to CloudFront Console" -ForegroundColor Yellow
    Write-Host "   - Create invalidation for /*" -ForegroundColor Yellow
    Write-Host "   - Wait 2-3 minutes for cache to clear" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "4. Verify upload in S3 Console:" -ForegroundColor Cyan
    Write-Host "   - Check that index.html is at root level" -ForegroundColor Gray
    Write-Host "   - Check that assets/ folder exists with JS/CSS files" -ForegroundColor Gray
} else {
    Write-Host ""
    Write-Host "❌ Upload failed. Check the error above." -ForegroundColor Red
    exit 1
}

