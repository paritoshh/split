# Complete Fix for Blank White Screen

## The Problem

When you hard refresh (Ctrl+Shift+R), you get a blank white screen. This usually means:
1. **Frontend wasn't rebuilt** before deployment
2. **Wrong files uploaded** to S3
3. **JavaScript error** preventing React from rendering

## Step-by-Step Fix

### Step 1: Check Browser Console (CRITICAL)

1. Open `https://hisab.paritoshagarwal.com` in Chrome
2. Press **F12** → **Console** tab
3. Look for **red errors**
4. **Copy all errors** and share them

**Common errors:**
- `Failed to load module` → Wrong files deployed
- `Uncaught SyntaxError` → Build issue
- `Network Error` → API URL issue
- `CORS error` → CORS configuration

### Step 2: Rebuild Frontend (Windows)

```powershell
cd D:\Paritosh\projects\split\split\frontend
npm run build
```

**Verify the build:**
- Check `frontend/dist` folder exists
- Check `frontend/dist/index.html` exists
- Check `frontend/dist/assets` folder has JavaScript files

### Step 3: Check Built index.html

Open `frontend/dist/index.html` and verify it looks like this:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    ...
  </head>
  <body>
    <div id="root"></div>
    <script type="module" crossorigin src="/assets/index-xxxxx.js"></script>
  </body>
</html>
```

**Important:** The script should point to `/assets/index-xxxxx.js` (not `/src/main.jsx`)

### Step 4: Upload to S3

1. **Go to S3 Console** → Your bucket
2. **Delete ALL old files** (or empty the bucket)
3. **Upload ALL files from `frontend/dist`**:
   - `index.html`
   - `assets/` folder (entire folder)
   - `icons/` folder (if exists)
   - `favicon.svg` (if exists)
   - `manifest.json` (if exists)
   - `sw.js` (if exists)

**Important:** Upload the **entire contents** of `frontend/dist`, not the folder itself.

### Step 5: Clear CloudFront Cache

1. **Go to CloudFront Console** → Your distribution
2. **Invalidations** tab → **Create invalidation**
3. **Path:** `/*`
4. **Create**
5. **Wait 2-3 minutes**

### Step 6: Test

1. **Open in incognito/private window**: `https://hisab.paritoshagarwal.com`
2. **Hard refresh**: Ctrl+Shift+R
3. **Check console** for errors

## If Still Not Working

### Check Network Tab

1. **F12** → **Network** tab
2. **Hard refresh** (Ctrl+Shift+R)
3. Look for:
   - **Red requests** (404, 500, etc.)
   - **Missing JavaScript files**
   - **CORS errors**

### Verify API URL

In browser console, check what API URL is being used:

```javascript
// Check if API URL is set
console.log(import.meta.env.PROD)  // Should be true
console.log(import.meta.env.VITE_API_URL)  // Should be undefined or your API URL
```

If `PROD` is not `true`, the API URL might be empty, causing all API calls to fail.

### Force API URL (Temporary Fix)

If `import.meta.env.PROD` isn't working, we can hardcode the API URL. But first, let's see what errors you're getting in the console.

## Most Likely Issue

Based on your description, the most likely issue is:
- **Frontend wasn't rebuilt** before the last deployment
- **Old build files** are still on S3

**Solution:** Rebuild and redeploy the frontend completely.

