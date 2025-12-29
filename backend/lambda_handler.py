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
from mangum import Mangum

# Try to import and create the app
# If this fails, we'll catch it and return a helpful error
try:
    from app.main import app
    # Create Lambda handler
    # This is the entry point AWS Lambda calls
    handler = Mangum(app, lifespan="off")
except Exception as e:
    # If app initialization fails, create a minimal error handler
    print(f"❌ Failed to initialize FastAPI app: {e}")
    print(traceback.format_exc())
    
    def error_handler(event, context):
        """Fallback handler that returns error if app failed to initialize"""
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "*",
            },
            "body": json.dumps({
                "detail": f"Server initialization error: {str(e)}. Check CloudWatch logs for details."
            })
        }
    
    handler = error_handler

# Note: lifespan="off" because Lambda doesn't support
# the ASGI lifespan protocol well. We handle initialization
# differently for Lambda.

