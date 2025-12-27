"""
===========================================
NOTIFICATION SCHEMAS
===========================================
"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class NotificationResponse(BaseModel):
    """Schema for returning notification data."""
    id: int
    notification_type: str
    title: str
    message: str
    expense_id: Optional[int]
    group_id: Optional[int]
    from_user_id: Optional[int]
    from_user_name: Optional[str] = None
    is_read: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class NotificationMarkRead(BaseModel):
    """Schema for marking notifications as read."""
    notification_ids: list[int]

