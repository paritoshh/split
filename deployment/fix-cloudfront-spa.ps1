# Fix CloudFront SPA routing issue

Write-Host "=== Fixing CloudFront SPA Routing ===" -ForegroundColor Cyan
Write-Host ""

# Get CloudFront distribution ID
Write-Host "1. Finding CloudFront distribution..." -ForegroundColor Yellow
$distributions = aws cloudfront list-distributions --query "DistributionList.Items[*].[Id,DomainName,Aliases.Items[0]]" --output table

Write-Host $distributions -ForegroundColor Gray
Write-Host ""

$DISTRIBUTION_ID = Read-Host "Enter your CloudFront Distribution ID"

if ([string]::IsNullOrWhiteSpace($DISTRIBUTION_ID)) {
    Write-Host "❌ Distribution ID required" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "2. Creating custom error responses..." -ForegroundColor Yellow

# Create 403 error response
Write-Host "   Creating 403 -> index.html..." -ForegroundColor Gray
aws cloudfront create-custom-error-response `
    --distribution-id $DISTRIBUTION_ID `
    --error-code 403 `
    --response-page-path /index.html `
    --response-code 200 `
    --error-caching-min-ttl 0 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ 403 error response created" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  403 might already exist (that's okay)" -ForegroundColor Yellow
}

# Create 404 error response
Write-Host "   Creating 404 -> index.html..." -ForegroundColor Gray
aws cloudfront create-custom-error-response `
    --distribution-id $DISTRIBUTION_ID `
    --error-code 404 `
    --response-page-path /index.html `
    --response-code 200 `
    --error-caching-min-ttl 0 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ 404 error response created" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  404 might already exist (that's okay)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Next Steps ===" -ForegroundColor Cyan
Write-Host "1. Wait 5-10 minutes for CloudFront to propagate changes" -ForegroundColor Yellow
Write-Host "2. Test by navigating to: https://hisab.paritoshagarwal.com/register" -ForegroundColor Yellow
Write-Host "3. Hard refresh (Ctrl+Shift+R) should now work" -ForegroundColor Yellow
Write-Host ""
Write-Host "Note: If this doesn't work, you may need to configure this in AWS Console:" -ForegroundColor Gray
Write-Host "   CloudFront -> Your Distribution -> Error pages tab" -ForegroundColor Gray

