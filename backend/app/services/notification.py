"""
===========================================
NOTIFICATION SERVICE
===========================================
Helper functions to create notifications.
Supports both SQLite and DynamoDB backends.
===========================================
"""

from typing import Union
from app.db import DBService


def create_expense_notification(
    db_service: DBService,
    to_user_id: Union[str, int],
    from_user: dict,
    expense_id: Union[str, int],
    expense_description: str,
    amount: float,
    user_share: float,
    group_id: Union[str, int] = None
):
    """
    Create a notification when someone adds an expense that involves a user.
    """
    db_service.create_notification(
        user_id=str(to_user_id),
        notification_type="expense_added",
        title=f"New expense: {expense_description}",
        message=f"{from_user.get('name', 'Someone')} added an expense of ₹{amount:.2f}. Your share is ₹{user_share:.2f}",
        expense_id=str(expense_id) if expense_id else None,
        group_id=str(group_id) if group_id else None,
        from_user_id=str(from_user.get('id')) if from_user.get('id') else None
    )


def create_settlement_notification(
    db_service: DBService,
    to_user_id: Union[str, int],
    from_user: dict,
    amount: float,
    group_id: Union[str, int] = None
):
    """
    Create a notification when someone settles up with a user.
    """
    db_service.create_notification(
        user_id=str(to_user_id),
        notification_type="settlement",
        title="Payment received",
        message=f"{from_user.get('name', 'Someone')} paid you ₹{amount:.2f}",
        group_id=str(group_id) if group_id else None,
        from_user_id=str(from_user.get('id')) if from_user.get('id') else None
    )


def create_group_invite_notification(
    db_service: DBService,
    to_user_id: Union[str, int],
    from_user: dict,
    group_id: Union[str, int],
    group_name: str
):
    """
    Create a notification when someone is added to a group.
    """
    db_service.create_notification(
        user_id=str(to_user_id),
        notification_type="group_invite",
        title=f"Added to group: {group_name}",
        message=f"{from_user.get('name', 'Someone')} added you to the group '{group_name}'",
        group_id=str(group_id) if group_id else None,
        from_user_id=str(from_user.get('id')) if from_user.get('id') else None
    )


def create_expense_update_notification(
    db_service: DBService,
    to_user_id: Union[str, int],
    from_user: dict,
    expense_id: Union[str, int],
    expense_description: str,
    new_amount: float,
    user_share: float,
    group_id: Union[str, int] = None
):
    """
    Create a notification when someone updates an expense.
    """
    db_service.create_notification(
        user_id=str(to_user_id),
        notification_type="expense_updated",
        title=f"Expense updated: {expense_description}",
        message=f"{from_user.get('name', 'Someone')} updated an expense to ₹{new_amount:.2f}. Your share is ₹{user_share:.2f}",
        expense_id=str(expense_id) if expense_id else None,
        group_id=str(group_id) if group_id else None,
        from_user_id=str(from_user.get('id')) if from_user.get('id') else None
    )


def create_group_created_notification(
    db_service: DBService,
    to_user_id: Union[str, int],
    from_user: dict,
    group_id: Union[str, int],
    group_name: str
):
    """
    Create a notification when a group is created and user is added as member.
    """
    db_service.create_notification(
        user_id=str(to_user_id),
        notification_type="group_created",
        title=f"New group: {group_name}",
        message=f"{from_user.get('name', 'Someone')} created a group '{group_name}' and added you",
        group_id=str(group_id) if group_id else None,
        from_user_id=str(from_user.get('id')) if from_user.get('id') else None
    )
