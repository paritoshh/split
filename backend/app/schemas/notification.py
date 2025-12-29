"""
===========================================
NOTIFICATION SCHEMAS
===========================================
Supports both SQLite (int IDs) and DynamoDB (string UUIDs).
===========================================
"""

from pydantic import BaseModel
from typing import Optional, Union, List
from datetime import datetime


class NotificationResponse(BaseModel):
    """Schema for returning notification data."""
    id: Union[int, str]
    notification_type: str
    title: str
    message: str
    expense_id: Optional[Union[int, str]] = None
    group_id: Optional[Union[int, str]] = None
    from_user_id: Optional[Union[int, str]] = None
    from_user_name: Optional[str] = None
    is_read: bool
    created_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class NotificationMarkRead(BaseModel):
    """Schema for marking notifications as read."""
    notification_ids: List[Union[int, str]]
