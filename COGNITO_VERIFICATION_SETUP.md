# Cognito Verification Code Setup

## Issue: Verification codes not being delivered

Cognito needs to be configured to send verification codes via SMS and email.

## SMS Verification Setup

### Option 1: Use Cognito's Built-in SMS (Easiest, but limited)

1. Go to AWS Console → Cognito → User pools → Your pool
2. Go to "Messaging" tab
3. Under "SMS message", select "Use Cognito's built-in SMS"
4. **Note:** This only works in the **SMS sandbox** mode (free tier, limited to verified numbers)

### Option 2: Use AWS SNS (Recommended for production)

1. **Configure SNS:**
   - Go to AWS Console → SNS → Text messaging (SMS)
   - Request production access (if needed)
   - Set up spending limits

2. **Configure Cognito to use SNS:**
   - Go to Cognito → User pools → Your pool → "Messaging" tab
   - Under "SMS message", select "Use your own Amazon SNS"
   - Select your SNS region
   - **Important:** The IAM role for Cognito must have permission to publish to SNS

3. **IAM Role Permissions:**
   - Go to IAM → Roles → Find your Cognito role (usually named like `Cognito_YourPoolName_SMSRole`)
   - Add policy: `AmazonSNSFullAccess` (or create custom policy with `sns:Publish` permission)

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

1. Go to Cognito → User pools → Your pool → "Messaging" tab
2. Under "Email message", select "Use your own Amazon SES"
3. Select your verified SES email address (e.g., `noreply@hisab.paritoshagarwal.com`)
4. **Important:** The IAM role for Cognito must have permission to send emails via SES

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

