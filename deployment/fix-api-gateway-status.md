# Fix API Gateway Status

If your API Gateway status shows "-" instead of "Available", follow these steps:

## Step 1: Check Routes

1. Go to: https://console.aws.amazon.com/apigateway/main/apis?region=ap-south-1
2. Click on your API (`hisab-api`)
3. Click **"Routes"** in the left sidebar
4. Verify you have:
   - `ANY /{proxy+}`
   - `ANY /`

## Step 2: Verify Integrations

1. Click on each route (`ANY /{proxy+}` and `ANY /`)
2. In the "Integration" section, verify:
   - Integration is attached
   - Integration points to `hisab-api` Lambda function
3. If integration is missing:
   - Click **"Attach integration"** or **"Configure"**
   - Select **Lambda function**
   - Select **`hisab-api`**
   - Region: **`ap-south-1`**
   - Click **"Attach"** or **"Save"**

## Step 3: Check Stage

1. Click **"Stages"** in the left sidebar
2. Verify `$default` stage exists
3. Click on `$default`
4. Check:
   - **Deployment status**: Should show "Deployed"
   - **Invoke URL**: Should be visible

## Step 4: Force Deployment (if needed)

If auto-deploy is ON, changes should deploy automatically. But if status still shows "-":

1. Go to **"Stages"** → `$default`
2. Click **"Edit"**
3. Turn OFF **"Automatic Deployment"** temporarily
4. Click **"Save"**
5. Go back to API overview
6. Click **"Deploy"** button (top right)
7. Select `$default` stage
8. Click **"Deploy"**
9. (Optional) Turn auto-deploy back ON

## Step 5: Verify Status

1. Go back to API list: https://console.aws.amazon.com/apigateway/main/apis?region=ap-south-1
2. Check if status now shows **"Available"**

## Common Issues

- **Status shows "-"**: Usually means routes don't have integrations or stage isn't deployed
- **Can't deploy**: Auto-deploy must be OFF to manually deploy
- **Integration missing**: Each route needs an integration attached

## Quick Checklist

- [ ] Both routes exist (`/` and `/{proxy+}`)
- [ ] Both routes have Lambda integrations attached
- [ ] Integrations point to `hisab-api` Lambda
- [ ] Stage `$default` exists and is deployed
- [ ] Invoke URL is visible in stage details

