# Test Lambda Function in AWS Console

## Step 1: Open Lambda Function

1. Go to: https://console.aws.amazon.com/lambda/home?region=ap-south-1
2. Click on `hisab-api`

## Step 2: Create Test Event

1. Click the **"Test"** tab (next to "Code" tab)
2. Click **"Create new test event"**
3. Event name: `test-register`
4. Event JSON: Paste this:

```json
{
  "httpMethod": "POST",
  "path": "/api/auth/register",
  "headers": {
    "Content-Type": "application/json"
  },
  "body": "{\"name\":\"Test User\",\"email\":\"test@test.com\",\"password\":\"test123\"}"
}
```

5. Click **"Save"**

## Step 3: Run Test

1. Click **"Test"** button
2. Wait for execution to complete
3. Check the response

## Step 4: Check Results

### If Success:
- Response status: `200`
- Response body: User created successfully
- **This means Lambda works!** The issue is with API Gateway.

### If Error:
- Look for `UnrecognizedClientException`
- **This means Lambda IAM role doesn't have DynamoDB access**
- Fix: Verify role permissions or redeploy Lambda

## What to Look For

- **Status Code**: Should be 200 for success
- **Response Body**: Should contain user data or success message
- **Error Messages**: Check for DynamoDB permission errors

