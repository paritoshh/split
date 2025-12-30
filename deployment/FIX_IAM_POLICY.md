# Fix IAM Policy for Lambda DynamoDB Access

## Problem
Getting `UnrecognizedClientException: The security token included in the request is invalid` when Lambda tries to access DynamoDB.

## Solution: Fix the IAM Policy

### Step 1: Go to IAM Console
1. Open: https://console.aws.amazon.com/iam/
2. Click **"Roles"** in the left sidebar
3. Search for: **`hisab-lambda-role`**
4. Click on the role name

### Step 2: Check Permissions
1. Click the **"Permissions"** tab
2. Look for an **inline policy** named **`HisabDynamoDBAccess`**

### Step 3: Edit or Create the Policy

#### If the policy EXISTS:
1. Click on **`HisabDynamoDBAccess`**
2. Click **"Edit"**
3. Click the **"JSON"** tab
4. **Delete all existing JSON**
5. Copy and paste the JSON below
6. Click **"Next"** → **"Save changes"**

#### If the policy DOES NOT EXIST:
1. Click **"Add permissions"** → **"Create inline policy"**
2. Click the **"JSON"** tab
3. Delete the default JSON
4. Copy and paste the JSON below
5. Click **"Next"**
6. Name it: **`HisabDynamoDBAccess`**
7. Click **"Create policy"**

### Step 4: Use This JSON

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "dynamodb:BatchGetItem",
        "dynamodb:BatchWriteItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:ap-south-1:*:table/hisab_*",
        "arn:aws:dynamodb:ap-south-1:*:table/hisab_*/index/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    }
  ]
}
```

### ⚠️ IMPORTANT: Check These Details

1. **Account ID wildcard**: Make sure it's `*` not `::`
   - ✅ Correct: `arn:aws:dynamodb:ap-south-1:*:table/hisab_*`
   - ❌ Wrong: `arn:aws:dynamodb:ap-south-1::table/hisab_*`

2. **Table name wildcard**: Make sure it ends with `*`
   - ✅ Correct: `hisab_*`
   - ❌ Wrong: `hisab_` (no wildcard)

3. **Logs resource**: Make sure it uses `*` for account ID
   - ✅ Correct: `arn:aws:logs:*:*:*`
   - ❌ Wrong: `arn:aws:logs:::*`

### Step 5: Wait and Test

1. **Wait 30-60 seconds** for IAM changes to propagate
2. Test again:
   ```powershell
   .\deployment\test-dynamodb-access.ps1
   ```
   OR
   ```powershell
   .\deployment\test-api.ps1
   ```

### Step 6: If Still Failing

1. Check error details:
   ```powershell
   .\deployment\check-error-details.ps1
   ```

2. Verify the policy was saved correctly:
   - Go back to IAM Console → Roles → `hisab-lambda-role` → Permissions
   - Click on `HisabDynamoDBAccess` → View JSON
   - Make sure it matches the JSON above exactly

3. Check CloudWatch logs for more details:
   ```powershell
   .\deployment\check-logs.ps1
   ```

## Common Mistakes

- ❌ Using `::` instead of `*` for account ID
- ❌ Missing `*` at the end of table name pattern
- ❌ Not saving the policy after editing
- ❌ Testing too quickly (IAM changes take 30-60 seconds to propagate)

