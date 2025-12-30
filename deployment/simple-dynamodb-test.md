# Simple DynamoDB Test Lambda

Create a minimal Lambda function to test if DynamoDB access works at all.

## Step 1: Create Test Lambda

1. Go to: https://console.aws.amazon.com/lambda/home?region=ap-south-1
2. Click "Create function"
3. Select "Author from scratch"
4. Function name: `test-dynamodb-access`
5. Runtime: Python 3.11
6. Execution role: `hisab-lambda-role-v2` (use the same role)
7. Click "Create function"

## Step 2: Add Simple Test Code

1. In the function code editor, replace with:

```python
import boto3
import json

def lambda_handler(event, context):
    try:
        # Try to list DynamoDB tables
        dynamodb = boto3.client('dynamodb', region_name='ap-south-1')
        response = dynamodb.list_tables()
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'success': True,
                'tables': response.get('TableNames', [])
            })
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({
                'success': False,
                'error': str(e),
                'error_type': type(e).__name__
            })
        }
```

2. Click "Deploy"

## Step 3: Test

1. Click "Test" tab
2. Create test event (any JSON, e.g., `{}`)
3. Click "Test"
4. Check the response

## What This Tells Us

- **If it works**: DynamoDB access is fine, issue is in the main Lambda code
- **If it fails with UnrecognizedClientException**: The IAM role itself doesn't have access (permissions issue)
- **If it fails with different error**: Different issue (region, table names, etc.)

