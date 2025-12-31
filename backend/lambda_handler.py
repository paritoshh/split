"""
===========================================
AWS LAMBDA HANDLER
===========================================
This file wraps our FastAPI app for AWS Lambda.

Mangum is an adapter that:
- Converts AWS Lambda events to ASGI requests
- FastAPI handles the request
- Mangum converts the response back to Lambda format

Deploy this handler to AWS Lambda, and set the handler as:
    lambda_handler.handler

Environment Variables needed in Lambda:
- DATABASE_TYPE: "dynamodb" (for production)
- AWS_REGION: Your AWS region
- SECRET_KEY: Your secret key for JWT tokens
- ALLOWED_ORIGINS: Comma-separated list of allowed origins
- OPENAI_API_KEY: (optional) For AI features
===========================================
"""

import json
import traceback
import sys
import logging
from mangum import Mangum

# Configure logging to ensure errors are visible
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

# Try to import and create the app
# If this fails, we'll catch it and return a helpful error
try:
    logger.info("Starting Lambda handler initialization...")
    from app.main import app
    # Clear DynamoDB cache at Lambda cold start to ensure fresh IAM role credentials
    # This is important because cached clients might have stale credentials
    from app.db.dynamodb_client import clear_dynamodb_cache
    clear_dynamodb_cache()
    logger.info("✅ Lambda handler initialized - DynamoDB cache cleared")
    
    # Create Lambda handler
    # This is the entry point AWS Lambda calls
    handler = Mangum(app, lifespan="off")
    logger.info("✅ Mangum handler created successfully")
except Exception as e:
    # If app initialization fails, create a minimal error handler
    logger.error(f"❌ Failed to initialize FastAPI app: {e}")
    logger.error(traceback.format_exc())
    
    def error_handler(event, context):
        """Fallback handler that returns error if app failed to initialize"""
        error_msg = f"Server initialization error: {str(e)}. Check CloudWatch logs for details."
        logger.error(f"Error handler called: {error_msg}")
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "*",
            },
            "body": json.dumps({
                "detail": error_msg
            })
        }
    
    handler = error_handler

# Wrap handler to catch and log runtime errors
def wrapped_handler(event, context):
    """Wrapper to catch and log any runtime errors"""
    try:
        logger.info(f"Lambda invoked - Path: {event.get('rawPath', 'unknown')}")
        result = handler(event, context)
        logger.info(f"Lambda completed - Status: {result.get('statusCode', 'unknown')}")
        return result
    except Exception as e:
        logger.error(f"❌ Unhandled exception in Lambda handler: {e}")
        logger.error(traceback.format_exc())
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "*",
            },
            "body": json.dumps({
                "detail": f"Internal server error: {str(e)}. Check CloudWatch logs for details."
            })
        }

# Export the wrapped handler (use original handler if wrapped fails to initialize)
# Lambda will call this as "lambda_handler.handler"
try:
    handler = wrapped_handler
except:
    # If wrapping fails, use the original handler
    pass

# Note: lifespan="off" because Lambda doesn't support
# the ASGI lifespan protocol well. We handle initialization
# differently for Lambda.

