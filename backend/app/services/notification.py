"""
===========================================
NOTIFICATION SERVICE
===========================================
Helper functions to create notifications.
===========================================
"""

from sqlalchemy.orm import Session
from app.models.notification import Notification
from app.models.user import User


def create_expense_notification(
    db: Session,
    to_user_id: int,
    from_user: User,
    expense_id: int,
    expense_description: str,
    amount: float,
    user_share: float,
    group_id: int = None
):
    """
    Create a notification when someone adds an expense that involves a user.
    
    Args:
        db: Database session
        to_user_id: User who should receive the notification
        from_user: User who created the expense
        expense_id: ID of the expense
        expense_description: Description of the expense
        amount: Total expense amount
        user_share: The recipient's share of the expense
        group_id: Optional group ID
    """
    notification = Notification(
        user_id=to_user_id,
        notification_type="expense_added",
        title=f"New expense: {expense_description}",
        message=f"{from_user.name} added an expense of ₹{amount:.2f}. Your share is ₹{user_share:.2f}",
        expense_id=expense_id,
        group_id=group_id,
        from_user_id=from_user.id
    )
    
    db.add(notification)
    db.commit()


def create_settlement_notification(
    db: Session,
    to_user_id: int,
    from_user: User,
    amount: float,
    group_id: int = None
):
    """
    Create a notification when someone settles up with a user.
    """
    notification = Notification(
        user_id=to_user_id,
        notification_type="settlement",
        title="Payment received",
        message=f"{from_user.name} paid you ₹{amount:.2f}",
        group_id=group_id,
        from_user_id=from_user.id
    )
    
    db.add(notification)
    db.commit()


def create_group_invite_notification(
    db: Session,
    to_user_id: int,
    from_user: User,
    group_id: int,
    group_name: str
):
    """
    Create a notification when someone is added to a group.
    """
    notification = Notification(
        user_id=to_user_id,
        notification_type="group_invite",
        title=f"Added to group: {group_name}",
        message=f"{from_user.name} added you to the group '{group_name}'",
        group_id=group_id,
        from_user_id=from_user.id
    )
    
    db.add(notification)
    db.commit()


def create_expense_update_notification(
    db: Session,
    to_user_id: int,
    from_user: User,
    expense_id: int,
    expense_description: str,
    new_amount: float,
    user_share: float,
    group_id: int = None
):
    """
    Create a notification when someone updates an expense.
    """
    notification = Notification(
        user_id=to_user_id,
        notification_type="expense_updated",
        title=f"Expense updated: {expense_description}",
        message=f"{from_user.name} updated an expense to ₹{new_amount:.2f}. Your share is ₹{user_share:.2f}",
        expense_id=expense_id,
        group_id=group_id,
        from_user_id=from_user.id
    )
    
    db.add(notification)
    db.commit()


def create_group_created_notification(
    db: Session,
    to_user_id: int,
    from_user: User,
    group_id: int,
    group_name: str
):
    """
    Create a notification when a group is created and user is added as member.
    """
    notification = Notification(
        user_id=to_user_id,
        notification_type="group_created",
        title=f"New group: {group_name}",
        message=f"{from_user.name} created a group '{group_name}' and added you",
        group_id=group_id,
        from_user_id=from_user.id
    )
    
    db.add(notification)
    db.commit()

