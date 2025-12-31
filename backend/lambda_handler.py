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
_init_error = None
try:
    logger.info("Starting Lambda handler initialization...")
    from app.main import app
    # Clear DynamoDB cache at Lambda cold start to ensure fresh IAM role credentials
    # This is important because cached clients might have stale credentials
    from app.db.dynamodb_client import clear_dynamodb_cache
    clear_dynamodb_cache()
    logger.info("Lambda handler initialized - DynamoDB cache cleared")
    
    # Create Lambda handler
    # This is the entry point AWS Lambda calls
    # api_gateway_base_path is needed for HTTP API v2.0
    handler = Mangum(app, lifespan="off", api_gateway_base_path="/")
    logger.info("Mangum handler created successfully")
except Exception as exc:
    # Store error for use in error handler
    _init_error = str(exc)
    logger.error(f"Failed to initialize FastAPI app: {_init_error}")
    logger.error(traceback.format_exc())
    
    def error_handler(event, context):
        """Fallback handler that returns error if app failed to initialize"""
        error_msg = f"Server initialization error: {_init_error}. Check CloudWatch logs for details."
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

# Store reference to original handler BEFORE wrapping
_original_handler = handler

# Wrap handler to catch and log runtime errors
def wrapped_handler(event, context):
    """Wrapper to catch and log any runtime errors"""
    try:
        # Log incoming request details
        raw_path = event.get('rawPath', 'unknown')
        method = event.get('requestContext', {}).get('http', {}).get('method', 'unknown')
        route_key = event.get('routeKey', 'unknown')
        body = event.get('body', '')
        
        logger.info(f"=== Lambda Invoked ===")
        logger.info(f"Path: {raw_path}")
        logger.info(f"Method: {method}")
        logger.info(f"Route Key: {route_key}")
        logger.info(f"Body length: {len(body) if body else 0}")
        logger.info(f"Event version: {event.get('version', 'unknown')}")
        
        # Call the ORIGINAL handler, not the wrapped one (to avoid recursion)
        result = _original_handler(event, context)
        
        logger.info(f"=== Lambda Response ===")
        logger.info(f"Status: {result.get('statusCode', 'unknown') if isinstance(result, dict) else 'not a dict'}")
        logger.info(f"Result type: {type(result)}")
        
        # Ensure result is in correct format for API Gateway HTTP API v2.0
        if isinstance(result, dict):
            # Mangum should return the correct format, but let's verify
            if 'statusCode' not in result:
                logger.error("Result missing statusCode!")
            if 'headers' not in result:
                logger.error("Result missing headers!")
            if 'body' not in result:
                logger.error("Result missing body!")
            else:
                logger.info(f"Body length: {len(str(result.get('body', '')))}")
        else:
            logger.error(f"Result is not a dict! Type: {type(result)}, Value: {result}")
        
        return result
    except Exception as exc:
        error_msg = str(exc)
        logger.error(f"Unhandled exception in Lambda handler: {error_msg}")
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
                "detail": f"Internal server error: {error_msg}. Check CloudWatch logs for details."
            })
        }

# Replace handler with wrapped version (Lambda will call this as "lambda_handler.handler")
handler = wrapped_handler

# Note: lifespan="off" because Lambda doesn't support
# the ASGI lifespan protocol well. We handle initialization
# differently for Lambda.

