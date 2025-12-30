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
_dynamodb_client = None
_dynamodb_resource = None


def get_dynamodb_client():
    """Get or create DynamoDB client."""
    global _dynamodb_client
    if _dynamodb_client is None:
        config = {
            "region_name": settings.aws_region
        }
        if settings.dynamodb_endpoint_url:
            config["endpoint_url"] = settings.dynamodb_endpoint_url
        # Add credentials ONLY if explicitly provided (for local testing)
        # In Lambda, we should NOT provide credentials - use IAM role instead
        if (settings.aws_access_key_id and 
            settings.aws_secret_access_key and
            settings.aws_access_key_id.strip() and 
            settings.aws_secret_access_key.strip()):
            logger.info("Using explicit AWS credentials (local testing mode)")
            config["aws_access_key_id"] = settings.aws_access_key_id
            config["aws_secret_access_key"] = settings.aws_secret_access_key
        else:
            logger.info("Using IAM role for AWS credentials (Lambda/production mode)")
        _dynamodb_client = boto3.client("dynamodb", **config)
    return _dynamodb_client


def get_dynamodb_resource():
    """Get or create DynamoDB resource (higher-level API)."""
    global _dynamodb_resource
    if _dynamodb_resource is None:
        config = {
            "region_name": settings.aws_region
        }
        if settings.dynamodb_endpoint_url:
            config["endpoint_url"] = settings.dynamodb_endpoint_url
        # Add credentials ONLY if explicitly provided (for local testing)
        # In Lambda, we should NOT provide credentials - use IAM role instead
        if (settings.aws_access_key_id and 
            settings.aws_secret_access_key and
            settings.aws_access_key_id.strip() and 
            settings.aws_secret_access_key.strip()):
            logger.info("Using explicit AWS credentials (local testing mode)")
            config["aws_access_key_id"] = settings.aws_access_key_id
            config["aws_secret_access_key"] = settings.aws_secret_access_key
        else:
            logger.info("Using IAM role for AWS credentials (Lambda/production mode)")
        _dynamodb_resource = boto3.resource("dynamodb", **config)
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

