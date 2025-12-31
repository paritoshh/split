# Direct upload script - no parameters needed
# Edit the bucket name below

$BUCKET_NAME = "your-bucket-name-here"  # <-- CHANGE THIS
$DIST_PATH = ".\frontend\dist"

Write-Host "=== Uploading Frontend to S3 ===" -ForegroundColor Cyan
Write-Host ""

# Check if dist folder exists
if (-not (Test-Path $DIST_PATH)) {
    Write-Host "❌ Error: dist folder not found. Run 'npm run build' first" -ForegroundColor Red
    exit 1
}

Write-Host "📦 Uploading from: $DIST_PATH" -ForegroundColor Gray
Write-Host "🪣 To S3 bucket: $BUCKET_NAME" -ForegroundColor Gray
Write-Host ""

# Upload using AWS CLI
Write-Host "Uploading files..." -ForegroundColor Yellow
aws s3 sync $DIST_PATH "s3://$BUCKET_NAME/" --delete

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Upload complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next: Create CloudFront invalidation for /*" -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "❌ Upload failed" -ForegroundColor Red
}

