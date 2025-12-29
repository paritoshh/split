#!/bin/bash
# ===========================================
# DEPLOY BACKEND TO AWS LAMBDA
# ===========================================
# This script:
# 1. Creates a deployment package with dependencies
# 2. Uploads to AWS Lambda
#
# Prerequisites:
#   - AWS CLI configured with credentials
#   - Lambda function created
#   - IAM role with DynamoDB permissions
#
# Usage:
#   ./deploy-lambda.sh
# ===========================================

set -e  # Exit on error

# Configuration - UPDATE THESE
LAMBDA_FUNCTION_NAME="hisab-api"
AWS_REGION="ap-south-1"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  HISAB - Lambda Deployment${NC}"
echo -e "${GREEN}========================================${NC}"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}Error: AWS CLI not installed${NC}"
    exit 1
fi

# Navigate to backend directory
cd "$(dirname "$0")/../backend"

# Create deployment directory
echo -e "\n${YELLOW}📦 Creating deployment package...${NC}"
rm -rf lambda_package
mkdir -p lambda_package

# Install dependencies to package directory
pip install -r requirements.txt -t lambda_package/ --quiet

# Copy application code
cp -r app lambda_package/
cp lambda_handler.py lambda_package/

# Create zip file
cd lambda_package
zip -r ../lambda_deployment.zip . -q
cd ..

# Get zip size
ZIP_SIZE=$(du -h lambda_deployment.zip | cut -f1)
echo -e "${GREEN}✅ Package created: ${ZIP_SIZE}${NC}"

# Check if Lambda function exists
if aws lambda get-function --function-name $LAMBDA_FUNCTION_NAME --region $AWS_REGION &> /dev/null; then
    # Update existing function
    echo -e "\n${YELLOW}🚀 Updating Lambda function...${NC}"
    aws lambda update-function-code \
        --function-name $LAMBDA_FUNCTION_NAME \
        --zip-file fileb://lambda_deployment.zip \
        --region $AWS_REGION \
        --no-cli-pager
    
    echo -e "${GREEN}✅ Lambda function updated${NC}"
else
    echo -e "${RED}❌ Lambda function '$LAMBDA_FUNCTION_NAME' not found${NC}"
    echo -e "Create it first using AWS Console or Terraform"
    exit 1
fi

# Clean up
rm -rf lambda_package lambda_deployment.zip

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Lambda deployment complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "Function: ${YELLOW}$LAMBDA_FUNCTION_NAME${NC}"
echo -e "Region: ${YELLOW}$AWS_REGION${NC}"

