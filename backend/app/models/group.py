"""
===========================================
GROUP MODELS
===========================================
Groups allow users to share expenses together.
Examples: "Badminton Squad", "Party Gang", "Roommates"

We have two tables here:
1. Group - The group itself (name, description, etc.)
2. GroupMember - Which users are in which groups (many-to-many)

Why a separate GroupMember table?
- One user can be in MANY groups
- One group can have MANY users
- This is called a "many-to-many" relationship
- We need a "join table" (GroupMember) to connect them
===========================================
"""

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Group(Base):
    """
    Group table - represents a group of people sharing expenses.
    
    Example groups:
    - "Badminton Squad" - for weekly games
    - "Birthday Party" - one-time event
    - "Flat Expenses" - recurring household expenses
    """
    
    __tablename__ = "groups"
    
    # --- Columns ---
    id = Column(Integer, primary_key=True, index=True)
    
    # Group name (e.g., "Badminton Squad")
    name = Column(String(100), nullable=False)
    
    # Optional description
    description = Column(Text, nullable=True)
    
    # Group type/category
    # Common types: trip, home, couple, sports, party, other
    category = Column(String(50), default="other")
    
    # Who created this group
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Is this group still active?
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # --- Relationships ---
    
    # Members of this group (through GroupMember join table)
    members = relationship("GroupMember", back_populates="group")
    
    # Expenses in this group
    expenses = relationship("Expense", back_populates="group")
    
    def __repr__(self):
        return f"<Group {self.name}>"


class GroupMember(Base):
    """
    GroupMember table - connects users to groups.
    
    This is a "join table" or "association table".
    It stores which users are in which groups.
    
    Extra info we can store:
    - When did they join?
    - What's their role? (admin, member)
    - Have they left the group?
    """
    
    __tablename__ = "group_members"
    
    # --- Columns ---
    id = Column(Integer, primary_key=True, index=True)
    
    # Which group
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
    
    # Which user
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Role in the group
    # admin: can add/remove members, delete group
    # member: can add expenses
    role = Column(String(20), default="member")  # 'admin' or 'member'
    
    # Has this member left the group?
    # We keep them in DB for expense history, but mark as left
    is_active = Column(Boolean, default=True)
    
    # When did they join
    joined_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # --- Relationships ---
    group = relationship("Group", back_populates="members")
    user = relationship("User", back_populates="group_memberships")
    
    def __repr__(self):
        return f"<GroupMember user_id={self.user_id} group_id={self.group_id}>"

