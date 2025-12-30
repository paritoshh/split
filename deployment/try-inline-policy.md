# Try Inline Policy Instead of Managed Policy

Sometimes managed policies don't work as expected. Let's try an inline policy with explicit permissions.

## Step 1: Remove Managed Policy

1. Go to IAM Console → Roles → `hisab-lambda-role-v2`
2. Permissions tab
3. Find `AmazonDynamoDBFullAccess`
4. Check it → Click "Remove"
5. Confirm removal

## Step 2: Create Inline Policy

1. Still in Permissions tab
2. Click "Add permissions" → "Create inline policy"
3. Click "JSON" tab
4. Paste this (using your account ID):

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
                "dynamodb:BatchWriteItem",
                "dynamodb:DescribeTable",
                "dynamodb:ListTables"
            ],
            "Resource": [
                "arn:aws:dynamodb:ap-south-1:294618942342:table/hisab_*",
                "arn:aws:dynamodb:ap-south-1:294618942342:table/hisab_*/index/*"
            ]
        }
    ]
}
```

5. Click "Next"
6. Policy name: `DynamoDBAccess`
7. Click "Create policy"

## Step 3: Wait and Test

1. Wait 2-3 minutes
2. Test Lambda again

