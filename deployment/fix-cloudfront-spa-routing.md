# Fix CloudFront SPA Routing (Blank White Screen)

## Problem
When you hard refresh or navigate directly to a route like `hisab.paritoshagarwal.com/register`, you get a blank white screen. This is because CloudFront/S3 is trying to find a file at that path instead of serving `index.html`.

## Solution: Configure CloudFront Error Pages

### Option 1: Using AWS Console

1. **Go to CloudFront Console**
2. **Find your distribution** (the one for `hisab.paritoshagarwal.com`)
3. **Click on the Distribution ID**
4. **Go to "Error pages" tab**
5. **Click "Create custom error response"**
6. **Configure:**
   - **HTTP error code**: `403: Forbidden`
   - **Customize error response**: `Yes`
   - **Response page path**: `/index.html`
   - **HTTP response code**: `200: OK`
   - Click **"Create custom error response"**
7. **Repeat for:**
   - `404: Not Found` → `/index.html` → `200: OK`

### Option 2: Using AWS CLI

```powershell
# Get your CloudFront distribution ID first
aws cloudfront list-distributions --query "DistributionList.Items[*].[Id,DomainName,Aliases.Items[0]]" --output table

# Set distribution ID
$DISTRIBUTION_ID = "your-distribution-id"

# Create error response for 403
aws cloudfront create-custom-error-response `
    --distribution-id $DISTRIBUTION_ID `
    --error-code 403 `
    --response-page-path /index.html `
    --response-code 200 `
    --error-caching-min-ttl 0

# Create error response for 404
aws cloudfront create-custom-error-response `
    --distribution-id $DISTRIBUTION_ID `
    --response-page-path /index.html `
    --response-code 200 `
    --error-code 404 `
    --error-caching-min-ttl 0
```

## After Configuration

1. **Wait 5-10 minutes** for CloudFront to propagate changes
2. **Test** by navigating directly to `https://hisab.paritoshagarwal.com/register`
3. **Hard refresh** should now work (Ctrl+Shift+R)

## Alternative: S3 Website Configuration

If the above doesn't work, you might need to configure S3 as a website:

1. **Go to S3 Console** → Your bucket
2. **Properties** tab → **Static website hosting**
3. **Enable** static website hosting
4. **Index document**: `index.html`
5. **Error document**: `index.html` (important for SPA!)
6. **Save**

Then update CloudFront origin to point to the S3 website endpoint (not the bucket endpoint).

## Verify It's Working

After configuration:
- Navigate to `https://hisab.paritoshagarwal.com/register` directly
- Should load the register page (not blank screen)
- Hard refresh (Ctrl+Shift+R) should work
- Browser back/forward buttons should work

