# Diagnose Blank White Screen Issue

## Step 1: Check Browser Console

1. Open `https://hisab.paritoshagarwal.com` in Chrome/Firefox
2. Press **F12** to open Developer Tools
3. Go to **Console** tab
4. Look for **red error messages**
5. Take a screenshot or copy the errors

Common errors to look for:
- `Failed to fetch` or `Network Error` → API URL issue
- `Uncaught SyntaxError` → Build issue
- `Uncaught ReferenceError` → Missing dependency
- `CORS error` → CORS configuration issue

## Step 2: Check Network Tab

1. In Developer Tools, go to **Network** tab
2. Hard refresh (Ctrl+Shift+R)
3. Look for:
   - **Red requests** (failed)
   - **404 errors** for JavaScript files
   - **CORS errors** in the console

## Step 3: Verify Frontend Build

The issue might be that `import.meta.env.PROD` is not being set correctly.

Check if the API URL is being used:
1. In Console, type: `window.location.href`
2. Check Network tab for API calls - what URL are they going to?

## Step 4: Verify S3 Deployment

1. Go to S3 Console → Your bucket
2. Check if `index.html` exists
3. Check if `assets/` folder exists with JavaScript files
4. Check file sizes - they should be > 0 bytes

## Step 5: Check CloudFront Cache

1. Go to CloudFront → Your distribution
2. Create an **invalidation** for `/*`
3. Wait 2-3 minutes
4. Try again

## Most Likely Causes

1. **JavaScript Error**: Check browser console for errors
2. **API URL Not Set**: The build might not have `PROD=true`, so API URL is empty
3. **Old Build Deployed**: Frontend wasn't rebuilt before deployment
4. **CORS Error**: Browser blocking requests (check console)

## Quick Fix: Force API URL

If `import.meta.env.PROD` isn't working, we can hardcode the API URL in production builds.

