# Cognito Verification Code Setup

## Issue: Verification codes not being delivered

Cognito needs to be configured to send verification codes via SMS and email.

## SMS Verification Setup

### Finding the Configuration Location

The messaging configuration location varies by Cognito console version. Try these locations:

1. **"Sign-in experience" tab:**
   - Go to Cognito → User pools → Your pool → "Sign-in experience" tab
   - Look for "Message delivery" or "SMS configuration" section

2. **"User pool properties" tab:**
   - Go to Cognito → User pools → Your pool → "User pool properties" tab
   - Scroll down to find "Message delivery" or "SMS configuration"

3. **"App integration" tab:**
   - Go to Cognito → User pools → Your pool → "App integration" tab
   - Look for messaging settings

4. **Direct link (if available):**
   - In the left sidebar, look for "Message delivery" or "Messaging"

### Option 1: Use Cognito's Built-in SMS (Easiest, but limited)

1. Find the "Message delivery" or "SMS configuration" section (see above)
2. Under "SMS message delivery", select "Use Cognito's built-in SMS"
3. **Note:** This only works in the **SMS sandbox** mode (free tier, limited to verified numbers)
4. To verify phone numbers for sandbox:
   - Go to SNS → Text messaging (SMS) → Phone numbers → Add phone number
   - Verify the phone number

### Option 2: Use AWS SNS (Recommended for production)

**Current Status:** Your Cognito is configured to use SNS, but you need to complete the setup steps shown in the warning box.

1. **Complete SNS Production Setup (3 Steps Required):**
   
   Go to Cognito → User pools → Your pool → "Sign-in experience" tab → "Authentication methods" section
   You'll see a yellow warning box with 3 steps to complete:
   
   **Step 1: Request SNS Spending Limit Increase**
   - Click the link in the warning box or go to: SNS → Text messaging (SMS) → Account preferences
   - Click "Edit" on "Monthly spending limit"
   - Set a monthly spending limit (e.g., $10 or $50)
   - Click "Save"
   - **Note:** This is required even for sandbox mode
   
   **Step 2: Move to Amazon SNS Production Environment**
   - Click the link in the warning box or go to: SNS → Text messaging (SMS) → Account preferences
   - If you see "Sandbox mode", click "Request production access"
   - Fill out the form:
     - Use case: Select "Transactional SMS" or "One-time passwords (OTP)"
     - Website URL: Your app URL (e.g., `https://hisab.paritoshagarwal.com`)
     - Sample message: "Your verification code is 123456"
   - Submit and wait for approval (usually instant for low volumes)
   
   **Step 3: Set up Amazon Pinpoint Originating Identity (Optional but Recommended)**
   - Click the link in the warning box or go to: Amazon Pinpoint → Phone numbers
   - Click "Request phone number" or use an existing one
   - Select country (India) and number type (Long code)
   - This improves deliverability and sender reputation

2. **Verify IAM Role Permissions:**
   - Your IAM role ARN: `arn:aws:iam::294618942342:role/service-role/CognitoldpSNSServiceRole`
   - Go to IAM → Roles → Search for "CognitoldpSNSServiceRole"
   - Ensure it has `AmazonSNSFullAccess` or at least `sns:Publish` permission
   - If missing, attach the policy: `AmazonSNSFullAccess`

3. **Test SMS Delivery:**
   - After completing the above steps, try registering again
   - SMS should be delivered to the mobile number (must be in E.164 format: `+91XXXXXXXXXX`)
   - Check CloudWatch logs if SMS is not received

### Option 3: Use Custom Lambda Function (Most flexible)

1. Create a Lambda function to send SMS via your preferred provider (Twilio, MSG91, etc.)
2. Configure Cognito to invoke this Lambda for SMS delivery

## Email Verification Setup

### Step 1: Verify Email in SES

1. Go to AWS Console → SES → Verified identities
2. Click "Create identity"
3. Choose "Email address" or "Domain"
4. For email: Enter the email address and verify it
5. For domain: Follow DNS verification steps

### Step 2: Configure Cognito to use SES

1. Go to Cognito → User pools → Your pool → "Sign-in experience" tab → "Authentication methods" section
2. Click "Edit" in the Email section
3. **Important:** The "FROM email address" and "FROM sender name" should match:
   - If using domain: FROM email = `paritoshagarwal.com`, FROM sender = `noreply@hisab.paritoshagarwal.com` (or any email from that domain)
   - If using email: Both should be the same verified email address
4. Select your SES region (should match your Cognito region)
5. **Important:** The IAM role for Cognito must have permission to send emails via SES

### Common Issue: Email Not Sending

If emails aren't being delivered:
- Check if the domain/email is verified in SES
- Ensure the FROM email address format matches what's verified in SES
- Check CloudWatch logs for delivery errors
- Verify IAM role has `ses:SendEmail` permission

### Step 3: IAM Role Permissions

1. Go to IAM → Roles → Find your Cognito role (usually named like `Cognito_YourPoolName_EmailRole`)
2. Add policy: `AmazonSESFullAccess` (or create custom policy with `ses:SendEmail` permission)

## Testing Verification Codes

### For SMS (Sandbox mode):
- Only verified phone numbers can receive SMS
- Go to SNS → Text messaging (SMS) → Phone numbers → Add phone number
- Verify the phone number

### For Email:
- Use a verified email address in SES
- Check spam folder
- Check CloudWatch logs for delivery status

## Troubleshooting

1. **Check CloudWatch Logs:**
   - Go to CloudWatch → Log groups → `/aws/cognito/userpool`
   - Look for errors related to SMS/email delivery

2. **Check IAM Permissions:**
   - Verify Cognito roles have SNS/SES permissions
   - Check for any "AccessDenied" errors in CloudWatch

3. **Check SES/SNS Status:**
   - SES: Check if you're in sandbox mode (can only send to verified emails)
   - SNS: Check if SMS is enabled and production access is granted

4. **Mobile Number Format:**
   - Cognito expects mobile numbers in E.164 format: `+91XXXXXXXXXX`
   - Make sure your frontend sends mobile numbers in this format

