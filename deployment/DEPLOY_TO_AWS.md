# Deploy to AWS - Step by Step Guide

## Prerequisites
- ✅ Local testing is working
- ✅ Docker Desktop is running (for Lambda build)
- ✅ AWS CLI is configured with your credentials
- ✅ All code changes are committed and pushed

## Step 1: Verify Lambda Environment Variables

**IMPORTANT:** Make sure `DYNAMODB_ENDPOINT_URL` is **NOT** set in Lambda environment variables.

```powershell
.\deployment\check-lambda-env-vars.ps1
```

If `DYNAMODB_ENDPOINT_URL` is set, remove it:
```powershell
aws lambda update-function-configuration `
    --function-name hisab-api-v2 `
    --environment "Variables={DATABASE_TYPE=dynamodb,DYNAMODB_TABLE_PREFIX=hisab_,SECRET_KEY=YOUR_SECRET_KEY,ALLOWED_ORIGINS=https://hisab.paritoshagarwal.com,http://localhost:5173,capacitor://localhost,http://127.0.0.1:5173,DEBUG=false}" `
    --region ap-south-1
```

**Note:** Replace `YOUR_SECRET_KEY` with your actual secret key.

## Step 2: Build and Deploy Lambda Function

This builds the Lambda package in Docker (Linux-compatible) and uploads it:

```powershell
.\deployment\build-lambda-docker.ps1
```

This will:
1. Build Docker image with Linux dependencies
2. Create `lambda_deployment.zip` (20-40 MB)
3. Upload to Lambda function `hisab-api-v2`
4. Take 2-5 minutes

## Step 3: Build Frontend

```powershell
cd frontend
npm run build
cd ..
```

This creates the `frontend/dist` folder with production build.

## Step 4: Upload Frontend to S3

```powershell
.\deployment\upload-frontend-to-s3.ps1 -BucketName "your-s3-bucket-name"
```

Replace `your-s3-bucket-name` with your actual S3 bucket name (e.g., `hisab-paritosh-frontend`).

## Step 5: Invalidate CloudFront Cache

After uploading frontend, you need to clear CloudFront cache:

1. Go to AWS Console → CloudFront
2. Find your distribution
3. Go to "Invalidations" tab
4. Create invalidation with path: `/*`
5. Wait 2-3 minutes for cache to clear

Or use AWS CLI:
```powershell
aws cloudfront create-invalidation `
    --distribution-id YOUR_DISTRIBUTION_ID `
    --paths "/*"
```

## Step 6: Test the Deployment

1. **Test API directly:**
   ```powershell
   .\deployment\test-api.ps1
   ```

2. **Test in browser:**
   - Go to `https://hisab.paritoshagarwal.com`
   - Try logging in
   - Create a group
   - Create an expense

3. **Check Lambda logs:**
   ```powershell
   aws logs tail /aws/lambda/hisab-api-v2 --since 5m --follow
   ```

## Troubleshooting

### If APIs are slow or timing out:
- Check Lambda logs for errors
- Verify DynamoDB tables exist in AWS
- Check IAM role permissions

### If frontend shows blank screen:
- Check browser console for errors
- Verify CloudFront invalidation completed
- Check S3 bucket has `index.html` at root

### If CORS errors:
- Verify `ALLOWED_ORIGINS` in Lambda env vars includes your domain
- Check API Gateway CORS settings

## Environment Detection

The code automatically detects the environment:
- **Local:** Uses `DYNAMODB_ENDPOINT_URL=http://localhost:8000` from `.env`
- **AWS Lambda:** Uses IAM role (no `DYNAMODB_ENDPOINT_URL` needed)

No code changes needed - just ensure Lambda env vars don't have `DYNAMODB_ENDPOINT_URL` set.

