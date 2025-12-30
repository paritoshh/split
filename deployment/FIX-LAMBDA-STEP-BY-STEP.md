# Fix Lambda Import Error - Step by Step

## Problem
Lambda is returning: `No module named 'pydantic_core._pydantic_core'`

This means the Lambda package is missing dependencies or they weren't compiled for Linux.

## Step 1: Test API Gateway Directly

Test if API Gateway is working (bypassing frontend):

```powershell
# Test health endpoint
curl https://2cjvid84h1.execute-api.ap-south-1.amazonaws.com/health

# Test register endpoint
curl -X POST https://2cjvid84h1.execute-api.ap-south-1.amazonaws.com/api/auth/register `
  -H "Content-Type: application/json" `
  -d '{\"name\":\"Test\",\"email\":\"test@test.com\",\"password\":\"test123\"}'
```

**Expected:** Should return 500 error (Lambda issue, not API Gateway)

## Step 2: Verify Docker Build Worked

Check if the Docker build actually completed:

```powershell
cd D:\Paritosh\projects\split\split

# Check if Docker image exists
docker images | findstr hisab-lambda-builder

# If image exists, check if zip was created
docker run --rm hisab-lambda-builder ls -lh /build/lambda_deployment.zip
```

## Step 3: Rebuild and Deploy (Clean Build)

If Docker build didn't work, do a clean rebuild:

```powershell
cd D:\Paritosh\projects\split\split

# Clean up old Docker images
docker rmi hisab-lambda-builder -f

# Clean up old zip files
Remove-Item lambda_deployment.zip -ErrorAction SilentlyContinue

# Run the deployment script
.\deployment\deploy-lambda.bat
```

**Watch for:**
- Docker build completes without errors
- "Package created: XX.XX MB" message
- "Lambda function updated successfully!" message

## Step 4: Verify Lambda Package Contents

After deployment, verify the package has dependencies:

```powershell
# Download current Lambda code (to verify)
aws lambda get-function --function-name hisab-api --query 'Code.Location' --output text | Out-File -FilePath lambda-url.txt
$url = Get-Content lambda-url.txt
Invoke-WebRequest -Uri $url -OutFile current-lambda.zip

# Extract and check
Expand-Archive -Path current-lambda.zip -DestinationPath lambda-check -Force
Get-ChildItem lambda-check\pydantic_core -ErrorAction SilentlyContinue

# Clean up
Remove-Item lambda-url.txt, current-lambda.zip, lambda-check -Recurse -Force -ErrorAction SilentlyContinue
```

**Expected:** Should see `pydantic_core` folder with `_pydantic_core.*` files

## Step 5: Check Lambda Logs After Deployment

```powershell
# Wait 30 seconds after deployment, then check logs
Start-Sleep -Seconds 30
aws logs tail /aws/lambda/hisab-api --since 1m --format short
```

**Expected:** Should see "Starting up Hisab App..." NOT "ImportModuleError"

## Step 6: Test Register API Again

```powershell
curl -X POST https://2cjvid84h1.execute-api.ap-south-1.amazonaws.com/api/auth/register `
  -H "Content-Type: application/json" `
  -d '{\"name\":\"Test User\",\"email\":\"test2@test.com\",\"password\":\"test123\"}'
```

**Expected:** Should return 200 or proper validation error (NOT 500)

---

## If Still Failing: Manual Docker Build

If the script doesn't work, build manually:

```powershell
cd D:\Paritosh\projects\split\split

# Build Docker image
docker build -f deployment/Dockerfile.lambda -t hisab-lambda-builder .

# Create container and extract zip
docker create --name temp-builder hisab-lambda-builder
docker cp temp-builder:/build/lambda_deployment.zip ./lambda_deployment.zip
docker rm temp-builder

# Check zip size (should be 20-40 MB)
Get-Item lambda_deployment.zip | Select-Object Name, Length

# Upload to Lambda
aws lambda update-function-code `
  --function-name hisab-api `
  --zip-file fileb://lambda_deployment.zip `
  --region ap-south-1

# Clean up
Remove-Item lambda_deployment.zip
```

---

## Quick Verification Checklist

- [ ] API Gateway responds (even if 500)
- [ ] Docker build completes without errors
- [ ] Zip file is created (20-40 MB)
- [ ] Lambda update succeeds
- [ ] CloudWatch logs show no ImportModuleError
- [ ] Register API returns 200 or validation error (not 500)

