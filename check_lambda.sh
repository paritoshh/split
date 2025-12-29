#!/bin/bash
echo "=== Checking Lambda Function Configuration ==="
echo ""
echo "1. Getting Lambda function details..."
aws lambda get-function --function-name hisab-api --query 'Configuration.{Runtime:Runtime,Handler:Handler,Timeout:Timeout,MemorySize:MemorySize}' --output table

echo ""
echo "2. Getting Lambda environment variables..."
aws lambda get-function-configuration --function-name hisab-api --query 'Environment.Variables' --output table

echo ""
echo "3. Getting Lambda IAM role..."
ROLE_ARN=$(aws lambda get-function-configuration --function-name hisab-api --query 'Role' --output text)
echo "Role ARN: $ROLE_ARN"
echo ""
echo "4. Getting recent CloudWatch logs (last 50 lines)..."
LOG_GROUP="/aws/lambda/hisab-api"
aws logs tail "$LOG_GROUP" --since 10m --format short || echo "No logs found or log group doesn't exist"
