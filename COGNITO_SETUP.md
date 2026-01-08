# AWS Cognito Setup Guide

This guide will help you set up AWS Cognito for mobile-based authentication.

## Prerequisites

- AWS Account
- AWS CLI configured (optional, for testing)
- Cognito User Pool created in AWS Console

---

## Step 1: Create Cognito User Pool

### 1.1 Go to AWS Cognito Console

1. Go to [AWS Console](https://console.aws.amazon.com/)
2. Search for "Cognito" in the search bar
3. Click on "Cognito" → "User pools"
4. Click "Create user pool"

### 1.2 Configure Sign-in Experience

1. **Sign-in options:**
   - ✅ Username
   - ✅ Phone number (IMPORTANT: Must be enabled)
   - ❌ Email (optional, but can be enabled for optional email)

2. Click "Next"

### 1.3 Configure Security Requirements

1. **Password policy:**
   - Minimum length: 6 (or your preference)
   - Require uppercase, numbers, special characters (optional)

2. **Multi-factor authentication:**
   - Choose "No MFA" (or enable if you want 2FA)

3. **User account recovery:**
   - Choose "Phone number only" (since mobile is mandatory)

4. Click "Next"

### 1.4 Configure Sign-up Experience

1. **Self-service sign-up:**
   - ✅ Enable self-registration

2. **Cognito-assisted verification:**
   - ✅ Phone number (MANDATORY - must be checked)
   - ✅ Email (optional - can be checked if you want email verification)

3. **Required attributes:**
   - ✅ Name
   - ✅ Phone number
   - ❌ Email (leave unchecked - email is optional)

4. **Custom attributes:**
   - None needed

5. Click "Next"

### 1.5 Configure Message Delivery

1. **Email provider:**
   - Choose "Send email with Cognito" (or configure SES if you have it)

2. **SMS provider:**
   - Choose "Send SMS with Cognito" (or configure SNS if you have it)
   - Note: SMS via Cognito has costs (~$0.00645 per SMS in India)

3. Click "Next"

### 1.6 Integrate Your App

1. **User pool name:**
   - Enter: `hisab-user-pool` (or any name you prefer)

2. **App client:**
   - Click "Add app client"
   - **App client name:** `hisab-web-client`
   - **Client secret:** ❌ Uncheck "Generate client secret" (for web apps)
   - Click "Next"

3. **Hosted UI (optional):**
   - Skip for now (we're using SDK directly)

4. Click "Next"

### 1.7 Review and Create

1. Review all settings
2. Click "Create user pool"

---

## Step 2: Get Your Cognito Credentials

After creating the User Pool:

1. **User Pool ID:**
   - In the User Pool details page, you'll see "User pool ID"
   - Format: `ap-south-1_XXXXXXXXX`
   - Copy this value

2. **App Client ID:**
   - Go to "App integration" tab
   - Under "App clients", click on your app client
   - You'll see "Client ID"
   - Copy this value

---

## Step 3: Configure Backend Environment Variables

### 3.1 Locate Backend .env File

Navigate to: `/Users/paritoshagarwal/split/backend/.env`

### 3.2 Add Cognito Variables

Add these lines to your `.env` file:

```bash
# AWS Cognito Configuration
COGNITO_USER_POOL_ID=ap-south-1_XXXXXXXXX
COGNITO_APP_CLIENT_ID=your-app-client-id-here
COGNITO_REGION=ap-south-1

# Other existing variables...
DATABASE_TYPE=dynamodb
DYNAMODB_ENDPOINT_URL=http://localhost:8000
# ... rest of your config
```

**Replace:**
- `ap-south-1_XXXXXXXXX` with your actual User Pool ID
- `your-app-client-id-here` with your actual App Client ID
- `ap-south-1` with your AWS region (if different)

### 3.3 Verify Backend .env

Your backend `.env` should look something like:

```bash
# Database
DATABASE_TYPE=dynamodb
DYNAMODB_ENDPOINT_URL=http://localhost:8000

# AWS Cognito
COGNITO_USER_POOL_ID=ap-south-1_XXXXXXXXX
COGNITO_APP_CLIENT_ID=your-app-client-id-here
COGNITO_REGION=ap-south-1

# AWS Region
AWS_REGION=ap-south-1

# Other settings...
```

---

## Step 4: Configure Frontend Environment Variables

### 4.1 Create Frontend .env File

Navigate to: `/Users/paritoshagarwal/split/frontend/`

Create a file named `.env` (or `.env.local`):

```bash
# AWS Cognito Configuration
VITE_COGNITO_USER_POOL_ID=ap-south-1_XXXXXXXXX
VITE_COGNITO_APP_CLIENT_ID=your-app-client-id-here
```

**Important:** 
- Frontend env variables must start with `VITE_` to be accessible in the browser
- Replace with your actual values (same as backend)

### 4.2 Alternative: Use .env.local

You can also create `.env.local` (which is gitignored):

```bash
# .env.local (not committed to git)
VITE_COGNITO_USER_POOL_ID=ap-south-1_XXXXXXXXX
VITE_COGNITO_APP_CLIENT_ID=your-app-client-id-here
```

---

## Step 5: Test Locally via UI

### 5.1 Start Backend

```bash
cd /Users/paritoshagarwal/split/backend

# Activate virtual environment (if using one)
source venv/bin/activate  # On Mac/Linux
# OR
venv\Scripts\activate  # On Windows

# Start backend server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8002
```

**Verify backend is running:**
- Open: http://localhost:8002/docs
- You should see FastAPI Swagger UI

### 5.2 Start Frontend

```bash
cd /Users/paritoshagarwal/split/frontend

# Install dependencies (if not already done)
npm install

# Start frontend dev server
npm run dev
```

**Verify frontend is running:**
- Open: http://localhost:5173
- You should see the landing page

### 5.3 Test Registration Flow

1. **Go to Registration:**
   - Click "Sign up" or navigate to http://localhost:5173/register

2. **Fill Registration Form:**
   - **Name:** Your full name
   - **Mobile Number:** Your mobile with country code (e.g., `+919876543210`)
   - **Email:** (Optional) Your email address
   - **Password:** At least 6 characters
   - **Confirm Password:** Same as password

3. **Submit Registration:**
   - Click "Create Account"
   - You should see: "Registration successful! Please check your mobile for verification code."

4. **Verify Mobile:**
   - Check your mobile phone for SMS with verification code
   - Enter the 6-digit code
   - Click "Verify Mobile"
   - You should see: "Mobile verified successfully! You can now login."

5. **Login:**
   - You'll be redirected to login page
   - Enter your mobile number and password
   - Click "Log in"
   - You should be redirected to dashboard

### 5.4 Test Login Flow

1. **Go to Login:**
   - Navigate to http://localhost:5173/login

2. **Enter Credentials:**
   - **Mobile Number:** Your registered mobile (e.g., `+919876543210`)
   - **Password:** Your password

3. **Submit:**
   - Click "Log in"
   - You should be redirected to dashboard

---

## Step 6: Troubleshooting

### Issue: "Cognito is not configured"

**Solution:**
- Check that `.env` files exist in both backend and frontend
- Verify environment variable names are correct
- Restart both backend and frontend servers after adding env variables

### Issue: "Mobile number already registered"

**Solution:**
- Go to AWS Cognito Console → Your User Pool → Users
- Delete the test user
- Try registering again

### Issue: "UserNotConfirmedException" on login

**Solution:**
- User hasn't verified mobile number
- Go to registration verification step
- Or verify manually in Cognito Console

### Issue: SMS not received

**Solution:**
- Check AWS Cognito Console → User Pool → Message delivery
- Verify SMS configuration
- Check CloudWatch logs for SMS delivery errors
- Ensure your AWS account has SMS permissions

### Issue: Backend can't connect to Cognito

**Solution:**
- Verify AWS credentials are configured
- For local testing, you can use AWS CLI credentials
- For Lambda, ensure IAM role has Cognito permissions

---

## Step 7: AWS Credentials (For Local Testing)

If testing locally, you need AWS credentials:

### Option 1: AWS CLI Configuration

```bash
aws configure
```

Enter:
- AWS Access Key ID
- AWS Secret Access Key
- Default region: `ap-south-1`
- Default output format: `json`

### Option 2: Environment Variables

Add to backend `.env`:

```bash
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=ap-south-1
```

**Note:** For production (Lambda), use IAM roles instead of hardcoded credentials.

---

## Step 8: Verify Everything Works

### 8.1 Check Backend Logs

When you start the backend, you should see:
```
🚀 Starting up Hisab App...
📦 Database type: dynamodb
✅ DynamoDB tables ready!
```

### 8.2 Check Frontend Console

Open browser DevTools (F12) → Console:
- Should NOT see: "Cognito is not configured"
- Should see Cognito service initialized

### 8.3 Test Complete Flow

1. ✅ Register new user
2. ✅ Receive SMS verification code
3. ✅ Verify mobile number
4. ✅ Login with mobile + password
5. ✅ Access dashboard
6. ✅ View user profile

---

## Quick Reference

### Environment Variables Summary

**Backend (`backend/.env`):**
```bash
COGNITO_USER_POOL_ID=ap-south-1_XXXXXXXXX
COGNITO_APP_CLIENT_ID=your-app-client-id
COGNITO_REGION=ap-south-1
```

**Frontend (`frontend/.env` or `frontend/.env.local`):**
```bash
VITE_COGNITO_USER_POOL_ID=ap-south-1_XXXXXXXXX
VITE_COGNITO_APP_CLIENT_ID=your-app-client-id
```

### Important Cognito Settings

- ✅ Username attributes: Phone number
- ✅ Phone verification: Required
- ✅ Email verification: Optional
- ✅ Self-service sign-up: Enabled
- ✅ App client: No client secret

---

## Next Steps

After successful local testing:

1. Deploy backend to Lambda
2. Deploy frontend to S3/CloudFront
3. Update environment variables in Lambda
4. Update frontend environment variables for production build

---

## Support

If you encounter issues:
1. Check AWS Cognito Console for user status
2. Check CloudWatch logs for errors
3. Verify all environment variables are set correctly
4. Ensure AWS credentials have proper permissions

