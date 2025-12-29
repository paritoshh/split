"""
===========================================
SETTLEMENT SCHEMAS
===========================================
Schemas for settlement/payment operations.
Supports both SQLite (int IDs) and DynamoDB (string UUIDs).
===========================================
"""

from pydantic import BaseModel, Field
from typing import Optional, Union
from datetime import datetime


class SettlementCreate(BaseModel):
    """Schema for recording a new settlement."""
    to_user_id: Union[int, str]  # Who is receiving the payment
    from_user_id: Optional[Union[int, str]] = None  # Who paid (defaults to current user if not specified)
    amount: float = Field(..., gt=0, description="Settlement amount")
    group_id: Optional[Union[int, str]] = None  # Optional: settle within a specific group
    payment_method: str = Field(default="upi", description="Payment method: upi, cash, bank_transfer, other")
    transaction_ref: Optional[str] = None  # UPI transaction ID, etc.
    notes: Optional[str] = None


class SettlementResponse(BaseModel):
    """Schema for returning settlement data."""
    id: Union[int, str]
    from_user_id: Union[int, str]
    from_user_name: str
    to_user_id: Union[int, str]
    to_user_name: str
    amount: float
    group_id: Optional[Union[int, str]] = None
    group_name: Optional[str] = None
    payment_method: str
    transaction_ref: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class UPIPaymentInfo(BaseModel):
    """Schema for generating UPI payment link."""
    payee_upi_id: str
    payee_name: str
    amount: float
    transaction_note: str
    upi_link: str
