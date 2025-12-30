# Recreate API Gateway - Step by Step Guide

This guide will help you delete the existing API Gateway and create a fresh one.

---

## STEP 1: Delete Existing API Gateway

### 1.1 Find Your API
1. Go to: https://console.aws.amazon.com/apigateway/main/apis?region=ap-south-1
2. You'll see a list of APIs
3. **Note the API name** (e.g., `hisab-api`)

### 1.2 Delete the API
1. Click on your API name
2. Click **"Actions"** dropdown (top right) → **"Delete"**
3. Type the API name to confirm
4. Click **"Delete"**

**⚠️ WARNING**: This will break any frontend currently using this API URL. You'll need to update the frontend with the new URL after recreation.

---

## STEP 2: Create New HTTP API

### 2.1 Start Creation
1. In API Gateway console, click **"Create API"**
2. Select **"HTTP API"** (NOT REST API)
3. Click **"Build"**

### 2.2 Add Lambda Integration
1. Click **"Add integration"**
2. Integration type: Select **"Lambda"**
3. Lambda function: Select **`hisab-api`** from dropdown
4. API name: Type **`hisab-api`**
5. Click **"Next"**

### 2.3 Configure Routes
1. On "Configure routes" page:
   - Method: Select **"ANY"** from dropdown
   - Resource path: Type **`/{proxy+}`**
   - Integration: Should show **`hisab-api`**
2. Click **"Next"**

### 2.4 Configure Stage
1. Stage name: **`$default`** (leave as default)
2. Auto-deploy: Make sure it's **ON** (toggle should be blue)
3. Click **"Next"**

### 2.5 Review and Create
1. Review the summary:
   - Integration: `hisab-api`
   - Route: `ANY /{proxy+}`
   - Stage: `$default`
2. Click **"Create"**

---

## STEP 3: Add Root Route

### 3.1 Create Root Route
1. After API is created, you'll be on the API overview page
2. Click **"Routes"** in the left sidebar
3. Click **"Create"** button
4. Configure:
   - Method: Select **"ANY"**
   - Resource path: Type **`/`** (just a forward slash)
5. Click **"Create"**

### 3.2 Attach Integration to Root Route
1. Click on the route **`ANY /`** you just created
2. Click **"Attach integration"** button
3. Select the **`hisab-api`** Lambda integration
4. Click **"Attach"**

---

## STEP 4: Configure CORS

### 4.1 Open CORS Settings
1. Click **"CORS"** in the left sidebar
2. Click **"Configure"** button

### 4.2 Set CORS Values
Configure these settings:

- **Access-Control-Allow-Origin**: `*`
  - Or specific: `https://hisab.paritoshagarwal.com,http://localhost:5173,http://127.0.0.1:5173`

- **Access-Control-Allow-Methods**: `*`
  - Or specific: `GET,POST,PUT,DELETE,OPTIONS`

- **Access-Control-Allow-Headers**: `*`
  - Or specific: `Content-Type,Authorization`

- **Access-Control-Expose-Headers**: `*`

- **Access-Control-Max-Age**: `300`

### 4.3 Save CORS
1. Click **"Save"** button

---

## STEP 5: Get Your API URL

### 5.1 Find Invoke URL
1. Click **"Stages"** in the left sidebar
2. Click on **`$default`** stage
3. You'll see the **"Invoke URL"** (e.g., `https://abc123xyz.execute-api.ap-south-1.amazonaws.com`)
4. **Copy this URL** - you'll need it!

### 5.2 Test the API
Open your browser and go to:
```
https://YOUR-INVOKE-URL/health
```

You should see:
```json
{"status":"healthy","app_name":"Hisab","debug":false}
```

---

## STEP 6: Verify Everything

### 6.1 Check Routes
1. Go to **"Routes"**
2. You should see:
   - ✅ `ANY /{proxy+}` → Connected to `hisab-api`
   - ✅ `ANY /` → Connected to `hisab-api`

### 6.2 Check Integrations
1. Go to **"Integrations"**
2. You should see:
   - ✅ `hisab-api` (Lambda function)

### 6.3 Check CORS
1. Go to **"CORS"**
2. Verify settings are saved

---

## STEP 7: Update Frontend (If Needed)

If your frontend is using the old API URL, update it:

1. Find where API URL is configured (usually `frontend/src/services/api.js` or `.env`)
2. Update to the new Invoke URL from Step 5.1

---

## Troubleshooting

### If `/health` returns 404:
- Make sure root route `ANY /` is created and connected to Lambda
- Wait 10-20 seconds for changes to propagate

### If you get CORS errors:
- Double-check CORS settings in Step 4
- Make sure `ALLOWED_ORIGINS` in Lambda environment includes your frontend URL

### If Lambda returns 500:
- Check CloudWatch logs: `/aws/lambda/hisab-api`
- Verify DynamoDB tables exist
- Verify IAM role has DynamoDB permissions

---

## Quick Checklist

After recreation, verify:

- [ ] API Gateway created (HTTP API type)
- [ ] Route `ANY /{proxy+}` exists and connected to Lambda
- [ ] Route `ANY /` exists and connected to Lambda
- [ ] CORS configured
- [ ] `/health` endpoint works in browser
- [ ] Invoke URL copied for frontend

---

## Next Steps

After API Gateway is recreated:

1. Test `/health` endpoint
2. Test `/api/auth/register` endpoint
3. Update frontend with new API URL (if changed)
4. Test full application flow

