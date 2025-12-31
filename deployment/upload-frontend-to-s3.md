# How to Upload Frontend to S3 Correctly

## Problem
When uploading folders through AWS Console, files often end up at the root level instead of maintaining folder structure (like `assets/index.js`).

## Solution Options

### Option 1: AWS Console - Upload Folder Contents (Recommended)

1. **Go to S3 Console** → Your bucket
2. **Delete all existing files** (or empty the bucket)
3. **Click "Upload"**
4. **Important:** Don't select the `dist` folder itself. Instead:
   - Navigate to `dist` folder in Windows Explorer
   - Select **ALL files and folders** inside `dist`:
     - `index.html` (file)
     - `assets` (folder - select the entire folder)
     - `icons` (folder - if exists)
     - `favicon.svg` (if exists)
     - `manifest.json` (if exists)
     - `sw.js` (if exists)
   - Drag and drop them into S3 upload window
5. **Verify the structure** before uploading:
   - You should see `index.html` at root
   - You should see `assets/` folder (with files inside)
   - You should see `icons/` folder (if exists)
6. **Click "Upload"**

### Option 2: AWS CLI (Easiest - Recommended)

Use AWS CLI to sync the entire `dist` folder:

```powershell
# Set your bucket name
$BUCKET_NAME = "your-bucket-name"

# Sync dist folder to S3 (maintains folder structure)
aws s3 sync .\frontend\dist\ s3://$BUCKET_NAME/ --delete

# Example:
# aws s3 sync .\frontend\dist\ s3://hisab-frontend-bucket/ --delete
```

**What this does:**
- `sync` - Uploads all files maintaining folder structure
- `--delete` - Deletes files in S3 that don't exist in dist (keeps S3 clean)

### Option 3: PowerShell Script (Automated)

I'll create a script that does this automatically.

## Verify Upload

After uploading, check in S3 Console:
- ✅ `index.html` should be at root level
- ✅ `assets/index-xxxxx.js` should exist (not `index-xxxxx.js` at root)
- ✅ `assets/index-xxxxx.css` should exist
- ✅ `icons/` folder should exist (if you have icons)

## Common Mistakes

❌ **Wrong:** Uploading `dist` folder itself → Creates `dist/index.html` instead of `index.html`
❌ **Wrong:** Selecting individual files from `assets` → Files end up at root
✅ **Correct:** Upload contents of `dist` folder, maintaining folder structure

