# How to Upload Frontend to S3

## Quick Method (Recommended)

### Step 1: Edit the script
Open `deployment/upload-frontend-to-s3-direct.ps1` and change:
```powershell
$BUCKET_NAME = "your-bucket-name-here"  # Change this to your actual bucket name
```

### Step 2: Run the script
```powershell
cd D:\Paritosh\projects\split\split
powershell -ExecutionPolicy Bypass -File .\deployment\upload-frontend-to-s3-direct.ps1
```

## Alternative: Use AWS CLI Directly

```powershell
cd D:\Paritosh\projects\split\split\frontend
aws s3 sync .\dist\ s3://your-bucket-name/ --delete
```

Replace `your-bucket-name` with your actual S3 bucket name.

## If PowerShell Script Won't Run

### Method 1: Bypass Execution Policy
```powershell
powershell -ExecutionPolicy Bypass -File .\deployment\upload-frontend-to-s3-direct.ps1
```

### Method 2: Change Execution Policy (One-time)
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```
Then run:
```powershell
.\deployment\upload-frontend-to-s3-direct.ps1
```

### Method 3: Use AWS CLI Only
Just use the AWS CLI command directly (no script needed):
```powershell
aws s3 sync .\frontend\dist\ s3://your-bucket-name/ --delete
```

## Verify Upload

After uploading, check S3 Console:
- ✅ `index.html` at root
- ✅ `assets/` folder with JS/CSS files inside
- ✅ `icons/` folder (if exists)

