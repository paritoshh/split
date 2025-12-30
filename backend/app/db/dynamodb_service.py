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


class DynamoDBService:
    """DynamoDB implementation of database operations."""
    
    # ===========================================
    # USER OPERATIONS
    # ===========================================
    
    def create_user(self, email: str, name: str, hashed_password: str, 
                   phone: Optional[str] = None, upi_id: Optional[str] = None) -> dict:
        """Create a new user."""
        table = get_table("users")
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
        
        table.put_item(Item=item)
        return self._user_to_response(item)
    
    def get_user_by_id(self, user_id: str) -> Optional[dict]:
        """Get user by ID."""
        table = get_table("users")
        response = table.get_item(Key={"user_id": str(user_id)})
        item = response.get("Item")
        return self._user_to_response(item) if item else None
    
    def get_user_by_email(self, email: str) -> Optional[dict]:
        """Get user by email."""
        # Use client directly instead of resource (workaround for IAM role issue with resource)
        from app.db.dynamodb_client import get_dynamodb_client, get_table_name
        client = get_dynamodb_client()
        table_name = get_table_name("users")
        
        response = client.query(
            TableName=table_name,
            IndexName="email-index",
            KeyConditionExpression="email = :email",
            ExpressionAttributeValues={
                ":email": {"S": email.lower()}
            }
        )
        items = response.get("Items", [])
        return self._user_to_response(items[0]) if items else None
    
    def search_users(self, query: str, exclude_ids: List[str] = None) -> List[dict]:
        """Search users by name or email."""
        table = get_table("users")
        # DynamoDB doesn't support LIKE queries, so we scan with filter
        # For production, consider using OpenSearch for better search
        response = table.scan(
            FilterExpression=Attr("is_active").eq(True) & 
                           (Attr("name").contains(query) | Attr("email").contains(query.lower()))
        )
        
        users = [self._user_to_response(item) for item in response.get("Items", [])]
        
        if exclude_ids:
            exclude_set = set(str(i) for i in exclude_ids)
            users = [u for u in users if u["id"] not in exclude_set]
        
        return users[:10]  # Limit results
    
    def update_user(self, user_id: str, **kwargs) -> Optional[dict]:
        """Update user fields."""
        table = get_table("users")
        
        update_expr = "SET updated_at = :updated_at"
        expr_values = {":updated_at": now_iso()}
        
        for key, value in kwargs.items():
            if value is not None:
                update_expr += f", {key} = :{key}"
                expr_values[f":{key}"] = value
        
        response = table.update_item(
            Key={"user_id": str(user_id)},
            UpdateExpression=update_expr,
            ExpressionAttributeValues=expr_values,
            ReturnValues="ALL_NEW"
        )
        return self._user_to_response(response.get("Attributes"))
    
    def _user_to_response(self, item: dict) -> Optional[dict]:
        """Convert DynamoDB item to user response format."""
        if not item:
            return None
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
        table = get_table("groups")
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
        table.put_item(Item=item)
        
        # Add creator as admin member
        self.add_group_member(group_id, created_by_id, role="admin")
        
        return self._group_to_response(item)
    
    def get_group_by_id(self, group_id: str) -> Optional[dict]:
        """Get group by ID."""
        table = get_table("groups")
        response = table.get_item(Key={"group_id": str(group_id)})
        item = response.get("Item")
        if not item:
            return None
        
        # Get members
        members = self.get_group_members(group_id)
        response_item = self._group_to_response(item)
        response_item["members"] = members
        return response_item
    
    def get_user_groups(self, user_id: str) -> List[dict]:
        """Get all groups a user is member of."""
        members_table = get_table("group_members")
        groups_table = get_table("groups")
        
        # Get user's memberships
        response = members_table.query(
            IndexName="user_id-index",
            KeyConditionExpression=Key("user_id").eq(str(user_id)),
            FilterExpression=Attr("is_active").eq(True)
        )
        
        groups = []
        for membership in response.get("Items", []):
            group_response = groups_table.get_item(
                Key={"group_id": membership["group_id"]}
            )
            group = group_response.get("Item")
            if group and group.get("is_active", True):
                group_data = self._group_to_response(group)
                group_data["members"] = self.get_group_members(group["group_id"])
                groups.append(group_data)
        
        return groups
    
    def update_group(self, group_id: str, **kwargs) -> Optional[dict]:
        """Update group fields."""
        table = get_table("groups")
        
        update_expr = "SET updated_at = :updated_at"
        expr_values = {":updated_at": now_iso()}
        
        for key, value in kwargs.items():
            if value is not None:
                update_expr += f", #{key} = :{key}"
                expr_values[f":{key}"] = value
        
        # Handle reserved words
        expr_names = {f"#{k}": k for k in kwargs.keys() if k in ["name", "description"]}
        
        update_params = {
            "Key": {"group_id": str(group_id)},
            "UpdateExpression": update_expr,
            "ExpressionAttributeValues": expr_values,
            "ReturnValues": "ALL_NEW"
        }
        if expr_names:
            update_params["ExpressionAttributeNames"] = expr_names
        
        response = table.update_item(**update_params)
        return self._group_to_response(response.get("Attributes"))
    
    def delete_group(self, group_id: str) -> bool:
        """Soft delete a group."""
        table = get_table("groups")
        table.update_item(
            Key={"group_id": str(group_id)},
            UpdateExpression="SET is_active = :inactive, updated_at = :updated",
            ExpressionAttributeValues={
                ":inactive": False,
                ":updated": now_iso()
            }
        )
        return True
    
    def _group_to_response(self, item: dict) -> Optional[dict]:
        """Convert DynamoDB item to group response format."""
        if not item:
            return None
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
        table = get_table("group_members")
        
        item = {
            "group_id": str(group_id),
            "user_id": str(user_id),
            "role": role,
            "is_active": True,
            "joined_at": now_iso()
        }
        
        table.put_item(Item=item)
        return item
    
    def get_group_members(self, group_id: str) -> List[dict]:
        """Get all members of a group."""
        members_table = get_table("group_members")
        
        response = members_table.query(
            KeyConditionExpression=Key("group_id").eq(str(group_id)),
            FilterExpression=Attr("is_active").eq(True)
        )
        
        members = []
        for membership in response.get("Items", []):
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
        table = get_table("group_members")
        table.update_item(
            Key={"group_id": str(group_id), "user_id": str(user_id)},
            UpdateExpression="SET is_active = :inactive",
            ExpressionAttributeValues={":inactive": False}
        )
        return True
    
    def is_group_member(self, group_id: str, user_id: str) -> bool:
        """Check if user is an active member of a group."""
        table = get_table("group_members")
        response = table.get_item(
            Key={"group_id": str(group_id), "user_id": str(user_id)}
        )
        item = response.get("Item")
        return item is not None and item.get("is_active", True)
    
    def is_group_admin(self, group_id: str, user_id: str) -> bool:
        """Check if user is an admin of a group."""
        table = get_table("group_members")
        response = table.get_item(
            Key={"group_id": str(group_id), "user_id": str(user_id)}
        )
        item = response.get("Item")
        return item is not None and item.get("role") == "admin" and item.get("is_active", True)
    
    # ===========================================
    # EXPENSE OPERATIONS
    # ===========================================
    
    def create_expense(self, amount: float, description: str, paid_by_id: str,
                      group_id: Optional[str] = None, split_type: str = "equal",
                      category: str = "other", currency: str = "INR",
                      expense_date: Optional[str] = None, notes: Optional[str] = None,
                      splits: List[dict] = None) -> dict:
        """Create a new expense with splits."""
        table = get_table("expenses")
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
        table.put_item(Item=item)
        
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
        table = get_table("expenses")
        response = table.get_item(Key={"expense_id": str(expense_id)})
        item = response.get("Item")
        if not item:
            return None
        
        expense = self._expense_to_response(item)
        expense["splits"] = self.get_expense_splits(expense_id)
        expense["paid_by_user"] = self.get_user_by_id(item["paid_by_id"])
        
        return expense
    
    def get_group_expenses(self, group_id: str, skip: int = 0, limit: int = 50) -> List[dict]:
        """Get all expenses for a group."""
        table = get_table("expenses")
        
        response = table.query(
            IndexName="group_id-index",
            KeyConditionExpression=Key("group_id").eq(str(group_id)),
            FilterExpression=Attr("is_active").eq(True)
        )
        
        expenses = []
        for item in response.get("Items", []):
            expense = self._expense_to_response(item)
            expense["splits"] = self.get_expense_splits(item["expense_id"])
            expense["paid_by_user"] = self.get_user_by_id(item["paid_by_id"])
            expenses.append(expense)
        
        # Sort by created_at descending
        expenses.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        
        return expenses[skip:skip+limit]
    
    def get_user_expenses(self, user_id: str, skip: int = 0, limit: int = 50) -> List[dict]:
        """Get all expenses where user is involved (paid or split)."""
        # Get expenses user paid for
        expenses_table = get_table("expenses")
        paid_response = expenses_table.query(
            IndexName="paid_by-index",
            KeyConditionExpression=Key("paid_by_id").eq(str(user_id)),
            FilterExpression=Attr("is_active").eq(True)
        )
        
        # Get expenses user is split in
        splits_table = get_table("expense_splits")
        splits_response = splits_table.query(
            IndexName="user_id-index",
            KeyConditionExpression=Key("user_id").eq(str(user_id))
        )
        
        expense_ids = set()
        for item in paid_response.get("Items", []):
            expense_ids.add(item["expense_id"])
        for item in splits_response.get("Items", []):
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
        table = get_table("expenses")
        
        update_expr = "SET updated_at = :updated_at"
        expr_values = {":updated_at": now_iso()}
        expr_names = {}
        
        for key, value in kwargs.items():
            if value is not None:
                if key in ["description", "notes"]:  # Reserved words
                    update_expr += f", #{key} = :{key}"
                    expr_names[f"#{key}"] = key
                else:
                    update_expr += f", {key} = :{key}"
                if isinstance(value, float):
                    expr_values[f":{key}"] = to_decimal(value)
                else:
                    expr_values[f":{key}"] = value
        
        update_params = {
            "Key": {"expense_id": str(expense_id)},
            "UpdateExpression": update_expr,
            "ExpressionAttributeValues": expr_values,
            "ReturnValues": "ALL_NEW"
        }
        if expr_names:
            update_params["ExpressionAttributeNames"] = expr_names
        
        response = table.update_item(**update_params)
        return self._expense_to_response(response.get("Attributes"))
    
    def delete_expense(self, expense_id: str) -> bool:
        """Soft delete an expense."""
        table = get_table("expenses")
        table.update_item(
            Key={"expense_id": str(expense_id)},
            UpdateExpression="SET is_active = :inactive, updated_at = :updated",
            ExpressionAttributeValues={
                ":inactive": False,
                ":updated": now_iso()
            }
        )
        return True
    
    def _expense_to_response(self, item: dict) -> Optional[dict]:
        """Convert DynamoDB item to expense response format."""
        if not item:
            return None
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
        table = get_table("expense_splits")
        
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
        table.put_item(Item=item)
        return clean_item(item)
    
    def get_expense_splits(self, expense_id: str) -> List[dict]:
        """Get all splits for an expense."""
        table = get_table("expense_splits")
        
        response = table.query(
            KeyConditionExpression=Key("expense_id").eq(str(expense_id))
        )
        
        splits = []
        for item in response.get("Items", []):
            split = clean_item(item)
            split["user"] = self.get_user_by_id(item["user_id"])
            splits.append(split)
        
        return splits
    
    def delete_expense_splits(self, expense_id: str) -> bool:
        """Delete all splits for an expense."""
        table = get_table("expense_splits")
        
        # Get all splits
        response = table.query(
            KeyConditionExpression=Key("expense_id").eq(str(expense_id))
        )
        
        # Delete each split
        with table.batch_writer() as batch:
            for item in response.get("Items", []):
                batch.delete_item(Key={
                    "expense_id": item["expense_id"],
                    "user_id": item["user_id"]
                })
        
        return True
    
    # ===========================================
    # SETTLEMENT OPERATIONS
    # ===========================================
    
    def create_settlement(self, from_user_id: str, to_user_id: str, amount: float,
                         group_id: Optional[str] = None, payment_method: str = "other",
                         transaction_ref: Optional[str] = None,
                         notes: Optional[str] = None) -> dict:
        """Create a settlement record."""
        table = get_table("settlements")
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
        table.put_item(Item=item)
        return self._settlement_to_response(item)
    
    def get_group_settlements(self, group_id: str) -> List[dict]:
        """Get all settlements for a group."""
        table = get_table("settlements")
        
        response = table.query(
            IndexName="group_id-index",
            KeyConditionExpression=Key("group_id").eq(str(group_id)),
            FilterExpression=Attr("is_active").eq(True)
        )
        
        settlements = []
        for item in response.get("Items", []):
            settlement = self._settlement_to_response(item)
            settlement["from_user"] = self.get_user_by_id(item["from_user_id"])
            settlement["to_user"] = self.get_user_by_id(item["to_user_id"])
            settlements.append(settlement)
        
        return settlements
    
    def get_user_settlements(self, user_id: str) -> List[dict]:
        """Get all settlements involving a user."""
        table = get_table("settlements")
        
        # Get settlements from user
        from_response = table.query(
            IndexName="from_user-index",
            KeyConditionExpression=Key("from_user_id").eq(str(user_id)),
            FilterExpression=Attr("is_active").eq(True)
        )
        
        # Get settlements to user
        to_response = table.query(
            IndexName="to_user-index",
            KeyConditionExpression=Key("to_user_id").eq(str(user_id)),
            FilterExpression=Attr("is_active").eq(True)
        )
        
        settlements = []
        seen_ids = set()
        
        for item in from_response.get("Items", []) + to_response.get("Items", []):
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
        table = get_table("notifications")
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
        table.put_item(Item=item)
        return self._notification_to_response(item)
    
    def get_user_notifications(self, user_id: str, limit: int = 20) -> List[dict]:
        """Get notifications for a user."""
        table = get_table("notifications")
        
        response = table.query(
            KeyConditionExpression=Key("user_id").eq(str(user_id)),
            ScanIndexForward=False,  # Sort descending by notification_id
            Limit=limit
        )
        
        notifications = []
        for item in response.get("Items", []):
            notification = self._notification_to_response(item)
            if item.get("from_user_id"):
                notification["from_user"] = self.get_user_by_id(item["from_user_id"])
            notifications.append(notification)
        
        # Sort by created_at
        notifications.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        
        return notifications
    
    def mark_notification_read(self, user_id: str, notification_id: str) -> bool:
        """Mark a notification as read."""
        table = get_table("notifications")
        table.update_item(
            Key={"user_id": str(user_id), "notification_id": str(notification_id)},
            UpdateExpression="SET is_read = :read",
            ExpressionAttributeValues={":read": True}
        )
        return True
    
    def mark_all_notifications_read(self, user_id: str) -> int:
        """Mark all notifications as read for a user."""
        table = get_table("notifications")
        
        # Get all unread notifications
        response = table.query(
            KeyConditionExpression=Key("user_id").eq(str(user_id)),
            FilterExpression=Attr("is_read").eq(False)
        )
        
        count = 0
        for item in response.get("Items", []):
            table.update_item(
                Key={
                    "user_id": item["user_id"],
                    "notification_id": item["notification_id"]
                },
                UpdateExpression="SET is_read = :read",
                ExpressionAttributeValues={":read": True}
            )
            count += 1
        
        return count
    
    def get_unread_notification_count(self, user_id: str) -> int:
        """Get count of unread notifications."""
        table = get_table("notifications")
        
        response = table.query(
            KeyConditionExpression=Key("user_id").eq(str(user_id)),
            FilterExpression=Attr("is_read").eq(False),
            Select="COUNT"
        )
        
        return response.get("Count", 0)
    
    def _notification_to_response(self, item: dict) -> Optional[dict]:
        """Convert DynamoDB item to notification response format."""
        if not item:
            return None
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

