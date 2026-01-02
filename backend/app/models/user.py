"""
===========================================
USER MODEL
===========================================
This defines the 'users' table in our database.

What is a Model?
- A Python class that represents a database table
- Each attribute = a column in the table
- Each instance = a row in the table

Example:
    user = User(name="Paritosh", email="p@example.com")
    db.add(user)  # Add to database
    db.commit()   # Save changes
===========================================
"""

from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class User(Base):
    """
    User table - stores all registered users.
    
    Columns:
    - id: Unique identifier (auto-generated)
    - email: User's email (must be unique)
    - name: Display name
    - phone: Phone number (optional, for UPI payments)
    - hashed_password: Password stored securely (never store plain text!)
    - is_active: Is the account active?
    - created_at: When the user registered
    """
    
    # Table name in database
    __tablename__ = "users"
    
    # --- Columns ---
    
    # Primary key - unique ID for each user
    # Integer: stores whole numbers
    # primary_key=True: this is the main identifier
    # index=True: creates an index for faster lookups
    id = Column(Integer, primary_key=True, index=True)
    
    # Email - must be unique (no two users with same email)
    email = Column(String(255), unique=True, index=True, nullable=False)
    
    # Display name
    name = Column(String(100), nullable=False)
    
    # Phone number (optional) - useful for UPI/payment integration
    phone = Column(String(15), nullable=True)
    
    # UPI ID for payments (optional)
    
    # Password - stored as a hash, never plain text!
    # We'll use bcrypt to hash passwords before storing
    hashed_password = Column(String(255), nullable=False)
    
    # Is this account active? (for soft delete)
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    # func.now() automatically sets current time when row is created
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # --- Relationships ---
    # These create connections to other tables
    
    # Groups this user is a member of
    # 'back_populates' creates a two-way connection
    group_memberships = relationship("GroupMember", back_populates="user")
    
    # Expenses this user paid for
    expenses_paid = relationship("Expense", back_populates="paid_by_user")
    
    def __repr__(self):
        """String representation for debugging"""
        return f"<User {self.name} ({self.email})>"

