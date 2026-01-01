"""
===========================================
DYNAMODB SERVICE
===========================================
Implements all database operations using DynamoDB.
This replaces SQLAlchemy models for serverless deployment.

Design Patterns:
- Uses UUID strings for all IDs
- Timestamps stored as ISO strings
- Numbers stored as Decimal (DynamoDB requirement)
===========================================
"""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import List, Optional, Dict, Any
from boto3.dynamodb.conditions import Key, Attr
from botocore.exceptions import ClientError

from app.db.dynamodb_client import get_table, get_table_name
from app.config import settings


def generate_id() -> str:
    """Generate a unique ID."""
    return str(uuid.uuid4())


def now_iso() -> str:
    """Get current timestamp as ISO string."""
    return datetime.utcnow().isoformat()


def to_decimal(value: float) -> Decimal:
    """Convert float to Decimal for DynamoDB."""
    return Decimal(str(value))


def from_decimal(value) -> float:
    """Convert Decimal back to float."""
    if isinstance(value, Decimal):
        return float(value)
    return value


def clean_item(item: dict) -> dict:
    """Convert Decimals to floats in a DynamoDB item."""
    if not item:
        return item
    return {k: from_decimal(v) if isinstance(v, Decimal) else v for k, v in item.items()}


def deserialize_dynamodb_item(item: dict) -> dict:
    """Convert DynamoDB low-level format to regular Python dict.
    
    When using boto3.client() directly, DynamoDB returns items in low-level format:
    {"field": {"S": "value"}} instead of {"field": "value"}
    
    This function converts the low-level format to regular dict.
    """
    if not item:
        return item
    
    # Check if item is already in regular format (from boto3.resource)
    # If any value is a dict with DynamoDB type markers, it's low-level format
    is_low_level = False
    try:
        for value in item.values():
            if isinstance(value, dict) and len(value) == 1:
                first_key = list(value.keys())[0]
                if first_key in ["S", "N", "BOOL", "SS", "NS", "BS", "M", "L"]:
                    is_low_level = True
                    break
    except (AttributeError, TypeError):
        # If item.values() fails or item is not a dict, assume it's already regular format
        return item
    
    if not is_low_level:
        # Already in regular format, just return it
        return item
    
    # Convert from low-level format
    try:
        from boto3.dynamodb.types import TypeDeserializer
        deserializer = TypeDeserializer()
        return {k: deserializer.deserialize(v) for k, v in item.items()}
    except Exception as e:
        # If deserialization fails, log and return original item
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(f"Failed to deserialize DynamoDB item: {e}. Returning as-is.")
        return item


class DynamoDBService:
    """DynamoDB implementation of database operations."""
    
    # ===========================================
    # USER OPERATIONS
    # ===========================================
    
    def create_user(self, email: str, name: str, hashed_password: str, 
                   phone: Optional[str] = None, upi_id: Optional[str] = None) -> dict:
        """Create a new user."""
        # Use boto3 client directly (like get_user_by_email) to avoid credential issues
        import boto3
        from app.config import settings
        
        client = boto3.client('dynamodb', region_name=settings.aws_region)
        table_name = get_table_name("users")
        
        user_id = generate_id()
        
        item = {
            "user_id": user_id,
            "email": email.lower(),
            "name": name,
            "hashed_password": hashed_password,
            "phone": phone,
            "upi_id": upi_id,
            "is_active": True,
            "created_at": now_iso(),
            "updated_at": now_iso()
        }
        
        # Remove None values
        item = {k: v for k, v in item.items() if v is not None}
        
        # Convert to DynamoDB format
        dynamodb_item = {}
        for key, value in item.items():
            if isinstance(value, str):
                dynamodb_item[key] = {"S": value}
            elif isinstance(value, bool):
                dynamodb_item[key] = {"BOOL": value}
            elif isinstance(value, (int, float)):
                dynamodb_item[key] = {"N": str(value)}
            else:
                dynamodb_item[key] = {"S": str(value)}
        
        client.put_item(TableName=table_name, Item=dynamodb_item)
        return self._user_to_response(item)
    
    def get_user_by_id(self, user_id: str) -> Optional[dict]:
        """Get user by ID."""
        # Use boto3.client() directly to avoid credential caching issues
        import boto3
        import logging
        from app.config import settings
        from app.db.dynamodb_client import get_table_name
        
        logger = logging.getLogger(__name__)
        logger.info("Creating fresh DynamoDB client for get_user_by_id")
        
        # Create client directly - boto3 will use IAM role automatically
        client = boto3.client("dynamodb", region_name=settings.aws_region)
        table_name = get_table_name("users")
        
        logger.info(f"Getting user {user_id} from {table_name}")
        
        response = client.get_item(
            TableName=table_name,
            Key={"user_id": {"S": str(user_id)}}
        )
        item = response.get("Item")
        if not item:
            return None
        
        # _user_to_response will handle deserialization
        return self._user_to_response(item)
    
    def get_user_by_email(self, email: str) -> Optional[dict]:
        """Get user by email."""
        # Use get_dynamodb_client() to ensure endpoint_url is included for local DynamoDB
        import logging
        from app.config import settings
        from app.db.dynamodb_client import get_table_name, get_dynamodb_client
        
        logger = logging.getLogger(__name__)
        logger.info("Getting DynamoDB client for get_user_by_email")
        
        # Use the shared client which has endpoint_url configured for local DynamoDB
        client = get_dynamodb_client()
        table_name = get_table_name("users")
        
        # Log which endpoint we're using
        endpoint = getattr(client._client_config, 'endpoint_url', None) if hasattr(client, '_client_config') else None
        logger.info(f"Using DynamoDB endpoint: {endpoint or 'AWS (default)'}")
        
        logger.info(f"Querying table {table_name} with email {email}")
        
        response = client.query(
            TableName=table_name,
            IndexName="email-index",
            KeyConditionExpression="email = :email",
            ExpressionAttributeValues={
                ":email": {"S": email.lower()}
            }
        )
        items = response.get("Items", [])
        
        if not items:
            return None
        
        # _user_to_response will handle deserialization
        return self._user_to_response(items[0])
    
    def search_users(self, query: str, exclude_ids: List[str] = None) -> List[dict]:
        """Search users by name or email."""
        # Use boto3.client() directly to avoid credential caching issues
        import boto3
        import logging
        from app.config import settings
        from app.db.dynamodb_client import get_table_name
        
        logger = logging.getLogger(__name__)
        logger.info("Creating fresh DynamoDB client for search_users")
        
        # Create client directly - boto3 will use IAM role automatically
        client = boto3.client("dynamodb", region_name=settings.aws_region)
        table_name = get_table_name("users")
        
        logger.info(f"Scanning table {table_name} for query: {query}")
        
        # DynamoDB doesn't support LIKE queries, so we scan with filter
        # For production, consider using OpenSearch for better search
        # Note: Scan operations can be expensive, but for small datasets it's fine
        response = client.scan(
            TableName=table_name,
            FilterExpression="is_active = :is_active AND (contains(#name, :query) OR contains(email, :query_lower))",
            ExpressionAttributeNames={
                "#name": "name"
            },
            ExpressionAttributeValues={
                ":is_active": {"BOOL": True},
                ":query": {"S": query},
                ":query_lower": {"S": query.lower()}
            }
        )
        
        users = []
        for item in response.get("Items", []):
            # _user_to_response will handle deserialization
            user = self._user_to_response(item)
            if user:
                users.append(user)
        
        if exclude_ids:
            exclude_set = set(str(i) for i in exclude_ids)
            users = [u for u in users if u["id"] not in exclude_set]
        
        return users[:10]  # Limit results
    
    def update_user(self, user_id: str, **kwargs) -> Optional[dict]:
        """Update user fields."""
        # Use boto3.client() directly to avoid credential caching issues
        import boto3
        import logging
        from app.config import settings
        from app.db.dynamodb_client import get_table_name
        
        logger = logging.getLogger(__name__)
        logger.info("Creating fresh DynamoDB client for update_user")
        
        # Create client directly - boto3 will use IAM role automatically
        client = boto3.client("dynamodb", region_name=settings.aws_region)
        table_name = get_table_name("users")
        
        update_expr = "SET updated_at = :updated_at"
        expr_values = {":updated_at": {"S": now_iso()}}
        
        for key, value in kwargs.items():
            if value is not None:
                update_expr += f", {key} = :{key}"
                if isinstance(value, str):
                    expr_values[f":{key}"] = {"S": value}
                elif isinstance(value, bool):
                    expr_values[f":{key}"] = {"BOOL": value}
                elif isinstance(value, (int, float)):
                    expr_values[f":{key}"] = {"N": str(value)}
                else:
                    expr_values[f":{key}"] = {"S": str(value)}
        
        logger.info(f"Updating user {user_id}")
        response = client.update_item(
            TableName=table_name,
            Key={"user_id": {"S": str(user_id)}},
            UpdateExpression=update_expr,
            ExpressionAttributeValues=expr_values,
            ReturnValues="ALL_NEW"
        )
        attributes = response.get("Attributes")
        # Deserialize if needed
        if attributes:
            attributes = deserialize_dynamodb_item(attributes)
        return self._user_to_response(attributes)
    
    def _user_to_response(self, item: dict) -> Optional[dict]:
        """Convert DynamoDB item to user response format."""
        if not item:
            return None
        # Deserialize if needed (handles both boto3.resource and boto3.client formats)
        item = deserialize_dynamodb_item(item)
        return {
            "id": item.get("user_id"),
            "email": item.get("email"),
            "name": item.get("name"),
            "phone": item.get("phone"),
            "upi_id": item.get("upi_id"),
            "hashed_password": item.get("hashed_password"),
            "is_active": item.get("is_active", True),
            "created_at": item.get("created_at"),
            "updated_at": item.get("updated_at")
        }
    
    # ===========================================
    # GROUP OPERATIONS
    # ===========================================
    
    def create_group(self, name: str, created_by_id: str, 
                    description: Optional[str] = None,
                    category: str = "other") -> dict:
        """Create a new group and add creator as admin."""
        # Use boto3.client() directly to avoid credential caching issues
        import boto3
        import logging
        from app.config import settings
        from app.db.dynamodb_client import get_table_name
        
        logger = logging.getLogger(__name__)
        logger.info("Creating fresh DynamoDB client for create_group")
        
        # Create client directly - boto3 will use IAM role automatically
        client = boto3.client("dynamodb", region_name=settings.aws_region)
        table_name = get_table_name("groups")
        
        group_id = generate_id()
        
        item = {
            "group_id": group_id,
            "name": name,
            "description": description,
            "category": category,
            "created_by_id": str(created_by_id),
            "is_active": True,
            "created_at": now_iso(),
            "updated_at": now_iso()
        }
        item = {k: v for k, v in item.items() if v is not None}
        
        # Convert to DynamoDB format
        dynamodb_item = {}
        for key, value in item.items():
            if isinstance(value, str):
                dynamodb_item[key] = {"S": value}
            elif isinstance(value, bool):
                dynamodb_item[key] = {"BOOL": value}
            elif isinstance(value, (int, float)):
                dynamodb_item[key] = {"N": str(value)}
            else:
                dynamodb_item[key] = {"S": str(value)}
        
        logger.info(f"Creating group {group_id} in table {table_name}")
        client.put_item(TableName=table_name, Item=dynamodb_item)
        
        # Add creator as admin member
        self.add_group_member(group_id, created_by_id, role="admin")
        
        return self._group_to_response(item)
    
    def get_group_by_id(self, group_id: str) -> Optional[dict]:
        """Get group by ID."""
        # Use boto3.client() directly to avoid credential caching issues
        import boto3
        import logging
        from app.config import settings
        from app.db.dynamodb_client import get_table_name
        
        logger = logging.getLogger(__name__)
        logger.info("Creating fresh DynamoDB client for get_group_by_id")
        
        # Create client directly - boto3 will use IAM role automatically
        client = boto3.client("dynamodb", region_name=settings.aws_region)
        table_name = get_table_name("groups")
        
        logger.info(f"Getting group {group_id} from {table_name}")
        
        response = client.get_item(
            TableName=table_name,
            Key={"group_id": {"S": str(group_id)}}
        )
        item = response.get("Item")
        if not item:
            return None
        
        # _group_to_response will handle deserialization
        # Get members
        members = self.get_group_members(group_id)
        response_item = self._group_to_response(item)
        response_item["members"] = members
        return response_item
    
    def get_user_groups(self, user_id: str) -> List[dict]:
        """Get all groups a user is member of."""
        # Use boto3.client() directly to avoid credential caching issues
        import boto3
        import logging
        from app.config import settings
        from app.db.dynamodb_client import get_table_name
        
        logger = logging.getLogger(__name__)
        logger.info("Creating fresh DynamoDB client for get_user_groups")
        
        # Create client directly - boto3 will use IAM role automatically
        client = boto3.client("dynamodb", region_name=settings.aws_region)
        members_table_name = get_table_name("group_members")
        groups_table_name = get_table_name("groups")
        
        logger.info(f"Querying {members_table_name} for user {user_id}")
        
        # Get user's memberships using client
        response = client.query(
            TableName=members_table_name,
            IndexName="user_id-index",
            KeyConditionExpression="user_id = :user_id",
            FilterExpression="is_active = :is_active",
            ExpressionAttributeValues={
                ":user_id": {"S": str(user_id)},
                ":is_active": {"BOOL": True}
            }
        )
        
        groups = []
        for membership_item in response.get("Items", []):
            # Deserialize membership item
            membership = deserialize_dynamodb_item(membership_item)
            group_id = membership["group_id"]
            
            # Get group using client
            group_response = client.get_item(
                TableName=groups_table_name,
                Key={"group_id": {"S": group_id}}
            )
            group_item = group_response.get("Item")
            if group_item:
                # Deserialize group item
                group = deserialize_dynamodb_item(group_item)
                if group.get("is_active", True):
                    group_data = self._group_to_response(group)
                    group_data["members"] = self.get_group_members(group["group_id"])
                    groups.append(group_data)
        
        return groups
    
    def update_group(self, group_id: str, **kwargs) -> Optional[dict]:
        """Update group fields."""
        # Use boto3.client() directly to avoid credential caching issues
        import boto3
        import logging
        from app.config import settings
        from app.db.dynamodb_client import get_table_name
        
        logger = logging.getLogger(__name__)
        logger.info("Creating fresh DynamoDB client for update_group")
        
        # Create client directly - boto3 will use IAM role automatically
        client = boto3.client("dynamodb", region_name=settings.aws_region)
        table_name = get_table_name("groups")
        
        update_expr = "SET updated_at = :updated_at"
        expr_values = {":updated_at": {"S": now_iso()}}
        expr_names = {}
        
        for key, value in kwargs.items():
            if value is not None:
                # Handle reserved words
                if key in ["name", "description"]:
                    update_expr += f", #{key} = :{key}"
                    expr_names[f"#{key}"] = key
                else:
                    update_expr += f", {key} = :{key}"
                
                if isinstance(value, str):
                    expr_values[f":{key}"] = {"S": value}
                elif isinstance(value, bool):
                    expr_values[f":{key}"] = {"BOOL": value}
                elif isinstance(value, (int, float)):
                    expr_values[f":{key}"] = {"N": str(value)}
                else:
                    expr_values[f":{key}"] = {"S": str(value)}
        
        update_params = {
            "TableName": table_name,
            "Key": {"group_id": {"S": str(group_id)}},
            "UpdateExpression": update_expr,
            "ExpressionAttributeValues": expr_values,
            "ReturnValues": "ALL_NEW"
        }
        if expr_names:
            update_params["ExpressionAttributeNames"] = expr_names
        
        logger.info(f"Updating group {group_id}")
        response = client.update_item(**update_params)
        attributes = response.get("Attributes")
        if attributes:
            attributes = deserialize_dynamodb_item(attributes)
        return self._group_to_response(attributes)
    
    def delete_group(self, group_id: str) -> bool:
        """Soft delete a group."""
        # Use boto3.client() directly to avoid credential caching issues
        import boto3
        import logging
        from app.config import settings
        from app.db.dynamodb_client import get_table_name
        
        logger = logging.getLogger(__name__)
        logger.info("Creating fresh DynamoDB client for delete_group")
        
        # Create client directly - boto3 will use IAM role automatically
        client = boto3.client("dynamodb", region_name=settings.aws_region)
        table_name = get_table_name("groups")
        
        logger.info(f"Soft deleting group {group_id}")
        client.update_item(
            TableName=table_name,
            Key={"group_id": {"S": str(group_id)}},
            UpdateExpression="SET is_active = :inactive, updated_at = :updated",
            ExpressionAttributeValues={
                ":inactive": {"BOOL": False},
                ":updated": {"S": now_iso()}
            }
        )
        return True
    
    def _group_to_response(self, item: dict) -> Optional[dict]:
        """Convert DynamoDB item to group response format."""
        if not item:
            return None
        # Deserialize if needed (handles both boto3.resource and boto3.client formats)
        item = deserialize_dynamodb_item(item)
        return {
            "id": item.get("group_id"),
            "name": item.get("name"),
            "description": item.get("description"),
            "category": item.get("category", "other"),
            "created_by_id": item.get("created_by_id"),
            "is_active": item.get("is_active", True),
            "created_at": item.get("created_at"),
            "updated_at": item.get("updated_at")
        }
    
    # ===========================================
    # GROUP MEMBER OPERATIONS
    # ===========================================
    
    def add_group_member(self, group_id: str, user_id: str, role: str = "member") -> dict:
        """Add a member to a group."""
        # Use boto3.client() directly to avoid credential caching issues
        import boto3
        import logging
        from app.config import settings
        from app.db.dynamodb_client import get_table_name
        
        logger = logging.getLogger(__name__)
        logger.info("Creating fresh DynamoDB client for add_group_member")
        
        # Create client directly - boto3 will use IAM role automatically
        client = boto3.client("dynamodb", region_name=settings.aws_region)
        table_name = get_table_name("group_members")
        
        item = {
            "group_id": str(group_id),
            "user_id": str(user_id),
            "role": role,
            "is_active": True,
            "joined_at": now_iso()
        }
        
        # Convert to DynamoDB format
        dynamodb_item = {}
        for key, value in item.items():
            if isinstance(value, str):
                dynamodb_item[key] = {"S": value}
            elif isinstance(value, bool):
                dynamodb_item[key] = {"BOOL": value}
            elif isinstance(value, (int, float)):
                dynamodb_item[key] = {"N": str(value)}
            else:
                dynamodb_item[key] = {"S": str(value)}
        
        logger.info(f"Adding member {user_id} to group {group_id}")
        client.put_item(TableName=table_name, Item=dynamodb_item)
        return item
    
    def get_group_members(self, group_id: str) -> List[dict]:
        """Get all members of a group."""
        # Use boto3.client() directly to avoid credential caching issues
        import boto3
        import logging
        from app.config import settings
        from app.db.dynamodb_client import get_table_name
        
        logger = logging.getLogger(__name__)
        logger.info("Creating fresh DynamoDB client for get_group_members")
        
        # Create client directly - boto3 will use IAM role automatically
        client = boto3.client("dynamodb", region_name=settings.aws_region)
        table_name = get_table_name("group_members")
        
        logger.info(f"Querying {table_name} for group {group_id}")
        
        response = client.query(
            TableName=table_name,
            KeyConditionExpression="group_id = :group_id",
            FilterExpression="is_active = :is_active",
            ExpressionAttributeValues={
                ":group_id": {"S": str(group_id)},
                ":is_active": {"BOOL": True}
            }
        )
        
        members = []
        for membership_item in response.get("Items", []):
            # Deserialize membership item
            membership = deserialize_dynamodb_item(membership_item)
            user = self.get_user_by_id(membership["user_id"])
            if user:
                members.append({
                    "user": user,
                    "role": membership.get("role", "member"),
                    "joined_at": membership.get("joined_at"),
                    "is_active": membership.get("is_active", True)
                })
        
        return members
    
    def remove_group_member(self, group_id: str, user_id: str) -> bool:
        """Remove a member from a group (soft delete)."""
        # Use boto3.client() directly to avoid credential caching issues
        import boto3
        import logging
        from app.config import settings
        from app.db.dynamodb_client import get_table_name
        
        logger = logging.getLogger(__name__)
        logger.info("Creating fresh DynamoDB client for remove_group_member")
        
        # Create client directly - boto3 will use IAM role automatically
        client = boto3.client("dynamodb", region_name=settings.aws_region)
        table_name = get_table_name("group_members")
        
        logger.info(f"Removing member {user_id} from group {group_id}")
        client.update_item(
            TableName=table_name,
            Key={
                "group_id": {"S": str(group_id)},
                "user_id": {"S": str(user_id)}
            },
            UpdateExpression="SET is_active = :inactive",
            ExpressionAttributeValues={":inactive": {"BOOL": False}}
        )
        return True
    
    def is_group_member(self, group_id: str, user_id: str) -> bool:
        """Check if user is an active member of a group."""
        # Use boto3.client() directly to avoid credential caching issues
        import boto3
        import logging
        from app.config import settings
        from app.db.dynamodb_client import get_table_name
        
        logger = logging.getLogger(__name__)
        logger.info("Creating fresh DynamoDB client for is_group_member")
        
        # Create client directly - boto3 will use IAM role automatically
        client = boto3.client("dynamodb", region_name=settings.aws_region)
        table_name = get_table_name("group_members")
        
        response = client.get_item(
            TableName=table_name,
            Key={
                "group_id": {"S": str(group_id)},
                "user_id": {"S": str(user_id)}
            }
        )
        item = response.get("Item")
        if not item:
            return False
        item = deserialize_dynamodb_item(item)
        return item.get("is_active", True)
    
    def is_group_admin(self, group_id: str, user_id: str) -> bool:
        """Check if user is an admin of a group."""
        # Use boto3.client() directly to avoid credential caching issues
        import boto3
        import logging
        from app.config import settings
        from app.db.dynamodb_client import get_table_name
        
        logger = logging.getLogger(__name__)
        logger.info("Creating fresh DynamoDB client for is_group_admin")
        
        # Create client directly - boto3 will use IAM role automatically
        client = boto3.client("dynamodb", region_name=settings.aws_region)
        table_name = get_table_name("group_members")
        
        response = client.get_item(
            TableName=table_name,
            Key={
                "group_id": {"S": str(group_id)},
                "user_id": {"S": str(user_id)}
            }
        )
        item = response.get("Item")
        if not item:
            return False
        item = deserialize_dynamodb_item(item)
        return item.get("role") == "admin" and item.get("is_active", True)
    
    # ===========================================
    # EXPENSE OPERATIONS
    # ===========================================
    
    def create_expense(self, amount: float, description: str, paid_by_id: str,
                      group_id: Optional[str] = None, split_type: str = "equal",
                      category: str = "other", currency: str = "INR",
                      expense_date: Optional[str] = None, notes: Optional[str] = None,
                      splits: List[dict] = None) -> dict:
        """Create a new expense with splits."""
        # Use boto3.client() directly to avoid credential caching issues
        import boto3
        import logging
        from app.config import settings
        from app.db.dynamodb_client import get_table_name
        
        logger = logging.getLogger(__name__)
        logger.info("Creating fresh DynamoDB client for create_expense")
        
        # Create client directly - boto3 will use IAM role automatically
        client = boto3.client("dynamodb", region_name=settings.aws_region)
        table_name = get_table_name("expenses")
        
        expense_id = generate_id()
        
        item = {
            "expense_id": expense_id,
            "amount": to_decimal(amount),
            "currency": currency,
            "description": description,
            "notes": notes,
            "category": category,
            "paid_by_id": str(paid_by_id),
            "group_id": str(group_id) if group_id else None,
            "split_type": split_type,
            "expense_date": expense_date or now_iso(),
            "is_active": True,
            "is_settled": False,
            "created_at": now_iso(),
            "updated_at": now_iso()
        }
        item = {k: v for k, v in item.items() if v is not None}
        
        # Convert to DynamoDB format
        dynamodb_item = {}
        for key, value in item.items():
            if isinstance(value, str):
                dynamodb_item[key] = {"S": value}
            elif isinstance(value, bool):
                dynamodb_item[key] = {"BOOL": value}
            elif isinstance(value, Decimal):
                dynamodb_item[key] = {"N": str(value)}
            elif isinstance(value, (int, float)):
                dynamodb_item[key] = {"N": str(value)}
            else:
                dynamodb_item[key] = {"S": str(value)}
        
        logger.info(f"Creating expense {expense_id} in table {table_name}")
        client.put_item(TableName=table_name, Item=dynamodb_item)
        
        # Create splits
        if splits:
            for split in splits:
                self.create_expense_split(
                    expense_id=expense_id,
                    user_id=split["user_id"],
                    amount=split["amount"],
                    percentage=split.get("percentage"),
                    shares=split.get("shares")
                )
        
        return self._expense_to_response(item)
    
    def get_expense_by_id(self, expense_id: str) -> Optional[dict]:
        """Get expense by ID with splits."""
        # Use boto3.client() directly to avoid credential caching issues
        import boto3
        import logging
        from app.config import settings
        from app.db.dynamodb_client import get_table_name
        
        logger = logging.getLogger(__name__)
        logger.info("Creating fresh DynamoDB client for get_expense_by_id")
        
        # Create client directly - boto3 will use IAM role automatically
        client = boto3.client("dynamodb", region_name=settings.aws_region)
        table_name = get_table_name("expenses")
        
        logger.info(f"Getting expense {expense_id} from {table_name}")
        
        response = client.get_item(
            TableName=table_name,
            Key={"expense_id": {"S": str(expense_id)}}
        )
        item = response.get("Item")
        if not item:
            return None
        
        # Deserialize item once for field access
        item = deserialize_dynamodb_item(item)
        
        expense = self._expense_to_response(item)
        expense["splits"] = self.get_expense_splits(expense_id)
        expense["paid_by_user"] = self.get_user_by_id(item["paid_by_id"])
        
        return expense
    
    def get_group_expenses(self, group_id: str, skip: int = 0, limit: int = 50) -> List[dict]:
        """Get all expenses for a group."""
        # Use boto3.client() directly to avoid credential caching issues
        import boto3
        import logging
        from app.config import settings
        from app.db.dynamodb_client import get_table_name
        
        logger = logging.getLogger(__name__)
        logger.info("Creating fresh DynamoDB client for get_group_expenses")
        
        # Create client directly - boto3 will use IAM role automatically
        client = boto3.client("dynamodb", region_name=settings.aws_region)
        table_name = get_table_name("expenses")
        
        logger.info(f"Querying {table_name} for group {group_id}")
        
        response = client.query(
            TableName=table_name,
            IndexName="group_id-index",
            KeyConditionExpression="group_id = :group_id",
            FilterExpression="is_active = :is_active",
            ExpressionAttributeValues={
                ":group_id": {"S": str(group_id)},
                ":is_active": {"BOOL": True}
            }
        )
        
        expenses = []
        for item in response.get("Items", []):
            # Deserialize item once for field access
            item = deserialize_dynamodb_item(item)
            # _expense_to_response will handle deserialization (but item is already deserialized, so it will just return it)
            expense = self._expense_to_response(item)
            # Use deserialized item for field access
            expense["splits"] = self.get_expense_splits(item["expense_id"])
            expense["paid_by_user"] = self.get_user_by_id(item["paid_by_id"])
            expenses.append(expense)
        
        # Sort by created_at descending
        expenses.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        
        return expenses[skip:skip+limit]
    
    def get_user_expenses(self, user_id: str, skip: int = 0, limit: int = 50) -> List[dict]:
        """Get all expenses where user is involved (paid or split)."""
        # Use boto3.client() directly to avoid credential caching issues
        import boto3
        import logging
        from app.config import settings
        from app.db.dynamodb_client import get_table_name
        
        logger = logging.getLogger(__name__)
        logger.info("Creating fresh DynamoDB client for get_user_expenses")
        
        # Create client directly - boto3 will use IAM role automatically
        client = boto3.client("dynamodb", region_name=settings.aws_region)
        expenses_table_name = get_table_name("expenses")
        splits_table_name = get_table_name("expense_splits")
        
        logger.info(f"Querying expenses for user {user_id}")
        
        # Get expenses user paid for
        paid_response = client.query(
            TableName=expenses_table_name,
            IndexName="paid_by-index",
            KeyConditionExpression="paid_by_id = :paid_by_id",
            FilterExpression="is_active = :is_active",
            ExpressionAttributeValues={
                ":paid_by_id": {"S": str(user_id)},
                ":is_active": {"BOOL": True}
            }
        )
        
        # Get expenses user is split in
        splits_response = client.query(
            TableName=splits_table_name,
            IndexName="user_id-index",
            KeyConditionExpression="user_id = :user_id",
            ExpressionAttributeValues={
                ":user_id": {"S": str(user_id)}
            }
        )
        
        expense_ids = set()
        for item in paid_response.get("Items", []):
            # Deserialize item if needed before accessing fields
            item = deserialize_dynamodb_item(item)
            expense_ids.add(item["expense_id"])
        for item in splits_response.get("Items", []):
            # Deserialize item if needed before accessing fields
            item = deserialize_dynamodb_item(item)
            expense_ids.add(item["expense_id"])
        
        expenses = []
        for expense_id in expense_ids:
            expense = self.get_expense_by_id(expense_id)
            if expense and expense.get("is_active"):
                expenses.append(expense)
        
        # Sort by created_at descending
        expenses.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        
        return expenses[skip:skip+limit]
    
    def update_expense(self, expense_id: str, **kwargs) -> Optional[dict]:
        """Update expense fields."""
        # Use boto3.client() directly to avoid credential caching issues
        import boto3
        import logging
        from app.config import settings
        from app.db.dynamodb_client import get_table_name
        
        logger = logging.getLogger(__name__)
        logger.info("Creating fresh DynamoDB client for update_expense")
        
        # Create client directly - boto3 will use IAM role automatically
        client = boto3.client("dynamodb", region_name=settings.aws_region)
        table_name = get_table_name("expenses")
        
        update_expr = "SET updated_at = :updated_at"
        expr_values = {":updated_at": {"S": now_iso()}}
        expr_names = {}
        
        for key, value in kwargs.items():
            if value is not None:
                if key in ["description", "notes"]:  # Reserved words
                    update_expr += f", #{key} = :{key}"
                    expr_names[f"#{key}"] = key
                else:
                    update_expr += f", {key} = :{key}"
                
                if isinstance(value, float):
                    expr_values[f":{key}"] = {"N": str(to_decimal(value))}
                elif isinstance(value, str):
                    expr_values[f":{key}"] = {"S": value}
                elif isinstance(value, bool):
                    expr_values[f":{key}"] = {"BOOL": value}
                elif isinstance(value, (int, Decimal)):
                    expr_values[f":{key}"] = {"N": str(value)}
                else:
                    expr_values[f":{key}"] = {"S": str(value)}
        
        update_params = {
            "TableName": table_name,
            "Key": {"expense_id": {"S": str(expense_id)}},
            "UpdateExpression": update_expr,
            "ExpressionAttributeValues": expr_values,
            "ReturnValues": "ALL_NEW"
        }
        if expr_names:
            update_params["ExpressionAttributeNames"] = expr_names
        
        logger.info(f"Updating expense {expense_id}")
        response = client.update_item(**update_params)
        attributes = response.get("Attributes")
        if attributes:
            attributes = deserialize_dynamodb_item(attributes)
        return self._expense_to_response(attributes)
    
    def delete_expense(self, expense_id: str) -> bool:
        """Soft delete an expense."""
        # Use boto3.client() directly to avoid credential caching issues
        import boto3
        import logging
        from app.config import settings
        from app.db.dynamodb_client import get_table_name
        
        logger = logging.getLogger(__name__)
        logger.info("Creating fresh DynamoDB client for delete_expense")
        
        # Create client directly - boto3 will use IAM role automatically
        client = boto3.client("dynamodb", region_name=settings.aws_region)
        table_name = get_table_name("expenses")
        
        logger.info(f"Soft deleting expense {expense_id}")
        client.update_item(
            TableName=table_name,
            Key={"expense_id": {"S": str(expense_id)}},
            UpdateExpression="SET is_active = :inactive, updated_at = :updated",
            ExpressionAttributeValues={
                ":inactive": {"BOOL": False},
                ":updated": {"S": now_iso()}
            }
        )
        return True
    
    def _expense_to_response(self, item: dict) -> Optional[dict]:
        """Convert DynamoDB item to expense response format."""
        if not item:
            return None
        # Deserialize if needed (handles both boto3.resource and boto3.client formats)
        item = deserialize_dynamodb_item(item)
        return clean_item({
            "id": item.get("expense_id"),
            "amount": item.get("amount"),
            "currency": item.get("currency", "INR"),
            "description": item.get("description"),
            "notes": item.get("notes"),
            "category": item.get("category", "other"),
            "paid_by_id": item.get("paid_by_id"),
            "group_id": item.get("group_id"),
            "split_type": item.get("split_type", "equal"),
            "expense_date": item.get("expense_date"),
            "receipt_url": item.get("receipt_url"),
            "is_active": item.get("is_active", True),
            "is_settled": item.get("is_settled", False),
            "created_at": item.get("created_at"),
            "updated_at": item.get("updated_at")
        })
    
    # ===========================================
    # EXPENSE SPLIT OPERATIONS
    # ===========================================
    
    def create_expense_split(self, expense_id: str, user_id: str, amount: float,
                            percentage: Optional[float] = None,
                            shares: Optional[float] = None) -> dict:
        """Create an expense split."""
        # Use boto3.client() directly to avoid credential caching issues
        import boto3
        import logging
        from app.config import settings
        from app.db.dynamodb_client import get_table_name
        
        logger = logging.getLogger(__name__)
        logger.info("Creating fresh DynamoDB client for create_expense_split")
        
        # Create client directly - boto3 will use IAM role automatically
        client = boto3.client("dynamodb", region_name=settings.aws_region)
        table_name = get_table_name("expense_splits")
        
        item = {
            "expense_id": str(expense_id),
            "user_id": str(user_id),
            "amount": to_decimal(amount),
            "percentage": to_decimal(percentage) if percentage else None,
            "shares": to_decimal(shares) if shares else None,
            "is_paid": False,
            "paid_at": None
        }
        item = {k: v for k, v in item.items() if v is not None}
        
        # Convert to DynamoDB format
        dynamodb_item = {}
        for key, value in item.items():
            if isinstance(value, str):
                dynamodb_item[key] = {"S": value}
            elif isinstance(value, bool):
                dynamodb_item[key] = {"BOOL": value}
            elif isinstance(value, Decimal):
                dynamodb_item[key] = {"N": str(value)}
            elif isinstance(value, (int, float)):
                dynamodb_item[key] = {"N": str(value)}
            else:
                dynamodb_item[key] = {"S": str(value) if value is not None else ""}
        
        logger.info(f"Creating expense split for expense {expense_id}, user {user_id}")
        client.put_item(TableName=table_name, Item=dynamodb_item)
        return clean_item(item)
    
    def get_expense_splits(self, expense_id: str) -> List[dict]:
        """Get all splits for an expense."""
        # Use boto3.client() directly to avoid credential caching issues
        import boto3
        import logging
        from app.config import settings
        from app.db.dynamodb_client import get_table_name
        
        logger = logging.getLogger(__name__)
        logger.info("Creating fresh DynamoDB client for get_expense_splits")
        
        # Create client directly - boto3 will use IAM role automatically
        client = boto3.client("dynamodb", region_name=settings.aws_region)
        table_name = get_table_name("expense_splits")
        
        logger.info(f"Querying {table_name} for expense {expense_id}")
        
        response = client.query(
            TableName=table_name,
            KeyConditionExpression="expense_id = :expense_id",
            ExpressionAttributeValues={
                ":expense_id": {"S": str(expense_id)}
            }
        )
        
        splits = []
        for item in response.get("Items", []):
            # Deserialize item if needed before accessing fields
            item = deserialize_dynamodb_item(item)
            split = clean_item(item)
            split["user"] = self.get_user_by_id(item["user_id"])
            splits.append(split)
        
        return splits
    
    def delete_expense_splits(self, expense_id: str) -> bool:
        """Delete all splits for an expense."""
        # Use boto3.client() directly to avoid credential caching issues
        import boto3
        import logging
        from app.config import settings
        from app.db.dynamodb_client import get_table_name
        
        logger = logging.getLogger(__name__)
        logger.info("Creating fresh DynamoDB client for delete_expense_splits")
        
        # Create client directly - boto3 will use IAM role automatically
        client = boto3.client("dynamodb", region_name=settings.aws_region)
        table_name = get_table_name("expense_splits")
        
        logger.info(f"Deleting splits for expense {expense_id}")
        
        # Get all splits
        response = client.query(
            TableName=table_name,
            KeyConditionExpression="expense_id = :expense_id",
            ExpressionAttributeValues={
                ":expense_id": {"S": str(expense_id)}
            }
        )
        
        # Delete each split using batch_write_item
        items_to_delete = []
        for item in response.get("Items", []):
            item = deserialize_dynamodb_item(item)
            items_to_delete.append({
                "DeleteRequest": {
                    "Key": {
                        "expense_id": {"S": str(item["expense_id"])},
                        "user_id": {"S": str(item["user_id"])}
                    }
                }
            })
        
        # Batch delete (DynamoDB allows up to 25 items per batch)
        for i in range(0, len(items_to_delete), 25):
            batch = items_to_delete[i:i+25]
            client.batch_write_item(
                RequestItems={
                    table_name: batch
                }
            )
        
        return True
    
    # ===========================================
    # SETTLEMENT OPERATIONS
    # ===========================================
    
    def create_settlement(self, from_user_id: str, to_user_id: str, amount: float,
                         group_id: Optional[str] = None, payment_method: str = "other",
                         transaction_ref: Optional[str] = None,
                         notes: Optional[str] = None) -> dict:
        """Create a settlement record."""
        # Use boto3.client() directly to avoid credential caching issues
        import boto3
        import logging
        from app.config import settings
        from app.db.dynamodb_client import get_table_name
        
        logger = logging.getLogger(__name__)
        logger.info("Creating fresh DynamoDB client for create_settlement")
        
        # Create client directly - boto3 will use IAM role automatically
        client = boto3.client("dynamodb", region_name=settings.aws_region)
        table_name = get_table_name("settlements")
        
        settlement_id = generate_id()
        
        item = {
            "settlement_id": settlement_id,
            "from_user_id": str(from_user_id),
            "to_user_id": str(to_user_id),
            "amount": to_decimal(amount),
            "group_id": str(group_id) if group_id else "none",  # DynamoDB needs a value for GSI
            "payment_method": payment_method,
            "transaction_ref": transaction_ref,
            "notes": notes,
            "is_active": True,
            "created_at": now_iso()
        }
        item = {k: v for k, v in item.items() if v is not None}
        
        # Convert to DynamoDB format
        dynamodb_item = {}
        for key, value in item.items():
            if isinstance(value, str):
                dynamodb_item[key] = {"S": value}
            elif isinstance(value, bool):
                dynamodb_item[key] = {"BOOL": value}
            elif isinstance(value, Decimal):
                dynamodb_item[key] = {"N": str(value)}
            elif isinstance(value, (int, float)):
                dynamodb_item[key] = {"N": str(value)}
            else:
                dynamodb_item[key] = {"S": str(value) if value is not None else ""}
        
        logger.info(f"Creating settlement {settlement_id}")
        client.put_item(TableName=table_name, Item=dynamodb_item)
        return self._settlement_to_response(item)
    
    def get_group_settlements(self, group_id: str) -> List[dict]:
        """Get all settlements for a group."""
        # Use boto3.client() directly to avoid credential caching issues
        import boto3
        import logging
        from app.config import settings
        from app.db.dynamodb_client import get_table_name
        
        logger = logging.getLogger(__name__)
        logger.info("Creating fresh DynamoDB client for get_group_settlements")
        
        # Create client directly - boto3 will use IAM role automatically
        client = boto3.client("dynamodb", region_name=settings.aws_region)
        table_name = get_table_name("settlements")
        
        logger.info(f"Querying {table_name} for group {group_id}")
        
        response = client.query(
            TableName=table_name,
            IndexName="group_id-index",
            KeyConditionExpression="group_id = :group_id",
            FilterExpression="is_active = :is_active",
            ExpressionAttributeValues={
                ":group_id": {"S": str(group_id)},
                ":is_active": {"BOOL": True}
            }
        )
        
        settlements = []
        for item in response.get("Items", []):
            # Deserialize item if needed before accessing fields
            item = deserialize_dynamodb_item(item)
            settlement = self._settlement_to_response(item)
            settlement["from_user"] = self.get_user_by_id(item["from_user_id"])
            settlement["to_user"] = self.get_user_by_id(item["to_user_id"])
            settlements.append(settlement)
        
        return settlements
    
    def get_user_settlements(self, user_id: str) -> List[dict]:
        """Get all settlements involving a user."""
        # Use boto3.client() directly to avoid credential caching issues
        import boto3
        import logging
        from app.config import settings
        from app.db.dynamodb_client import get_table_name
        
        logger = logging.getLogger(__name__)
        logger.info("Creating fresh DynamoDB client for get_user_settlements")
        
        # Create client directly - boto3 will use IAM role automatically
        client = boto3.client("dynamodb", region_name=settings.aws_region)
        table_name = get_table_name("settlements")
        
        logger.info(f"Querying settlements for user {user_id}")
        
        # Get settlements from user
        from_response = client.query(
            TableName=table_name,
            IndexName="from_user-index",
            KeyConditionExpression="from_user_id = :from_user_id",
            FilterExpression="is_active = :is_active",
            ExpressionAttributeValues={
                ":from_user_id": {"S": str(user_id)},
                ":is_active": {"BOOL": True}
            }
        )
        
        # Get settlements to user
        to_response = client.query(
            TableName=table_name,
            IndexName="to_user-index",
            KeyConditionExpression="to_user_id = :to_user_id",
            FilterExpression="is_active = :is_active",
            ExpressionAttributeValues={
                ":to_user_id": {"S": str(user_id)},
                ":is_active": {"BOOL": True}
            }
        )
        
        settlements = []
        seen_ids = set()
        
        for item in from_response.get("Items", []) + to_response.get("Items", []):
            # Deserialize item if needed before accessing fields
            item = deserialize_dynamodb_item(item)
            if item["settlement_id"] not in seen_ids:
                seen_ids.add(item["settlement_id"])
                settlement = self._settlement_to_response(item)
                settlement["from_user"] = self.get_user_by_id(item["from_user_id"])
                settlement["to_user"] = self.get_user_by_id(item["to_user_id"])
                settlements.append(settlement)
        
        return settlements
    
    def _settlement_to_response(self, item: dict) -> Optional[dict]:
        """Convert DynamoDB item to settlement response format."""
        if not item:
            return None
        # Deserialize if needed (handles both boto3.resource and boto3.client formats)
        item = deserialize_dynamodb_item(item)
        group_id = item.get("group_id")
        return clean_item({
            "id": item.get("settlement_id"),
            "from_user_id": item.get("from_user_id"),
            "to_user_id": item.get("to_user_id"),
            "amount": item.get("amount"),
            "group_id": group_id if group_id != "none" else None,
            "payment_method": item.get("payment_method", "other"),
            "transaction_ref": item.get("transaction_ref"),
            "notes": item.get("notes"),
            "is_active": item.get("is_active", True),
            "created_at": item.get("created_at")
        })
    
    # ===========================================
    # NOTIFICATION OPERATIONS
    # ===========================================
    
    def create_notification(self, user_id: str, notification_type: str,
                           title: str, message: str,
                           expense_id: Optional[str] = None,
                           group_id: Optional[str] = None,
                           from_user_id: Optional[str] = None) -> dict:
        """Create a notification."""
        # Use boto3.client() directly to avoid credential caching issues
        import boto3
        import logging
        from app.config import settings
        from app.db.dynamodb_client import get_table_name
        
        logger = logging.getLogger(__name__)
        logger.info("Creating fresh DynamoDB client for create_notification")
        
        # Create client directly - boto3 will use IAM role automatically
        client = boto3.client("dynamodb", region_name=settings.aws_region)
        table_name = get_table_name("notifications")
        
        notification_id = generate_id()
        
        item = {
            "user_id": str(user_id),
            "notification_id": notification_id,
            "notification_type": notification_type,
            "title": title,
            "message": message,
            "expense_id": str(expense_id) if expense_id else None,
            "group_id": str(group_id) if group_id else None,
            "from_user_id": str(from_user_id) if from_user_id else None,
            "is_read": False,
            "created_at": now_iso()
        }
        item = {k: v for k, v in item.items() if v is not None}
        
        # Convert to DynamoDB format
        dynamodb_item = {}
        for key, value in item.items():
            if isinstance(value, str):
                dynamodb_item[key] = {"S": value}
            elif isinstance(value, bool):
                dynamodb_item[key] = {"BOOL": value}
            elif isinstance(value, (int, float)):
                dynamodb_item[key] = {"N": str(value)}
            else:
                dynamodb_item[key] = {"S": str(value) if value is not None else ""}
        
        logger.info(f"Creating notification {notification_id} for user {user_id}")
        client.put_item(TableName=table_name, Item=dynamodb_item)
        return self._notification_to_response(item)
    
    def get_user_notifications(self, user_id: str, limit: int = 20) -> List[dict]:
        """Get notifications for a user."""
        # Use boto3.client() directly to avoid credential caching issues
        import boto3
        import logging
        from app.config import settings
        from app.db.dynamodb_client import get_table_name
        
        logger = logging.getLogger(__name__)
        logger.info("Creating fresh DynamoDB client for get_user_notifications")
        
        # Create client directly - boto3 will use IAM role automatically
        client = boto3.client("dynamodb", region_name=settings.aws_region)
        table_name = get_table_name("notifications")
        
        logger.info(f"Querying notifications for user {user_id}")
        
        response = client.query(
            TableName=table_name,
            KeyConditionExpression="user_id = :user_id",
            ScanIndexForward=False,  # Sort descending by notification_id
            Limit=limit,
            ExpressionAttributeValues={
                ":user_id": {"S": str(user_id)}
            }
        )
        
        notifications = []
        for item in response.get("Items", []):
            # Deserialize item if needed before accessing fields
            item = deserialize_dynamodb_item(item)
            notification = self._notification_to_response(item)
            if item.get("from_user_id"):
                notification["from_user"] = self.get_user_by_id(item["from_user_id"])
            notifications.append(notification)
        
        # Sort by created_at
        notifications.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        
        return notifications
    
    def mark_notification_read(self, user_id: str, notification_id: str) -> bool:
        """Mark a notification as read."""
        # Use boto3.client() directly to avoid credential caching issues
        import boto3
        import logging
        from app.config import settings
        from app.db.dynamodb_client import get_table_name
        
        logger = logging.getLogger(__name__)
        logger.info("Creating fresh DynamoDB client for mark_notification_read")
        
        # Create client directly - boto3 will use IAM role automatically
        client = boto3.client("dynamodb", region_name=settings.aws_region)
        table_name = get_table_name("notifications")
        
        logger.info(f"Marking notification {notification_id} as read for user {user_id}")
        client.update_item(
            TableName=table_name,
            Key={
                "user_id": {"S": str(user_id)},
                "notification_id": {"S": str(notification_id)}
            },
            UpdateExpression="SET is_read = :read",
            ExpressionAttributeValues={":read": {"BOOL": True}}
        )
        return True
    
    def mark_all_notifications_read(self, user_id: str) -> int:
        """Mark all notifications as read for a user."""
        # Use boto3.client() directly to avoid credential caching issues
        import boto3
        import logging
        from app.config import settings
        from app.db.dynamodb_client import get_table_name
        
        logger = logging.getLogger(__name__)
        logger.info("Creating fresh DynamoDB client for mark_all_notifications_read")
        
        # Create client directly - boto3 will use IAM role automatically
        client = boto3.client("dynamodb", region_name=settings.aws_region)
        table_name = get_table_name("notifications")
        
        logger.info(f"Marking all notifications as read for user {user_id}")
        
        # Get all unread notifications
        response = client.query(
            TableName=table_name,
            KeyConditionExpression="user_id = :user_id",
            FilterExpression="is_read = :is_read",
            ExpressionAttributeValues={
                ":user_id": {"S": str(user_id)},
                ":is_read": {"BOOL": False}
            }
        )
        
        count = 0
        for item in response.get("Items", []):
            # Deserialize item if needed before accessing fields
            item = deserialize_dynamodb_item(item)
            client.update_item(
                TableName=table_name,
                Key={
                    "user_id": {"S": item["user_id"]},
                    "notification_id": {"S": item["notification_id"]}
                },
                UpdateExpression="SET is_read = :read",
                ExpressionAttributeValues={":read": {"BOOL": True}}
            )
            count += 1
        
        return count
    
    def get_unread_notification_count(self, user_id: str) -> int:
        """Get count of unread notifications."""
        # Use boto3.client() directly to avoid credential caching issues
        import boto3
        import logging
        from app.config import settings
        from app.db.dynamodb_client import get_table_name
        
        logger = logging.getLogger(__name__)
        logger.info("Creating fresh DynamoDB client for get_unread_notification_count")
        
        # Create client directly - boto3 will use IAM role automatically
        client = boto3.client("dynamodb", region_name=settings.aws_region)
        table_name = get_table_name("notifications")
        
        logger.info(f"Querying table {table_name} for user {user_id}")
        
        response = client.query(
            TableName=table_name,
            KeyConditionExpression="user_id = :user_id",
            FilterExpression="is_read = :is_read",
            ExpressionAttributeValues={
                ":user_id": {"S": str(user_id)},
                ":is_read": {"BOOL": False}
            },
            Select="COUNT"
        )
        
        return response.get("Count", 0)
    
    def _notification_to_response(self, item: dict) -> Optional[dict]:
        """Convert DynamoDB item to notification response format."""
        if not item:
            return None
        # Deserialize if needed (handles both boto3.resource and boto3.client formats)
        item = deserialize_dynamodb_item(item)
        return {
            "id": item.get("notification_id"),
            "user_id": item.get("user_id"),
            "notification_type": item.get("notification_type"),
            "title": item.get("title"),
            "message": item.get("message"),
            "expense_id": item.get("expense_id"),
            "group_id": item.get("group_id"),
            "from_user_id": item.get("from_user_id"),
            "is_read": item.get("is_read", False),
            "created_at": item.get("created_at")
        }
    
    # ===========================================
    # BALANCE CALCULATIONS
    # ===========================================
    
    def calculate_user_balances(self, user_id: str, group_id: Optional[str] = None) -> Dict[str, float]:
        """
        Calculate how much the user owes/is owed by other users.
        
        Returns dict: {other_user_id: amount}
        Positive = they owe you
        Negative = you owe them
        """
        balances = {}
        
        # Get relevant expenses
        if group_id:
            expenses = self.get_group_expenses(group_id, limit=1000)
        else:
            expenses = self.get_user_expenses(user_id, limit=1000)
        
        user_id_str = str(user_id)
        
        for expense in expenses:
            paid_by = str(expense.get("paid_by_id"))
            
            for split in expense.get("splits", []):
                split_user_id = str(split.get("user_id"))
                split_amount = float(split.get("amount", 0))
                
                if paid_by == user_id_str and split_user_id != user_id_str:
                    # I paid, someone else owes me
                    balances[split_user_id] = balances.get(split_user_id, 0) + split_amount
                elif paid_by != user_id_str and split_user_id == user_id_str:
                    # Someone else paid, I owe them
                    balances[paid_by] = balances.get(paid_by, 0) - split_amount
        
        # Factor in settlements
        if group_id:
            settlements = self.get_group_settlements(group_id)
        else:
            settlements = self.get_user_settlements(user_id)
        
        for settlement in settlements:
            from_user = str(settlement.get("from_user_id"))
            to_user = str(settlement.get("to_user_id"))
            amount = float(settlement.get("amount", 0))
            
            if from_user == user_id_str:
                # I paid someone
                balances[to_user] = balances.get(to_user, 0) + amount
            elif to_user == user_id_str:
                # Someone paid me
                balances[from_user] = balances.get(from_user, 0) - amount
        
        # Remove zero balances
        return {k: v for k, v in balances.items() if abs(v) > 0.01}

