#!/bin/bash
# ===========================================
# DEPLOY FRONTEND TO S3 + CLOUDFRONT
# ===========================================
# This script:
# 1. Builds the React frontend
# 2. Uploads to S3 bucket
# 3. Invalidates CloudFront cache
#
# Prerequisites:
#   - AWS CLI configured with credentials
#   - S3 bucket created
#   - CloudFront distribution created
#
# Usage:
#   ./deploy-frontend.sh
# ===========================================

set -e  # Exit on error

# Configuration - UPDATE THESE
S3_BUCKET="hisab-frontend"
CLOUDFRONT_DISTRIBUTION_ID="YOUR_CLOUDFRONT_ID"
AWS_REGION="ap-south-1"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  HISAB - Frontend Deployment${NC}"
echo -e "${GREEN}========================================${NC}"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}Error: AWS CLI not installed${NC}"
    echo "Install it: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
    exit 1
fi

# Navigate to frontend directory
cd "$(dirname "$0")/../frontend"

# Install dependencies
echo -e "\n${YELLOW}📦 Installing dependencies...${NC}"
npm install

# Build for production
echo -e "\n${YELLOW}🔨 Building frontend...${NC}"
npm run build

# Sync to S3
echo -e "\n${YELLOW}🚀 Uploading to S3...${NC}"
aws s3 sync dist/ s3://$S3_BUCKET \
    --region $AWS_REGION \
    --delete \
    --cache-control "max-age=31536000,public" \
    --exclude "index.html" \
    --exclude "*.json"

# Upload index.html with no-cache (always serve fresh)
aws s3 cp dist/index.html s3://$S3_BUCKET/index.html \
    --region $AWS_REGION \
    --cache-control "no-cache,no-store,must-revalidate"

# Invalidate CloudFront cache
if [ "$CLOUDFRONT_DISTRIBUTION_ID" != "YOUR_CLOUDFRONT_ID" ]; then
    echo -e "\n${YELLOW}🔄 Invalidating CloudFront cache...${NC}"
    aws cloudfront create-invalidation \
        --distribution-id $CLOUDFRONT_DISTRIBUTION_ID \
        --paths "/*"
    echo -e "${GREEN}✅ CloudFront invalidation started${NC}"
else
    echo -e "\n${YELLOW}⚠️  Skipping CloudFront invalidation (not configured)${NC}"
fi

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Frontend deployment complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "S3 Bucket: ${YELLOW}$S3_BUCKET${NC}"
if [ "$CLOUDFRONT_DISTRIBUTION_ID" != "YOUR_CLOUDFRONT_ID" ]; then
    echo -e "CloudFront: ${YELLOW}$CLOUDFRONT_DISTRIBUTION_ID${NC}"
fi

