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
- JWT_SECRET: Your secret key for JWT tokens
- OPENAI_API_KEY: (optional) For AI features
===========================================
"""

from mangum import Mangum
from app.main import app

# Create Lambda handler
# This is the entry point AWS Lambda calls
handler = Mangum(app, lifespan="off")

# Note: lifespan="off" because Lambda doesn't support
# the ASGI lifespan protocol well. We handle initialization
# differently for Lambda.

