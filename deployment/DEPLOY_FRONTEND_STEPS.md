# Frontend Deployment Steps

## Step 1: Build the Frontend

```powershell
cd frontend
npm run build
cd ..
```

This creates a `dist` folder with all the production-ready files.

---

## Step 2: Upload to S3 Bucket

### Option A: Using AWS Console (Web UI)

1. **Open AWS Console** → Go to S3 service
2. **Find your bucket** (likely named something like `hisab-frontend` or `paritoshagarwal.com`)
3. **Open the bucket**
4. **Delete old files** (optional but recommended):
   - Select all files
   - Click "Delete"
5. **Upload new files**:
   - Click "Upload"
   - Click "Add files"
   - Navigate to `frontend/dist` folder
   - Select ALL files and folders inside `dist` (not the `dist` folder itself)
   - Click "Upload"
   - Wait for upload to complete

### Option B: Using AWS CLI

```powershell
# Set your bucket name (replace with your actual bucket name)
$BUCKET_NAME = "your-s3-bucket-name"

# Sync dist folder to S3 (deletes old files, uploads new ones)
aws s3 sync frontend/dist s3://$BUCKET_NAME --delete --region ap-south-1
```

### Option C: Using PowerShell Script

```powershell
# Navigate to project root
cd D:\Paritosh\projects\split\split

# Set bucket name
$BUCKET_NAME = "your-s3-bucket-name"

# Upload all files from dist folder
Get-ChildItem -Path "frontend\dist" -Recurse | ForEach-Object {
    $relativePath = $_.FullName.Replace((Resolve-Path "frontend\dist").Path + "\", "")
    $s3Key = $relativePath.Replace("\", "/")
    
    if (-not $_.PSIsContainer) {
        Write-Host "Uploading: $s3Key" -ForegroundColor Yellow
        aws s3 cp $_.FullName "s3://$BUCKET_NAME/$s3Key" --region ap-south-1
    }
}
```

---

## Step 3: Clear CloudFront Cache

CloudFront caches your files, so you need to invalidate the cache to see changes.

### Option A: Using AWS Console

1. **Open AWS Console** → Go to CloudFront service
2. **Find your distribution** (the one pointing to `hisab.paritoshagarwal.com`)
3. **Click on the distribution ID**
4. **Go to "Invalidations" tab**
5. **Click "Create invalidation"**
6. **Enter paths to invalidate**:
   - For all files: `/*`
   - For specific files: `/index.html`, `/assets/*`, etc.
7. **Click "Create invalidation"**
8. **Wait 1-5 minutes** for invalidation to complete

### Option B: Using AWS CLI

```powershell
# Get your CloudFront distribution ID
# (You can find this in CloudFront console or from your deployment config)

$DISTRIBUTION_ID = "your-cloudfront-distribution-id"

# Create invalidation for all files
aws cloudfront create-invalidation `
    --distribution-id $DISTRIBUTION_ID `
    --paths "/*" `
    --region ap-south-1
```

### Option C: Using PowerShell Script

```powershell
# List all CloudFront distributions to find yours
aws cloudfront list-distributions --query "DistributionList.Items[*].[Id,DomainName,Aliases.Items[0]]" --output table

# Then create invalidation
$DISTRIBUTION_ID = "your-distribution-id"
aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths "/*"
```

---

## Step 4: Verify Deployment

1. **Wait 1-2 minutes** for CloudFront to update
2. **Open** `https://hisab.paritoshagarwal.com` in your browser
3. **Hard refresh** (Ctrl+F5 or Cmd+Shift+R) to bypass browser cache
4. **Check browser console** (F12) for any errors
5. **Test registration/login** to verify API is working

---

## Quick Deployment Script (All-in-One)

Save this as `deploy-frontend-windows.ps1`:

```powershell
# Frontend Deployment Script for Windows

$BUCKET_NAME = "your-s3-bucket-name"
$DISTRIBUTION_ID = "your-cloudfront-distribution-id"
$AWS_REGION = "ap-south-1"

Write-Host "=== Building Frontend ===" -ForegroundColor Cyan
cd frontend
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}
cd ..

Write-Host ""
Write-Host "=== Uploading to S3 ===" -ForegroundColor Cyan
aws s3 sync frontend/dist s3://$BUCKET_NAME --delete --region $AWS_REGION
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Upload failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== Creating CloudFront Invalidation ===" -ForegroundColor Cyan
aws cloudfront create-invalidation `
    --distribution-id $DISTRIBUTION_ID `
    --paths "/*" `
    --region $AWS_REGION

Write-Host ""
Write-Host "✅ Deployment complete!" -ForegroundColor Green
Write-Host "Wait 1-2 minutes, then visit: https://hisab.paritoshagarwal.com" -ForegroundColor Yellow
```

---

## Finding Your S3 Bucket and CloudFront Distribution

### Find S3 Bucket:
```powershell
aws s3 ls | Select-String "hisab\|paritosh"
```

### Find CloudFront Distribution:
```powershell
aws cloudfront list-distributions --query "DistributionList.Items[*].[Id,DomainName,Aliases.Items[0]]" --output table
```

Look for the distribution with `hisab.paritoshagarwal.com` in the Aliases column.

---

## Troubleshooting

### Files not updating?
- Wait 5-10 minutes for CloudFront cache to expire
- Create a new invalidation
- Hard refresh browser (Ctrl+F5)

### Getting 404 errors?
- Check S3 bucket permissions (should be public read)
- Verify CloudFront origin points to correct S3 bucket
- Check CloudFront error pages configuration

### API calls failing?
- Verify API Gateway URL in `frontend/src/services/api.js`
- Check CORS settings in Lambda
- Check browser console for CORS errors

