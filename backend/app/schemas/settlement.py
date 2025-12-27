"""
===========================================
SETTLEMENT SCHEMAS
===========================================
Schemas for settlement/payment operations.
===========================================
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class SettlementCreate(BaseModel):
    """Schema for recording a new settlement."""
    to_user_id: int  # Who you're paying
    amount: float = Field(..., gt=0, description="Settlement amount")
    group_id: Optional[int] = None  # Optional: settle within a specific group
    payment_method: str = Field(default="upi", description="Payment method: upi, cash, bank_transfer, other")
    transaction_ref: Optional[str] = None  # UPI transaction ID, etc.
    notes: Optional[str] = None


class SettlementResponse(BaseModel):
    """Schema for returning settlement data."""
    id: int
    from_user_id: int
    from_user_name: str
    to_user_id: int
    to_user_name: str
    amount: float
    group_id: Optional[int]
    group_name: Optional[str]
    payment_method: str
    transaction_ref: Optional[str]
    notes: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


class UPIPaymentInfo(BaseModel):
    """Schema for generating UPI payment link."""
    payee_upi_id: str
    payee_name: str
    amount: float
    transaction_note: str
    upi_link: str

