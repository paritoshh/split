# ===========================================
# DATABASE MODELS
# ===========================================
# This file exports all models so they can be imported easily
# Example: from app.models import User, Group, Expense
# ===========================================

from app.models.user import User
from app.models.group import Group, GroupMember
from app.models.expense import Expense, ExpenseSplit
from app.models.notification import Notification
from app.models.settlement import Settlement

# Export all models
__all__ = ["User", "Group", "GroupMember", "Expense", "ExpenseSplit", "Notification", "Settlement"]

