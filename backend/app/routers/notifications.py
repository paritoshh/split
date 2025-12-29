"""
===========================================
NOTIFICATIONS ROUTER
===========================================
API endpoints for:
- Get user's notifications
- Mark notifications as read
- Get unread count

Supports both SQLite and DynamoDB backends.
All endpoints require authentication.
All endpoints are prefixed with /api/notifications
===========================================
"""

from fastapi import APIRouter, Depends, HTTPException, status
from typing import List

from app.db import get_db_service, DBService
from app.schemas.notification import NotificationResponse, NotificationMarkRead
from app.services.auth import get_current_user

router = APIRouter(
    prefix="/api/notifications",
    tags=["Notifications"]
)


@router.get("/", response_model=List[NotificationResponse])
async def get_notifications(
    unread_only: bool = False,
    limit: int = 50,
    current_user: dict = Depends(get_current_user),
    db_service: DBService = Depends(get_db_service)
):
    """
    Get user's notifications.
    
    **Query Parameters:**
    - unread_only: If true, only return unread notifications
    - limit: Maximum number of notifications to return
    
    **Returns:** List of notifications, newest first
    """
    notifications = db_service.get_user_notifications(current_user["id"], limit=limit)
    
    # Filter unread if requested
    if unread_only:
        notifications = [n for n in notifications if not n.get("is_read", False)]
    
    result = []
    for notif in notifications:
        from_user = notif.get("from_user")
        from_user_name = from_user.get("name") if from_user else None
        
        result.append(NotificationResponse(
            id=notif["id"],
            notification_type=notif.get("notification_type", ""),
            title=notif.get("title", ""),
            message=notif.get("message", ""),
            expense_id=notif.get("expense_id"),
            group_id=notif.get("group_id"),
            from_user_id=notif.get("from_user_id"),
            from_user_name=from_user_name,
            is_read=notif.get("is_read", False),
            created_at=notif.get("created_at")
        ))
    
    return result


@router.get("/unread-count")
async def get_unread_count(
    current_user: dict = Depends(get_current_user),
    db_service: DBService = Depends(get_db_service)
):
    """
    Get count of unread notifications.
    
    **Returns:** {"count": number}
    """
    count = db_service.get_unread_notification_count(current_user["id"])
    return {"count": count}


@router.post("/mark-read")
async def mark_as_read(
    data: NotificationMarkRead,
    current_user: dict = Depends(get_current_user),
    db_service: DBService = Depends(get_db_service)
):
    """
    Mark notifications as read.
    
    **Request Body:**
    - notification_ids: List of notification IDs to mark as read
    
    **Returns:** {"marked": number of notifications marked}
    """
    marked = 0
    for notification_id in data.notification_ids:
        db_service.mark_notification_read(current_user["id"], str(notification_id))
        marked += 1
    
    return {"marked": marked}


@router.post("/mark-all-read")
async def mark_all_as_read(
    current_user: dict = Depends(get_current_user),
    db_service: DBService = Depends(get_db_service)
):
    """
    Mark all notifications as read.
    
    **Returns:** {"marked": number of notifications marked}
    """
    marked = db_service.mark_all_notifications_read(current_user["id"])
    return {"marked": marked}
