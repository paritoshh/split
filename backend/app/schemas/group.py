"""
===========================================
GROUP SCHEMAS
===========================================
Schemas for group-related API operations.
Supports both SQLite (int IDs) and DynamoDB (string UUIDs).
===========================================
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Union
from datetime import datetime


class GroupBase(BaseModel):
    """Base schema with common group fields."""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    category: str = Field(default="other", description="Group category: trip, home, couple, sports, party, other")


class GroupCreate(GroupBase):
    """
    Schema for creating a new group.
    
    Example:
    {
        "name": "Badminton Squad",
        "description": "Weekly badminton at Sports Complex",
        "category": "sports",
        "member_user_ids": [2, 3, 4]
    }
    """
    # Optional: Add members while creating the group (by user IDs)
    member_user_ids: Optional[List[Union[int, str]]] = Field(
        default=[], 
        description="User IDs of members to add"
    )


class GroupUpdate(BaseModel):
    """Schema for updating group details. All fields optional."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    category: Optional[str] = None


class GroupMemberInfo(BaseModel):
    """Info about a group member."""
    id: Union[int, str]
    user_id: Union[int, str]
    user_name: str
    user_email: str
    role: str  # 'admin' or 'member'
    joined_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class GroupResponse(GroupBase):
    """
    Schema for returning group data in API responses.
    Includes list of members.
    """
    id: Union[int, str]
    created_by_id: Union[int, str]
    is_active: bool
    created_at: Optional[datetime] = None
    member_count: Optional[int] = 0
    members: Optional[List[GroupMemberInfo]] = []
    
    class Config:
        from_attributes = True


class GroupMemberAdd(BaseModel):
    """
    Schema for adding a member to a group.
    Can add by email or user_id.
    """
    email: Optional[str] = None
    user_id: Optional[Union[int, str]] = None


class GroupMembersAdd(BaseModel):
    """
    Schema for adding multiple members to a group.
    """
    user_ids: List[Union[int, str]] = Field(..., description="List of user IDs to add")


class GroupListResponse(BaseModel):
    """Schema for listing groups with basic info."""
    id: Union[int, str]
    name: str
    description: Optional[str]
    category: str
    member_count: int
    created_at: Optional[datetime] = None
    your_balance: float = 0.0  # How much you owe or are owed
    
    class Config:
        from_attributes = True
