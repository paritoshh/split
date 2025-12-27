"""
===========================================
NOTIFICATION MODEL
===========================================
Stores notifications for users when:
- They are added to an expense
- Someone settles up with them
- They are added to a group
- etc.
===========================================
"""

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Notification(Base):
    """
    Notification table - stores notifications for users.
    """
    
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Who this notification is for
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Notification type: expense_added, settlement, group_invite, etc.
    notification_type = Column(String(50), nullable=False)
    
    # Title of the notification
    title = Column(String(255), nullable=False)
    
    # Detailed message
    message = Column(Text, nullable=False)
    
    # Related entity IDs (optional)
    expense_id = Column(Integer, ForeignKey("expenses.id"), nullable=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=True)
    from_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Has the user read this notification?
    is_read = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    from_user = relationship("User", foreign_keys=[from_user_id])
    
    def __repr__(self):
        return f"<Notification {self.id}: {self.title}>"

