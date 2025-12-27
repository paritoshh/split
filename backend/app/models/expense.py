"""
===========================================
EXPENSE MODELS
===========================================
The core of our app - tracking who paid what and who owes whom.

Two tables:
1. Expense - The expense itself (amount, description, who paid)
2. ExpenseSplit - How the expense is divided among people

Example:
    Paritosh pays ₹1200 for badminton court
    Split equally among 4 people (Paritosh, Raj, Amit, Priya)
    Each person's share: ₹300
    
    Expense table:
        - amount: 1200
        - paid_by: Paritosh
        
    ExpenseSplit table:
        - Paritosh: ₹300 (but he paid, so he's owed ₹900)
        - Raj: ₹300 (owes ₹300)
        - Amit: ₹300 (owes ₹300)
        - Priya: ₹300 (owes ₹300)
===========================================
"""

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Float, Text, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum


class SplitType(str, enum.Enum):
    """
    How an expense can be split among people.
    
    EQUAL: Everyone pays the same amount
    EXACT: Specify exact amount for each person
    PERCENTAGE: Specify percentage for each person
    SHARES: Split by shares (e.g., 2 shares for person A, 1 for person B)
    """
    EQUAL = "equal"
    EXACT = "exact"
    PERCENTAGE = "percentage"
    SHARES = "shares"


class Expense(Base):
    """
    Expense table - records each expense.
    
    Key fields:
    - amount: Total amount paid
    - paid_by: Who paid
    - split_type: How to divide it
    - group_id: Which group this belongs to (optional for 1-on-1)
    """
    
    __tablename__ = "expenses"
    
    # --- Columns ---
    id = Column(Integer, primary_key=True, index=True)
    
    # Total amount of the expense
    amount = Column(Float, nullable=False)
    
    # Currency (default INR for Indian Rupees)
    currency = Column(String(3), default="INR")
    
    # Description (e.g., "Badminton court booking")
    description = Column(String(255), nullable=False)
    
    # Optional notes
    notes = Column(Text, nullable=True)
    
    # Category for organization and AI insights
    # Examples: food, transport, sports, entertainment, utilities, rent, other
    category = Column(String(50), default="other")
    
    # Who paid for this expense
    paid_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Which group (optional - can be null for 1-on-1 expenses)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=True)
    
    # How is this expense split?
    split_type = Column(String(20), default=SplitType.EQUAL.value)
    
    # When did this expense happen (can be different from created_at)
    expense_date = Column(DateTime(timezone=True), server_default=func.now())
    
    # Receipt image URL (optional - for AI OCR feature)
    receipt_url = Column(String(500), nullable=True)
    
    # Is this expense still active? (for soft delete)
    is_active = Column(Boolean, default=True)
    
    # Is this expense settled?
    is_settled = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # --- Relationships ---
    
    # Who paid
    paid_by_user = relationship("User", back_populates="expenses_paid")
    
    # Which group
    group = relationship("Group", back_populates="expenses")
    
    # How it's split among people
    splits = relationship("ExpenseSplit", back_populates="expense", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Expense {self.description}: ₹{self.amount}>"


class ExpenseSplit(Base):
    """
    ExpenseSplit table - how each expense is divided.
    
    For each expense, we create one ExpenseSplit per person involved.
    This stores how much each person owes.
    
    Example: ₹1200 expense split among 4 people equally
        - ExpenseSplit 1: user_id=1, amount=300
        - ExpenseSplit 2: user_id=2, amount=300
        - ExpenseSplit 3: user_id=3, amount=300
        - ExpenseSplit 4: user_id=4, amount=300
    """
    
    __tablename__ = "expense_splits"
    
    # --- Columns ---
    id = Column(Integer, primary_key=True, index=True)
    
    # Which expense this split belongs to
    expense_id = Column(Integer, ForeignKey("expenses.id"), nullable=False)
    
    # Which user this split is for
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Their share of the expense
    amount = Column(Float, nullable=False)
    
    # For percentage splits
    percentage = Column(Float, nullable=True)
    
    # For shares splits (e.g., 2 shares out of 5 total)
    shares = Column(Float, nullable=True)
    
    # Has this user paid their share?
    is_paid = Column(Boolean, default=False)
    
    # When did they pay?
    paid_at = Column(DateTime(timezone=True), nullable=True)
    
    # --- Relationships ---
    expense = relationship("Expense", back_populates="splits")
    user = relationship("User")
    
    def __repr__(self):
        return f"<ExpenseSplit expense_id={self.expense_id} user_id={self.user_id} amount={self.amount}>"

