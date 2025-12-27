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

All endpoints require authentication.
All endpoints are prefixed with /api/groups
===========================================
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List

from app.database import get_db
from app.models.user import User
from app.models.group import Group, GroupMember
from app.models.expense import Expense, ExpenseSplit
from app.models.settlement import Settlement
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new group.
    
    The creator automatically becomes an admin of the group.
    
    **Request Body:**
    - name: Group name (required)
    - description: Optional description
    - category: Group type (trip, home, couple, sports, party, other)
    - member_user_ids: Optional list of user IDs to add as members
    
    **Returns:** Created group with members
    """
    # Create the group
    new_group = Group(
        name=group_data.name,
        description=group_data.description,
        category=group_data.category,
        created_by_id=current_user.id
    )
    
    db.add(new_group)
    db.commit()
    db.refresh(new_group)
    
    # Add creator as admin
    creator_member = GroupMember(
        group_id=new_group.id,
        user_id=current_user.id,
        role="admin"
    )
    db.add(creator_member)
    
    # Add other members if provided (by user IDs)
    added_user_ids = []
    if group_data.member_user_ids:
        for user_id in group_data.member_user_ids:
            if user_id != current_user.id:  # Don't add creator twice
                user = db.query(User).filter(User.id == user_id).first()
                if user:
                    member = GroupMember(
                        group_id=new_group.id,
                        user_id=user.id,
                        role="member"
                    )
                    db.add(member)
                    added_user_ids.append(user_id)
    
    db.commit()
    db.refresh(new_group)
    
    # Send notifications to added members
    for user_id in added_user_ids:
        try:
            create_group_invite_notification(
                db=db,
                to_user_id=user_id,
                from_user=current_user,
                group_id=new_group.id,
                group_name=new_group.name
            )
        except Exception as e:
            print(f"Failed to send notification: {e}")
    
    # Build response with member info
    return _build_group_response(new_group, db)


@router.get("/", response_model=List[GroupListResponse])
async def list_groups(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all groups the current user is a member of.
    
    **Returns:** List of groups with basic info and your balance
    """
    # Get all group IDs where user is a member
    memberships = db.query(GroupMember).filter(
        GroupMember.user_id == current_user.id,
        GroupMember.is_active == True
    ).all()
    
    group_ids = [m.group_id for m in memberships]
    
    # Get groups
    groups = db.query(Group).filter(
        Group.id.in_(group_ids),
        Group.is_active == True
    ).all()
    
    # Build response with member counts and balances
    result = []
    for group in groups:
        member_count = db.query(GroupMember).filter(
            GroupMember.group_id == group.id,
            GroupMember.is_active == True
        ).count()
        
        # Calculate balance for this group
        your_balance = _calculate_group_balance(db, group.id, current_user.id)
        
        result.append(GroupListResponse(
            id=group.id,
            name=group.name,
            description=group.description,
            category=group.category,
            member_count=member_count,
            created_at=group.created_at,
            your_balance=your_balance
        ))
    
    return result


def _calculate_group_balance(db: Session, group_id: int, user_id: int) -> float:
    """
    Calculate user's balance in a group.
    
    Positive = you are owed money (you paid more than your share)
    Negative = you owe money (you paid less than your share)
    
    Includes settlements made within this group.
    """
    total_paid = 0.0  # How much the user paid for expenses in this group
    total_share = 0.0  # How much the user's share is in this group
    
    # Get all active expenses in this group
    expenses = db.query(Expense).filter(
        Expense.group_id == group_id,
        Expense.is_active == True
    ).all()
    
    for expense in expenses:
        # If user paid this expense, add to total_paid
        if expense.paid_by_id == user_id:
            total_paid += expense.amount
        
        # Get user's share in this expense
        user_split = db.query(ExpenseSplit).filter(
            ExpenseSplit.expense_id == expense.id,
            ExpenseSplit.user_id == user_id
        ).first()
        
        if user_split:
            total_share += user_split.amount
    
    # Factor in settlements for this group
    # Settlements where user PAID (reduces what they owe / increases what they're owed)
    settlements_paid = db.query(Settlement).filter(
        Settlement.from_user_id == user_id,
        Settlement.group_id == group_id,
        Settlement.is_active == True
    ).all()
    
    for settlement in settlements_paid:
        total_paid += settlement.amount  # Counts as if they paid more
    
    # Settlements where user RECEIVED (reduces what others owe them)
    settlements_received = db.query(Settlement).filter(
        Settlement.to_user_id == user_id,
        Settlement.group_id == group_id,
        Settlement.is_active == True
    ).all()
    
    for settlement in settlements_received:
        total_share += settlement.amount  # Counts as if their share was higher
    
    # Balance = what you paid - what you should have paid
    # Positive means you paid more than your share (others owe you)
    # Negative means you paid less than your share (you owe others)
    return round(total_paid - total_share, 2)


@router.get("/{group_id}", response_model=GroupResponse)
async def get_group(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get detailed info about a specific group.
    
    **Path Parameters:**
    - group_id: ID of the group
    
    **Returns:** Group details with all members
    
    **Errors:**
    - 404: Group not found
    - 403: Not a member of this group
    """
    group = db.query(Group).filter(Group.id == group_id, Group.is_active == True).first()
    
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )
    
    # Check if user is a member
    membership = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == current_user.id,
        GroupMember.is_active == True
    ).first()
    
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this group"
        )
    
    return _build_group_response(group, db)


@router.post("/{group_id}/members", response_model=GroupResponse)
async def add_member(
    group_id: int,
    member_data: GroupMemberAdd,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Add a member to a group.
    
    Only group admins can add members.
    
    **Path Parameters:**
    - group_id: ID of the group
    
    **Request Body:**
    - email: Email of user to add (OR)
    - user_id: ID of user to add
    
    **Returns:** Updated group with members
    """
    # Check if group exists
    group = db.query(Group).filter(Group.id == group_id, Group.is_active == True).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Check if current user is admin
    membership = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == current_user.id,
        GroupMember.role == "admin",
        GroupMember.is_active == True
    ).first()
    
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can add members"
        )
    
    # Find user to add (case-insensitive email)
    if member_data.email:
        user_to_add = db.query(User).filter(func.lower(User.email) == member_data.email.lower()).first()
    elif member_data.user_id:
        user_to_add = db.query(User).filter(User.id == member_data.user_id).first()
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide either email or user_id"
        )
    
    if not user_to_add:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if already a member
    existing = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == user_to_add.id
    ).first()
    
    if existing:
        if existing.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User is already a member"
            )
        else:
            # Re-activate membership
            existing.is_active = True
            db.commit()
    else:
        # Add new membership
        new_member = GroupMember(
            group_id=group_id,
            user_id=user_to_add.id,
            role="member"
        )
        db.add(new_member)
        db.commit()
    
    db.refresh(group)
    
    # Send notification
    try:
        create_group_invite_notification(
            db=db,
            to_user_id=user_to_add.id,
            from_user=current_user,
            group_id=group.id,
            group_name=group.name
        )
    except Exception as e:
        print(f"Failed to send notification: {e}")
    
    return _build_group_response(group, db)


@router.post("/{group_id}/members/bulk", response_model=GroupResponse)
async def add_members_bulk(
    group_id: int,
    members_data: GroupMembersAdd,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Add multiple members to a group at once.
    
    Only group admins can add members.
    
    **Path Parameters:**
    - group_id: ID of the group
    
    **Request Body:**
    - user_ids: List of user IDs to add
    
    **Returns:** Updated group with members
    """
    # Check if group exists
    group = db.query(Group).filter(Group.id == group_id, Group.is_active == True).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Check if current user is admin
    membership = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == current_user.id,
        GroupMember.role == "admin",
        GroupMember.is_active == True
    ).first()
    
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can add members"
        )
    
    added_users = []
    
    for user_id in members_data.user_ids:
        # Find user
        user_to_add = db.query(User).filter(User.id == user_id).first()
        if not user_to_add:
            continue
        
        # Check if already a member
        existing = db.query(GroupMember).filter(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user_to_add.id
        ).first()
        
        if existing:
            if not existing.is_active:
                # Re-activate membership
                existing.is_active = True
                added_users.append(user_to_add)
        else:
            # Add new membership
            new_member = GroupMember(
                group_id=group_id,
                user_id=user_to_add.id,
                role="member"
            )
            db.add(new_member)
            added_users.append(user_to_add)
    
    db.commit()
    db.refresh(group)
    
    # Send notifications to all added users
    for added_user in added_users:
        try:
            create_group_invite_notification(
                db=db,
                to_user_id=added_user.id,
                from_user=current_user,
                group_id=group.id,
                group_name=group.name
            )
        except Exception as e:
            print(f"Failed to send notification: {e}")
    
    return _build_group_response(group, db)


@router.delete("/{group_id}/members/{user_id}", response_model=GroupResponse)
async def remove_member(
    group_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Remove a member from a group.
    
    Admins can remove anyone. Members can only remove themselves.
    
    **Path Parameters:**
    - group_id: ID of the group
    - user_id: ID of the user to remove
    """
    group = db.query(Group).filter(Group.id == group_id, Group.is_active == True).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Check if current user is admin or removing themselves
    current_membership = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == current_user.id,
        GroupMember.is_active == True
    ).first()
    
    if not current_membership:
        raise HTTPException(status_code=403, detail="You are not a member of this group")
    
    is_admin = current_membership.role == "admin"
    is_removing_self = user_id == current_user.id
    
    if not is_admin and not is_removing_self:
        raise HTTPException(status_code=403, detail="Only admins can remove other members")
    
    # Find and deactivate membership
    membership_to_remove = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == user_id,
        GroupMember.is_active == True
    ).first()
    
    if not membership_to_remove:
        raise HTTPException(status_code=404, detail="Member not found")
    
    membership_to_remove.is_active = False
    db.commit()
    db.refresh(group)
    
    return _build_group_response(group, db)


@router.put("/{group_id}", response_model=GroupResponse)
async def update_group(
    group_id: int,
    group_data: GroupUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update group details.
    
    Only admins can update groups.
    """
    group = db.query(Group).filter(Group.id == group_id, Group.is_active == True).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Check if admin
    membership = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == current_user.id,
        GroupMember.role == "admin",
        GroupMember.is_active == True
    ).first()
    
    if not membership:
        raise HTTPException(status_code=403, detail="Only admins can update groups")
    
    # Update fields
    if group_data.name is not None:
        group.name = group_data.name
    if group_data.description is not None:
        group.description = group_data.description
    if group_data.category is not None:
        group.category = group_data.category
    
    db.commit()
    db.refresh(group)
    
    return _build_group_response(group, db)


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete (deactivate) a group.
    
    Only the creator or admins can delete groups.
    Expenses are preserved for history.
    """
    group = db.query(Group).filter(Group.id == group_id, Group.is_active == True).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Check if admin
    membership = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == current_user.id,
        GroupMember.role == "admin",
        GroupMember.is_active == True
    ).first()
    
    if not membership:
        raise HTTPException(status_code=403, detail="Only admins can delete groups")
    
    # Soft delete
    group.is_active = False
    db.commit()


def _build_group_response(group: Group, db: Session) -> GroupResponse:
    """Helper to build GroupResponse with member info."""
    members = db.query(GroupMember).filter(
        GroupMember.group_id == group.id,
        GroupMember.is_active == True
    ).all()
    
    member_infos = []
    for m in members:
        user = db.query(User).filter(User.id == m.user_id).first()
        if user:
            member_infos.append(GroupMemberInfo(
                id=m.id,
                user_id=user.id,
                user_name=user.name,
                user_email=user.email,
                role=m.role,
                joined_at=m.joined_at
            ))
    
    return GroupResponse(
        id=group.id,
        name=group.name,
        description=group.description,
        category=group.category,
        created_by_id=group.created_by_id,
        is_active=group.is_active,
        created_at=group.created_at,
        member_count=len(member_infos),
        members=member_infos
    )

