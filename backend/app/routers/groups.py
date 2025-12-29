"""
===========================================
GROUPS ROUTER
===========================================
API endpoints for:
- Create group
- List user's groups
- Get group details
- Add/remove members
- Update/delete group

Supports both SQLite and DynamoDB backends.
All endpoints are prefixed with /api/groups
===========================================
"""

from fastapi import APIRouter, Depends, HTTPException, status
from typing import List

from app.db import get_db_service, DBService
from app.schemas.group import (
    GroupCreate, 
    GroupResponse, 
    GroupUpdate,
    GroupMemberAdd,
    GroupMembersAdd,
    GroupListResponse,
    GroupMemberInfo
)
from app.services.auth import get_current_user
from app.services.notification import create_group_invite_notification

router = APIRouter(
    prefix="/api/groups",
    tags=["Groups"]
)


@router.post("/", response_model=GroupResponse, status_code=status.HTTP_201_CREATED)
async def create_group(
    group_data: GroupCreate,
    current_user: dict = Depends(get_current_user),
    db_service: DBService = Depends(get_db_service)
):
    """
    Create a new group.
    The creator automatically becomes an admin of the group.
    """
    # Create the group (service handles adding creator as admin)
    new_group = db_service.create_group(
        name=group_data.name,
        created_by_id=current_user["id"],
        description=group_data.description,
        category=group_data.category
    )
    
    # Add other members if provided
    added_user_ids = []
    if group_data.member_user_ids:
        for user_id in group_data.member_user_ids:
            if str(user_id) != str(current_user["id"]):
                user = db_service.get_user_by_id(str(user_id))
                if user:
                    db_service.add_group_member(new_group["id"], str(user_id), role="member")
                    added_user_ids.append(user_id)
    
    # Send notifications to added members
    for user_id in added_user_ids:
        try:
            create_group_invite_notification(
                db_service=db_service,
                to_user_id=user_id,
                from_user=current_user,
                group_id=new_group["id"],
                group_name=new_group["name"]
            )
        except Exception as e:
            print(f"Failed to send notification: {e}")
    
    # Get updated group with members
    return _build_group_response(db_service, new_group["id"])


@router.get("/", response_model=List[GroupListResponse])
async def list_groups(
    current_user: dict = Depends(get_current_user),
    db_service: DBService = Depends(get_db_service)
):
    """
    List all groups the current user is a member of.
    """
    groups = db_service.get_user_groups(current_user["id"])
    
    result = []
    for group in groups:
        member_count = len(group.get("members", []))
        
        # Calculate balance for this group
        balances = db_service.calculate_user_balances(current_user["id"], group["id"])
        your_balance = sum(balances.values())
        
        result.append(GroupListResponse(
            id=int(group["id"]) if group["id"] else 0,
            name=group["name"],
            description=group.get("description"),
            category=group.get("category", "other"),
            member_count=member_count,
            created_at=group.get("created_at"),
            your_balance=round(your_balance, 2)
        ))
    
    return result


@router.get("/{group_id}", response_model=GroupResponse)
async def get_group(
    group_id: str,
    current_user: dict = Depends(get_current_user),
    db_service: DBService = Depends(get_db_service)
):
    """
    Get detailed info about a specific group.
    """
    group = db_service.get_group_by_id(str(group_id))
    
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )
    
    # Check if user is a member
    if not db_service.is_group_member(str(group_id), current_user["id"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this group"
        )
    
    return _build_group_response(db_service, str(group_id))


@router.post("/{group_id}/members", response_model=GroupResponse)
async def add_member(
    group_id: str,
    member_data: GroupMemberAdd,
    current_user: dict = Depends(get_current_user),
    db_service: DBService = Depends(get_db_service)
):
    """
    Add a member to a group. Only group admins can add members.
    """
    # Check if group exists
    group = db_service.get_group_by_id(str(group_id))
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Check if current user is admin
    if not db_service.is_group_admin(str(group_id), current_user["id"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can add members"
        )
    
    # Find user to add
    user_to_add = None
    if member_data.email:
        user_to_add = db_service.get_user_by_email(member_data.email)
    elif member_data.user_id:
        user_to_add = db_service.get_user_by_id(str(member_data.user_id))
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide either email or user_id"
        )
    
    if not user_to_add:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if already a member
    if db_service.is_group_member(str(group_id), user_to_add["id"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a member"
        )
    
    # Add member
    db_service.add_group_member(str(group_id), user_to_add["id"], role="member")
    
    # Send notification
    try:
        create_group_invite_notification(
            db_service=db_service,
            to_user_id=user_to_add["id"],
            from_user=current_user,
            group_id=group["id"],
            group_name=group["name"]
        )
    except Exception as e:
        print(f"Failed to send notification: {e}")
    
    return _build_group_response(db_service, str(group_id))


@router.post("/{group_id}/members/bulk", response_model=GroupResponse)
async def add_members_bulk(
    group_id: str,
    members_data: GroupMembersAdd,
    current_user: dict = Depends(get_current_user),
    db_service: DBService = Depends(get_db_service)
):
    """
    Add multiple members to a group at once.
    """
    group = db_service.get_group_by_id(str(group_id))
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    if not db_service.is_group_admin(str(group_id), current_user["id"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can add members"
        )
    
    added_users = []
    for user_id in members_data.user_ids:
        user_to_add = db_service.get_user_by_id(str(user_id))
        if not user_to_add:
            continue
        
        if not db_service.is_group_member(str(group_id), str(user_id)):
            db_service.add_group_member(str(group_id), str(user_id), role="member")
            added_users.append(user_to_add)
    
    # Send notifications
    for added_user in added_users:
        try:
            create_group_invite_notification(
                db_service=db_service,
                to_user_id=added_user["id"],
                from_user=current_user,
                group_id=group["id"],
                group_name=group["name"]
            )
        except Exception as e:
            print(f"Failed to send notification: {e}")
    
    return _build_group_response(db_service, str(group_id))


@router.delete("/{group_id}/members/{user_id}", response_model=GroupResponse)
async def remove_member(
    group_id: str,
    user_id: str,
    current_user: dict = Depends(get_current_user),
    db_service: DBService = Depends(get_db_service)
):
    """
    Remove a member from a group.
    """
    group = db_service.get_group_by_id(str(group_id))
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Check permissions
    is_admin = db_service.is_group_admin(str(group_id), current_user["id"])
    is_removing_self = str(user_id) == str(current_user["id"])
    
    if not is_admin and not is_removing_self:
        raise HTTPException(status_code=403, detail="Only admins can remove other members")
    
    if not db_service.is_group_member(str(group_id), str(user_id)):
        raise HTTPException(status_code=404, detail="Member not found")
    
    db_service.remove_group_member(str(group_id), str(user_id))
    
    return _build_group_response(db_service, str(group_id))


@router.put("/{group_id}", response_model=GroupResponse)
async def update_group(
    group_id: str,
    group_data: GroupUpdate,
    current_user: dict = Depends(get_current_user),
    db_service: DBService = Depends(get_db_service)
):
    """
    Update group details. Only admins can update groups.
    """
    group = db_service.get_group_by_id(str(group_id))
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    if not db_service.is_group_admin(str(group_id), current_user["id"]):
        raise HTTPException(status_code=403, detail="Only admins can update groups")
    
    update_fields = {}
    if group_data.name is not None:
        update_fields["name"] = group_data.name
    if group_data.description is not None:
        update_fields["description"] = group_data.description
    if group_data.category is not None:
        update_fields["category"] = group_data.category
    
    if update_fields:
        db_service.update_group(str(group_id), **update_fields)
    
    return _build_group_response(db_service, str(group_id))


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group(
    group_id: str,
    current_user: dict = Depends(get_current_user),
    db_service: DBService = Depends(get_db_service)
):
    """
    Delete (deactivate) a group.
    """
    group = db_service.get_group_by_id(str(group_id))
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    if not db_service.is_group_admin(str(group_id), current_user["id"]):
        raise HTTPException(status_code=403, detail="Only admins can delete groups")
    
    db_service.delete_group(str(group_id))


def _build_group_response(db_service: DBService, group_id: str) -> GroupResponse:
    """Helper to build GroupResponse with member info."""
    group = db_service.get_group_by_id(str(group_id))
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    members = group.get("members", [])
    
    member_infos = []
    for m in members:
        user = m.get("user", {})
        if user:
            member_infos.append(GroupMemberInfo(
                id=0,  # Not used in DynamoDB
                user_id=int(user.get("id", 0)) if user.get("id") else 0,
                user_name=user.get("name", "Unknown"),
                user_email=user.get("email", ""),
                role=m.get("role", "member"),
                joined_at=m.get("joined_at")
            ))
    
    return GroupResponse(
        id=int(group["id"]) if group["id"] else 0,
        name=group["name"],
        description=group.get("description"),
        category=group.get("category", "other"),
        created_by_id=int(group.get("created_by_id", 0)) if group.get("created_by_id") else 0,
        is_active=group.get("is_active", True),
        created_at=group.get("created_at"),
        member_count=len(member_infos),
        members=member_infos
    )
