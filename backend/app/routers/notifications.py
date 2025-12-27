"""
===========================================
NOTIFICATIONS ROUTER
===========================================
API endpoints for:
- Get user's notifications
- Mark notifications as read
- Get unread count

All endpoints require authentication.
All endpoints are prefixed with /api/notifications
===========================================
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.user import User
from app.models.notification import Notification
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get user's notifications.
    
    **Query Parameters:**
    - unread_only: If true, only return unread notifications
    - limit: Maximum number of notifications to return
    
    **Returns:** List of notifications, newest first
    """
    query = db.query(Notification).filter(Notification.user_id == current_user.id)
    
    if unread_only:
        query = query.filter(Notification.is_read == False)
    
    notifications = query.order_by(Notification.created_at.desc()).limit(limit).all()
    
    # Build response with from_user_name
    result = []
    for notif in notifications:
        from_user_name = None
        if notif.from_user_id:
            from_user = db.query(User).filter(User.id == notif.from_user_id).first()
            if from_user:
                from_user_name = from_user.name
        
        result.append(NotificationResponse(
            id=notif.id,
            notification_type=notif.notification_type,
            title=notif.title,
            message=notif.message,
            expense_id=notif.expense_id,
            group_id=notif.group_id,
            from_user_id=notif.from_user_id,
            from_user_name=from_user_name,
            is_read=notif.is_read,
            created_at=notif.created_at
        ))
    
    return result


@router.get("/unread-count")
async def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get count of unread notifications.
    
    **Returns:** {"count": number}
    """
    count = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).count()
    
    return {"count": count}


@router.post("/mark-read")
async def mark_as_read(
    data: NotificationMarkRead,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Mark notifications as read.
    
    **Request Body:**
    - notification_ids: List of notification IDs to mark as read
    
    **Returns:** {"marked": number of notifications marked}
    """
    # Only update notifications belonging to the current user
    updated = db.query(Notification).filter(
        Notification.id.in_(data.notification_ids),
        Notification.user_id == current_user.id
    ).update({"is_read": True}, synchronize_session=False)
    
    db.commit()
    
    return {"marked": updated}


@router.post("/mark-all-read")
async def mark_all_as_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Mark all notifications as read.
    
    **Returns:** {"marked": number of notifications marked}
    """
    updated = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).update({"is_read": True}, synchronize_session=False)
    
    db.commit()
    
    return {"marked": updated}

