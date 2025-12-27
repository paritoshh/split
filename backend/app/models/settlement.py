"""
===========================================
SETTLEMENT MODEL
===========================================
Tracks payment settlements between users.
When someone pays back money they owe,
we record it here.
===========================================
"""

from sqlalchemy import Column, Integer, Float, String, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Settlement(Base):
    """
    Settlement table - tracks payments between users.
    
    Example: User A owes User B ₹500
    When A pays B, we create a settlement record.
    """
    
    __tablename__ = "settlements"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Who is paying
    from_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Who is receiving
    to_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Amount settled
    amount = Column(Float, nullable=False)
    
    # Optional: Specific group this settlement is for
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=True)
    
    # Payment method (upi, cash, bank_transfer, other)
    payment_method = Column(String(50), default="other")
    
    # Transaction reference (UPI transaction ID, etc.)
    transaction_ref = Column(String(255), nullable=True)
    
    # Notes
    notes = Column(String(500), nullable=True)
    
    # Is this settlement active (for soft delete)
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    from_user = relationship("User", foreign_keys=[from_user_id])
    to_user = relationship("User", foreign_keys=[to_user_id])
    group = relationship("Group", foreign_keys=[group_id])
    
    def __repr__(self):
        return f"<Settlement ₹{self.amount} from {self.from_user_id} to {self.to_user_id}>"

