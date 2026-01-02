"""
===========================================
DYNAMODB CLIENT & TABLE SETUP
===========================================
Creates and manages DynamoDB tables for the Hisab app.

Tables:
- hisab_users: User accounts
- hisab_groups: Expense groups
- hisab_group_members: Group memberships
- hisab_expenses: Expense records
- hisab_expense_splits: How expenses are split
- hisab_settlements: Payment settlements
- hisab_notifications: User notifications
===========================================
"""

import boto3
from botocore.exceptions import ClientError
from app.config import settings
from typing import Optional
import logging

logger = logging.getLogger(__name__)

# DynamoDB client singleton
# NOTE: These are module-level globals. In Lambda, they persist across invocations.
# If credentials change, we need to clear these to force re-initialization.
_dynamodb_client = None
_dynamodb_resource = None


def clear_dynamodb_cache():
    """Clear cached DynamoDB client and resource. Forces fresh initialization."""
    global _dynamodb_client, _dynamodb_resource
    _dynamodb_client = None
    _dynamodb_resource = None
    logger.info("Cleared DynamoDB client/resource cache")


def get_dynamodb_client():
    """Get or create DynamoDB client."""
    global _dynamodb_client
    if _dynamodb_client is None:
        # Check if we're in Lambda environment
        import os
        is_lambda = os.environ.get("AWS_LAMBDA_FUNCTION_NAME") is not None
        
        # In Lambda, boto3 automatically uses the IAM role - DO NOT pass credentials
        # Only pass credentials if explicitly provided for local testing AND not in Lambda
        has_explicit_creds = (
            settings.aws_access_key_id and 
            settings.aws_secret_access_key and
            settings.aws_access_key_id.strip() and 
            settings.aws_secret_access_key.strip()
        )
        
        # NEVER use explicit credentials or endpoint_url in Lambda - always use IAM role
        # In Lambda, boto3 automatically uses the IAM role - we should NOT pass endpoint_url
        if is_lambda:
            # Lambda mode: ALWAYS use IAM role, NEVER use endpoint_url even if set
            logger.info("🔵 Lambda environment detected - using IAM role for credentials")
            logger.info(f"Creating DynamoDB client for region: {settings.aws_region}")
            logger.info("⚠️  Ignoring DYNAMODB_ENDPOINT_URL in Lambda (using AWS DynamoDB)")
            # Create client with ONLY region_name - boto3 will use IAM role automatically
            # Do NOT pass endpoint_url - Lambda should always connect to AWS DynamoDB
            _dynamodb_client = boto3.client("dynamodb", region_name=settings.aws_region)
        elif has_explicit_creds:
            # Local testing with explicit credentials
            logger.info("Using explicit AWS credentials (local testing mode)")
            config = {
                "region_name": settings.aws_region,
                "aws_access_key_id": settings.aws_access_key_id,
                "aws_secret_access_key": settings.aws_secret_access_key
            }
            if settings.dynamodb_endpoint_url:
                config["endpoint_url"] = settings.dynamodb_endpoint_url
            _dynamodb_client = boto3.client("dynamodb", **config)
        else:
            # Not Lambda, no explicit credentials - use IAM role or endpoint_url if set
            logger.info("Using IAM role for AWS credentials (production mode)")
            
            if settings.dynamodb_endpoint_url:
                # Local DynamoDB testing
                logger.info(f"Using local DynamoDB endpoint: {settings.dynamodb_endpoint_url}")
                _dynamodb_client = boto3.client("dynamodb", region_name=settings.aws_region, endpoint_url=settings.dynamodb_endpoint_url)
            else:
                # AWS DynamoDB - use IAM role (default credential chain)
                logger.info("Creating DynamoDB client for AWS (using IAM role)")
                _dynamodb_client = boto3.client("dynamodb", region_name=settings.aws_region)
            
            # Verify client was created
            logger.info(f"DynamoDB client created: {type(_dynamodb_client)}")
            
            # Test the client by getting region (this will fail if credentials are wrong)
            try:
                client_region = _dynamodb_client.meta.region_name
                logger.info(f"Client region verified: {client_region}")
            except Exception as e:
                logger.error(f"❌ Error verifying client: {e}")
                logger.error("This usually means:")
                logger.error("  1. IAM role doesn't have DynamoDB permissions")
                logger.error("  2. Lambda environment has invalid AWS credentials set")
                logger.error("  3. Region is incorrect")
                raise
    return _dynamodb_client


def get_dynamodb_resource():
    """Get or create DynamoDB resource (higher-level API)."""
    global _dynamodb_resource
    if _dynamodb_resource is None:
        # Check if we're in Lambda environment
        import os
        is_lambda = os.environ.get("AWS_LAMBDA_FUNCTION_NAME") is not None
        
        # NEVER use explicit credentials or endpoint_url in Lambda - always use IAM role
        if is_lambda:
            # Lambda mode: ALWAYS use IAM role, NEVER use endpoint_url even if set
            logger.info("🔵 Lambda environment detected - using IAM role for credentials")
            logger.info(f"Region: {settings.aws_region}")
            logger.info("⚠️  Ignoring DYNAMODB_ENDPOINT_URL in Lambda (using AWS DynamoDB)")
            # Create resource with ONLY region_name - boto3 will use IAM role automatically
            _dynamodb_resource = boto3.resource("dynamodb", region_name=settings.aws_region)
            logger.info("DynamoDB resource created successfully (using IAM role)")
        elif (settings.aws_access_key_id and 
              settings.aws_secret_access_key and
              settings.aws_access_key_id.strip() and 
              settings.aws_secret_access_key.strip()):
            # Local testing with explicit credentials
            logger.info("Using explicit AWS credentials (local testing mode)")
            config = {
                "region_name": settings.aws_region,
                "aws_access_key_id": settings.aws_access_key_id,
                "aws_secret_access_key": settings.aws_secret_access_key
            }
            if settings.dynamodb_endpoint_url:
                config["endpoint_url"] = settings.dynamodb_endpoint_url
            _dynamodb_resource = boto3.resource("dynamodb", **config)
        else:
            # Not Lambda, no explicit credentials - use IAM role or endpoint_url if set
            logger.info("Using IAM role for AWS credentials (production mode)")
            logger.info(f"Region: {settings.aws_region}, Endpoint: {settings.dynamodb_endpoint_url or 'AWS'}")
            if settings.dynamodb_endpoint_url:
                # Local DynamoDB testing
                _dynamodb_resource = boto3.resource("dynamodb", region_name=settings.aws_region, endpoint_url=settings.dynamodb_endpoint_url)
            else:
                # AWS DynamoDB - use IAM role (default credential chain)
                _dynamodb_resource = boto3.resource("dynamodb", region_name=settings.aws_region)
            logger.info("DynamoDB resource created successfully (using IAM role)")
    return _dynamodb_resource


def get_table_name(base_name: str) -> str:
    """Get full table name with prefix."""
    return f"{settings.dynamodb_table_prefix}{base_name}"


# ===========================================
# TABLE DEFINITIONS
# ===========================================

TABLE_DEFINITIONS = {
    "users": {
        "KeySchema": [
            {"AttributeName": "user_id", "KeyType": "HASH"}
        ],
        "AttributeDefinitions": [
            {"AttributeName": "user_id", "AttributeType": "S"},
            {"AttributeName": "email", "AttributeType": "S"}
        ],
        "GlobalSecondaryIndexes": [
            {
                "IndexName": "email-index",
                "KeySchema": [
                    {"AttributeName": "email", "KeyType": "HASH"}
                ],
                "Projection": {"ProjectionType": "ALL"}
            }
        ]
    },
    "groups": {
        "KeySchema": [
            {"AttributeName": "group_id", "KeyType": "HASH"}
        ],
        "AttributeDefinitions": [
            {"AttributeName": "group_id", "AttributeType": "S"},
            {"AttributeName": "created_by_id", "AttributeType": "S"}
        ],
        "GlobalSecondaryIndexes": [
            {
                "IndexName": "created_by-index",
                "KeySchema": [
                    {"AttributeName": "created_by_id", "KeyType": "HASH"}
                ],
                "Projection": {"ProjectionType": "ALL"}
            }
        ]
    },
    "group_members": {
        "KeySchema": [
            {"AttributeName": "group_id", "KeyType": "HASH"},
            {"AttributeName": "user_id", "KeyType": "RANGE"}
        ],
        "AttributeDefinitions": [
            {"AttributeName": "group_id", "AttributeType": "S"},
            {"AttributeName": "user_id", "AttributeType": "S"}
        ],
        "GlobalSecondaryIndexes": [
            {
                "IndexName": "user_id-index",
                "KeySchema": [
                    {"AttributeName": "user_id", "KeyType": "HASH"}
                ],
                "Projection": {"ProjectionType": "ALL"}
            }
        ]
    },
    "expenses": {
        "KeySchema": [
            {"AttributeName": "expense_id", "KeyType": "HASH"}
        ],
        "AttributeDefinitions": [
            {"AttributeName": "expense_id", "AttributeType": "S"},
            {"AttributeName": "group_id", "AttributeType": "S"},
            {"AttributeName": "paid_by_id", "AttributeType": "S"}
        ],
        "GlobalSecondaryIndexes": [
            {
                "IndexName": "group_id-index",
                "KeySchema": [
                    {"AttributeName": "group_id", "KeyType": "HASH"}
                ],
                "Projection": {"ProjectionType": "ALL"}
            },
            {
                "IndexName": "paid_by-index",
                "KeySchema": [
                    {"AttributeName": "paid_by_id", "KeyType": "HASH"}
                ],
                "Projection": {"ProjectionType": "ALL"}
            }
        ]
    },
    "expense_splits": {
        "KeySchema": [
            {"AttributeName": "expense_id", "KeyType": "HASH"},
            {"AttributeName": "user_id", "KeyType": "RANGE"}
        ],
        "AttributeDefinitions": [
            {"AttributeName": "expense_id", "AttributeType": "S"},
            {"AttributeName": "user_id", "AttributeType": "S"}
        ],
        "GlobalSecondaryIndexes": [
            {
                "IndexName": "user_id-index",
                "KeySchema": [
                    {"AttributeName": "user_id", "KeyType": "HASH"}
                ],
                "Projection": {"ProjectionType": "ALL"}
            }
        ]
    },
    "settlements": {
        "KeySchema": [
            {"AttributeName": "settlement_id", "KeyType": "HASH"}
        ],
        "AttributeDefinitions": [
            {"AttributeName": "settlement_id", "AttributeType": "S"},
            {"AttributeName": "group_id", "AttributeType": "S"},
            {"AttributeName": "from_user_id", "AttributeType": "S"},
            {"AttributeName": "to_user_id", "AttributeType": "S"}
        ],
        "GlobalSecondaryIndexes": [
            {
                "IndexName": "group_id-index",
                "KeySchema": [
                    {"AttributeName": "group_id", "KeyType": "HASH"}
                ],
                "Projection": {"ProjectionType": "ALL"}
            },
            {
                "IndexName": "from_user-index",
                "KeySchema": [
                    {"AttributeName": "from_user_id", "KeyType": "HASH"}
                ],
                "Projection": {"ProjectionType": "ALL"}
            },
            {
                "IndexName": "to_user-index",
                "KeySchema": [
                    {"AttributeName": "to_user_id", "KeyType": "HASH"}
                ],
                "Projection": {"ProjectionType": "ALL"}
            }
        ]
    },
    "notifications": {
        "KeySchema": [
            {"AttributeName": "user_id", "KeyType": "HASH"},
            {"AttributeName": "notification_id", "KeyType": "RANGE"}
        ],
        "AttributeDefinitions": [
            {"AttributeName": "user_id", "AttributeType": "S"},
            {"AttributeName": "notification_id", "AttributeType": "S"}
        ]
    }
}


def create_table(table_name: str, definition: dict) -> bool:
    """
    Create a single DynamoDB table.
    
    Returns True if created or already exists, False on error.
    """
    client = get_dynamodb_client()
    full_name = get_table_name(table_name)
    
    try:
        create_params = {
            "TableName": full_name,
            "KeySchema": definition["KeySchema"],
            "AttributeDefinitions": definition["AttributeDefinitions"],
            "BillingMode": "PAY_PER_REQUEST"  # On-demand pricing (cheapest for low traffic)
        }
        
        # Add GSIs if defined
        if "GlobalSecondaryIndexes" in definition:
            create_params["GlobalSecondaryIndexes"] = definition["GlobalSecondaryIndexes"]
        
        client.create_table(**create_params)
        logger.info(f"✅ Created table: {full_name}")
        
        # Wait for table to be active
        waiter = client.get_waiter("table_exists")
        waiter.wait(TableName=full_name)
        
        return True
        
    except ClientError as e:
        if e.response["Error"]["Code"] == "ResourceInUseException":
            logger.info(f"📦 Table already exists: {full_name}")
            return True
        else:
            logger.error(f"❌ Error creating table {full_name}: {e}")
            return False


def create_tables():
    """Create all DynamoDB tables."""
    logger.info("🚀 Creating DynamoDB tables...")
    
    for table_name, definition in TABLE_DEFINITIONS.items():
        create_table(table_name, definition)
    
    logger.info("✅ All DynamoDB tables ready!")


def delete_tables():
    """Delete all DynamoDB tables (for testing/cleanup)."""
    client = get_dynamodb_client()
    
    for table_name in TABLE_DEFINITIONS.keys():
        full_name = get_table_name(table_name)
        try:
            client.delete_table(TableName=full_name)
            logger.info(f"🗑️ Deleted table: {full_name}")
        except ClientError as e:
            if e.response["Error"]["Code"] == "ResourceNotFoundException":
                logger.info(f"📦 Table doesn't exist: {full_name}")
            else:
                logger.error(f"❌ Error deleting table {full_name}: {e}")


def get_table(table_name: str):
    """Get a DynamoDB table resource."""
    resource = get_dynamodb_resource()
    return resource.Table(get_table_name(table_name))

