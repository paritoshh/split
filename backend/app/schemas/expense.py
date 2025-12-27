"""
===========================================
EXPENSE SCHEMAS
===========================================
Schemas for expense-related API operations.
===========================================
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class SplitType(str, Enum):
    """How to split an expense."""
    EQUAL = "equal"
    EXACT = "exact"
    PERCENTAGE = "percentage"
    SHARES = "shares"


class ExpenseSplitCreate(BaseModel):
    """
    Schema for defining how an expense is split.
    
    For EQUAL split: just provide user_ids, amounts calculated automatically
    For EXACT split: provide user_id and exact amount each person pays
    For PERCENTAGE: provide user_id and percentage
    For SHARES: provide user_id and number of shares
    """
    user_id: int
    amount: Optional[float] = None  # For EXACT splits
    percentage: Optional[float] = None  # For PERCENTAGE splits
    shares: Optional[float] = None  # For SHARES splits


class ExpenseCreate(BaseModel):
    """
    Schema for creating a new expense.
    
    Example 1 - Equal split:
    {
        "amount": 1200,
        "description": "Badminton court",
        "category": "sports",
        "group_id": 1,
        "split_type": "equal",
        "split_with_user_ids": [2, 3, 4]  # Split with these users
    }
    
    Example 2 - Exact split:
    {
        "amount": 1000,
        "description": "Dinner",
        "category": "food",
        "group_id": 1,
        "split_type": "exact",
        "splits": [
            {"user_id": 1, "amount": 400},
            {"user_id": 2, "amount": 300},
            {"user_id": 3, "amount": 300}
        ]
    }
    """
    amount: float = Field(..., gt=0, description="Total expense amount")
    description: str = Field(..., min_length=1, max_length=255)
    notes: Optional[str] = None
    category: str = Field(default="other")
    currency: str = Field(default="INR")
    
    # Which group (optional for personal/1-on-1 expenses)
    group_id: Optional[int] = None
    
    # How to split
    split_type: SplitType = SplitType.EQUAL
    
    # For EQUAL splits - just list user IDs (current user auto-included)
    split_with_user_ids: Optional[List[int]] = []
    
    # For EXACT/PERCENTAGE/SHARES splits - detailed breakdown
    splits: Optional[List[ExpenseSplitCreate]] = []
    
    # When did this expense happen
    expense_date: Optional[datetime] = None
    
    # Receipt URL (optional)
    receipt_url: Optional[str] = None


class ExpenseSplitResponse(BaseModel):
    """Schema for split details in response."""
    id: int
    user_id: int
    user_name: str
    user_email: str
    amount: float
    percentage: Optional[float]
    shares: Optional[float]
    is_paid: bool
    
    class Config:
        from_attributes = True


class ExpenseResponse(BaseModel):
    """Schema for returning expense data."""
    id: int
    amount: float
    currency: str
    description: str
    notes: Optional[str]
    category: str
    
    paid_by_id: int
    paid_by_name: str
    
    group_id: Optional[int]
    group_name: Optional[str]
    
    split_type: str
    expense_date: datetime
    is_settled: bool
    created_at: datetime
    
    splits: List[ExpenseSplitResponse] = []
    
    class Config:
        from_attributes = True


class ExpenseUpdate(BaseModel):
    """Schema for updating an expense."""
    amount: Optional[float] = Field(None, gt=0)
    description: Optional[str] = Field(None, max_length=255)
    notes: Optional[str] = None
    category: Optional[str] = None
    expense_date: Optional[datetime] = None
    
    # For updating splits
    split_type: Optional[SplitType] = None
    split_with_user_ids: Optional[List[int]] = None  # For equal splits
    splits: Optional[List[ExpenseSplitCreate]] = None  # For exact splits


class BalanceResponse(BaseModel):
    """
    Schema for balance between two users or in a group.
    
    Positive amount = they owe you
    Negative amount = you owe them
    """
    user_id: int
    user_name: str
    user_email: str
    amount: float  # Positive = they owe you, Negative = you owe them
    
    class Config:
        from_attributes = True


class GroupBalanceResponse(BaseModel):
    """Overall balance in a group."""
    group_id: int
    group_name: str
    total_expenses: float
    your_total_paid: float
    your_total_share: float
    your_balance: float  # Positive = you're owed, Negative = you owe
    balances: List[BalanceResponse]  # Balance with each member


class SettlementCreate(BaseModel):
    """Schema for recording a settlement/payment."""
    to_user_id: int  # Who you're paying
    amount: float = Field(..., gt=0)
    group_id: Optional[int] = None
    notes: Optional[str] = None

