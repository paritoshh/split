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
  "version": "2.0",
  "routeKey": "POST /api/auth/register",
  "rawPath": "/api/auth/register",
  "rawQueryString": "",
  "headers": {
    "content-type": "application/json",
    "host": "e65w7up0h8.execute-api.ap-south-1.amazonaws.com"
  },
  "requestContext": {
    "accountId": "294618942342",
    "apiId": "e65w7up0h8",
    "domainName": "e65w7up0h8.execute-api.ap-south-1.amazonaws.com",
    "domainPrefix": "e65w7up0h8",
    "http": {
      "method": "POST",
      "path": "/api/auth/register",
      "protocol": "HTTP/1.1",
      "sourceIp": "127.0.0.1",
      "userAgent": "test"
    },
    "requestId": "test-request-id",
    "routeKey": "POST /api/auth/register",
    "stage": "$default",
    "time": "30/Dec/2025:18:00:00 +0000",
    "timeEpoch": 1735574400000
  },
  "body": "{\"name\":\"Test User\",\"email\":\"test@test.com\",\"password\":\"test123\"}",
  "isBase64Encoded": false
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

