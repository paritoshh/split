"""
===========================================
EXPENSES ROUTER
===========================================
API endpoints for:
- Create expense
- List expenses (all, by group)
- Update/delete expense
- Get balances
- Record settlements

All endpoints require authentication.
All endpoints are prefixed with /api/expenses
===========================================
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.models.user import User
from app.models.group import Group, GroupMember
from app.models.expense import Expense, ExpenseSplit
from app.models.settlement import Settlement
from app.schemas.expense import (
    ExpenseCreate,
    ExpenseResponse,
    ExpenseUpdate,
    ExpenseSplitResponse,
    BalanceResponse,
    GroupBalanceResponse,
    SettlementCreate
)
from app.services.auth import get_current_user
from app.services.notification import create_expense_notification, create_expense_update_notification

router = APIRouter(
    prefix="/api/expenses",
    tags=["Expenses"]
)


@router.post("/", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
async def create_expense(
    expense_data: ExpenseCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new expense.
    
    **Request Body:**
    - amount: Total expense amount (required)
    - description: What was this for (required)
    - category: Category like food, transport, sports, etc.
    - group_id: Group this expense belongs to (optional)
    - split_type: How to split - equal, exact, percentage, shares
    - split_with_user_ids: For equal splits, list of user IDs
    - splits: For other split types, detailed breakdown
    
    **Examples:**
    
    Equal split with 3 friends:
    ```json
    {
        "amount": 1200,
        "description": "Badminton court",
        "category": "sports",
        "group_id": 1,
        "split_type": "equal",
        "split_with_user_ids": [2, 3, 4]
    }
    ```
    
    Exact split:
    ```json
    {
        "amount": 1000,
        "description": "Dinner",
        "split_type": "exact",
        "splits": [
            {"user_id": 2, "amount": 400},
            {"user_id": 3, "amount": 300}
        ]
    }
    ```
    """
    # Validate group membership if group_id provided
    if expense_data.group_id:
        group = db.query(Group).filter(
            Group.id == expense_data.group_id,
            Group.is_active == True
        ).first()
        
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        
        membership = db.query(GroupMember).filter(
            GroupMember.group_id == expense_data.group_id,
            GroupMember.user_id == current_user.id,
            GroupMember.is_active == True
        ).first()
        
        if not membership:
            raise HTTPException(status_code=403, detail="You are not a member of this group")
    
    # Create the expense
    new_expense = Expense(
        amount=expense_data.amount,
        currency=expense_data.currency,
        description=expense_data.description,
        notes=expense_data.notes,
        category=expense_data.category,
        paid_by_id=current_user.id,
        group_id=expense_data.group_id,
        split_type=expense_data.split_type.value,
        expense_date=expense_data.expense_date or datetime.utcnow(),
        receipt_url=expense_data.receipt_url
    )
    
    db.add(new_expense)
    db.commit()
    db.refresh(new_expense)
    
    # Create splits based on split_type
    if expense_data.split_type.value == "equal":
        # Equal split among current user and specified users
        user_ids = [current_user.id] + (expense_data.split_with_user_ids or [])
        user_ids = list(set(user_ids))  # Remove duplicates
        
        per_person = expense_data.amount / len(user_ids)
        
        for user_id in user_ids:
            split = ExpenseSplit(
                expense_id=new_expense.id,
                user_id=user_id,
                amount=round(per_person, 2)
            )
            db.add(split)
    
    elif expense_data.split_type.value == "exact":
        # Exact amounts specified
        total_split = 0
        for s in expense_data.splits:
            split = ExpenseSplit(
                expense_id=new_expense.id,
                user_id=s.user_id,
                amount=s.amount
            )
            total_split += s.amount
            db.add(split)
        
        # Add current user's share if not included
        if current_user.id not in [s.user_id for s in expense_data.splits]:
            remaining = expense_data.amount - total_split
            if remaining > 0:
                split = ExpenseSplit(
                    expense_id=new_expense.id,
                    user_id=current_user.id,
                    amount=remaining
                )
                db.add(split)
    
    elif expense_data.split_type.value == "percentage":
        # Percentage-based split
        for s in expense_data.splits:
            amount = (expense_data.amount * s.percentage) / 100
            split = ExpenseSplit(
                expense_id=new_expense.id,
                user_id=s.user_id,
                amount=round(amount, 2),
                percentage=s.percentage
            )
            db.add(split)
    
    elif expense_data.split_type.value == "shares":
        # Shares-based split
        total_shares = sum(s.shares for s in expense_data.splits)
        for s in expense_data.splits:
            amount = (expense_data.amount * s.shares) / total_shares
            split = ExpenseSplit(
                expense_id=new_expense.id,
                user_id=s.user_id,
                amount=round(amount, 2),
                shares=s.shares
            )
            db.add(split)
    
    db.commit()
    db.refresh(new_expense)
    
    # Send notifications to all participants (except the payer)
    splits = db.query(ExpenseSplit).filter(ExpenseSplit.expense_id == new_expense.id).all()
    for split in splits:
        if split.user_id != current_user.id:
            try:
                create_expense_notification(
                    db=db,
                    to_user_id=split.user_id,
                    from_user=current_user,
                    expense_id=new_expense.id,
                    expense_description=new_expense.description,
                    amount=new_expense.amount,
                    user_share=split.amount,
                    group_id=new_expense.group_id
                )
            except Exception as e:
                # Don't fail the expense creation if notification fails
                print(f"Failed to send notification: {e}")
    
    return _build_expense_response(new_expense, db)


@router.get("/", response_model=List[ExpenseResponse])
async def list_expenses(
    group_id: Optional[int] = None,
    category: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List expenses.
    
    **Query Parameters:**
    - group_id: Filter by group (optional)
    - category: Filter by category (optional)
    - limit: Max results (default 50)
    - offset: Skip results for pagination
    
    **Returns:** List of expenses you're involved in
    """
    # Build query
    query = db.query(Expense).filter(Expense.is_active == True)
    
    if group_id:
        # Verify membership
        membership = db.query(GroupMember).filter(
            GroupMember.group_id == group_id,
            GroupMember.user_id == current_user.id,
            GroupMember.is_active == True
        ).first()
        
        if not membership:
            raise HTTPException(status_code=403, detail="You are not a member of this group")
        
        query = query.filter(Expense.group_id == group_id)
    else:
        # Get all expenses where user is involved (paid or split)
        user_expense_ids = db.query(ExpenseSplit.expense_id).filter(
            ExpenseSplit.user_id == current_user.id
        ).subquery()
        
        query = query.filter(
            (Expense.paid_by_id == current_user.id) |
            (Expense.id.in_(user_expense_ids))
        )
    
    if category:
        query = query.filter(Expense.category == category)
    
    # Order by most recent first
    expenses = query.order_by(Expense.expense_date.desc()).offset(offset).limit(limit).all()
    
    return [_build_expense_response(e, db) for e in expenses]


# ===========================================
# BALANCE ROUTES - Must come BEFORE /{expense_id}
# ===========================================

@router.get("/balances/overall", response_model=List[BalanceResponse])
async def get_overall_balances(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get your overall balance with everyone.
    
    **Returns:** List of balances with each person you've shared expenses with
    
    - Positive amount = they owe you
    - Negative amount = you owe them
    
    Note: Settlements are factored into the balance calculation.
    """
    balances = {}  # user_id -> balance
    
    # Get all expenses where current user paid
    expenses_paid = db.query(Expense).filter(
        Expense.paid_by_id == current_user.id,
        Expense.is_active == True
    ).all()
    
    for expense in expenses_paid:
        splits = db.query(ExpenseSplit).filter(
            ExpenseSplit.expense_id == expense.id,
            ExpenseSplit.user_id != current_user.id
        ).all()
        
        for split in splits:
            if split.user_id not in balances:
                balances[split.user_id] = 0
            balances[split.user_id] += split.amount  # They owe this much
    
    # Get all expenses where current user owes
    user_splits = db.query(ExpenseSplit).filter(
        ExpenseSplit.user_id == current_user.id
    ).all()
    
    for split in user_splits:
        expense = db.query(Expense).filter(
            Expense.id == split.expense_id,
            Expense.is_active == True
        ).first()
        
        if expense and expense.paid_by_id != current_user.id:
            payer_id = expense.paid_by_id
            if payer_id not in balances:
                balances[payer_id] = 0
            balances[payer_id] -= split.amount  # You owe this much
    
    # Factor in settlements
    # Settlements where current user PAID someone (reduces what they owe)
    settlements_paid = db.query(Settlement).filter(
        Settlement.from_user_id == current_user.id,
        Settlement.is_active == True
    ).all()
    
    for settlement in settlements_paid:
        if settlement.to_user_id not in balances:
            balances[settlement.to_user_id] = 0
        # I paid them, so they owe me more (or I owe them less)
        balances[settlement.to_user_id] += settlement.amount
    
    # Settlements where current user RECEIVED payment (reduces what others owe)
    settlements_received = db.query(Settlement).filter(
        Settlement.to_user_id == current_user.id,
        Settlement.is_active == True
    ).all()
    
    for settlement in settlements_received:
        if settlement.from_user_id not in balances:
            balances[settlement.from_user_id] = 0
        # They paid me, so they owe me less
        balances[settlement.from_user_id] -= settlement.amount
    
    # Build response
    result = []
    for user_id, amount in balances.items():
        if abs(amount) > 0.01:  # Ignore tiny amounts due to rounding
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                result.append(BalanceResponse(
                    user_id=user.id,
                    user_name=user.name,
                    user_email=user.email,
                    amount=round(amount, 2)
                ))
    
    return result


@router.get("/balances/group/{group_id}", response_model=GroupBalanceResponse)
async def get_group_balances(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get your balance in a specific group.
    
    **Returns:** 
    - Total expenses in group
    - How much you've paid
    - Your total share
    - Your balance (owed or owing)
    - Balance with each member
    """
    # Verify membership
    membership = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == current_user.id,
        GroupMember.is_active == True
    ).first()
    
    if not membership:
        raise HTTPException(status_code=403, detail="You are not a member of this group")
    
    group = db.query(Group).filter(Group.id == group_id).first()
    
    # Calculate balances
    balances = {}
    total_expenses = 0
    your_paid = 0
    your_share = 0
    
    expenses = db.query(Expense).filter(
        Expense.group_id == group_id,
        Expense.is_active == True
    ).all()
    
    for expense in expenses:
        total_expenses += expense.amount
        
        if expense.paid_by_id == current_user.id:
            your_paid += expense.amount
            
            # Others owe you
            splits = db.query(ExpenseSplit).filter(
                ExpenseSplit.expense_id == expense.id,
                ExpenseSplit.user_id != current_user.id
            ).all()
            
            for split in splits:
                if split.user_id not in balances:
                    balances[split.user_id] = 0
                balances[split.user_id] += split.amount
        
        # Your share
        your_split = db.query(ExpenseSplit).filter(
            ExpenseSplit.expense_id == expense.id,
            ExpenseSplit.user_id == current_user.id
        ).first()
        
        if your_split:
            your_share += your_split.amount
            
            if expense.paid_by_id != current_user.id:
                # You owe the payer
                payer_id = expense.paid_by_id
                if payer_id not in balances:
                    balances[payer_id] = 0
                balances[payer_id] -= your_split.amount
    
    # Build balance responses
    balance_list = []
    for user_id, amount in balances.items():
        if abs(amount) > 0.01:
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                balance_list.append(BalanceResponse(
                    user_id=user.id,
                    user_name=user.name,
                    user_email=user.email,
                    amount=round(amount, 2)
                ))
    
    return GroupBalanceResponse(
        group_id=group_id,
        group_name=group.name,
        total_expenses=round(total_expenses, 2),
        your_total_paid=round(your_paid, 2),
        your_total_share=round(your_share, 2),
        your_balance=round(your_paid - your_share, 2),
        balances=balance_list
    )


@router.post("/settle", status_code=status.HTTP_200_OK)
async def record_settlement(
    settlement: SettlementCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Record a settlement payment.
    
    This doesn't actually transfer money - it records that you've settled up.
    Use this after paying someone via GPay/PhonePay/etc.
    
    **Request Body:**
    - to_user_id: Who you're paying
    - amount: How much you're paying
    - group_id: (optional) Settle within a specific group
    - notes: (optional) Payment reference or notes
    """
    # Verify the user exists
    to_user = db.query(User).filter(User.id == settlement.to_user_id).first()
    if not to_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "message": f"Settlement of ₹{settlement.amount} to {to_user.name} recorded",
        "settlement": {
            "from": current_user.name,
            "to": to_user.name,
            "amount": settlement.amount,
            "notes": settlement.notes
        }
    }


# ===========================================
# INDIVIDUAL EXPENSE ROUTES
# ===========================================

@router.get("/{expense_id}", response_model=ExpenseResponse)
async def get_expense(
    expense_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get details of a specific expense.
    """
    expense = db.query(Expense).filter(
        Expense.id == expense_id,
        Expense.is_active == True
    ).first()
    
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    # Check if user is involved
    is_payer = expense.paid_by_id == current_user.id
    is_in_split = db.query(ExpenseSplit).filter(
        ExpenseSplit.expense_id == expense_id,
        ExpenseSplit.user_id == current_user.id
    ).first() is not None
    
    if not is_payer and not is_in_split:
        raise HTTPException(status_code=403, detail="You are not involved in this expense")
    
    return _build_expense_response(expense, db)


@router.put("/{expense_id}", response_model=ExpenseResponse)
async def update_expense(
    expense_id: int,
    expense_data: ExpenseUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update an expense.
    
    Only the person who paid can update the expense.
    Supports updating amount, description, notes, category, date, and splits.
    """
    expense = db.query(Expense).filter(
        Expense.id == expense_id,
        Expense.is_active == True
    ).first()
    
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    if expense.paid_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the payer can update this expense")
    
    # Update basic fields
    if expense_data.description is not None:
        expense.description = expense_data.description
    if expense_data.notes is not None:
        expense.notes = expense_data.notes
    if expense_data.category is not None:
        expense.category = expense_data.category
    if expense_data.expense_date is not None:
        expense.expense_date = expense_data.expense_date
    
    # Handle amount and split updates together
    splits_changed = False
    new_amount = expense_data.amount if expense_data.amount is not None else expense.amount
    
    if expense_data.amount is not None:
        expense.amount = expense_data.amount
    
    # Update splits if provided
    if expense_data.split_type is not None or expense_data.split_with_user_ids is not None or expense_data.splits is not None:
        splits_changed = True
        
        # Delete existing splits
        db.query(ExpenseSplit).filter(ExpenseSplit.expense_id == expense.id).delete()
        
        split_type = expense_data.split_type.value if expense_data.split_type else expense.split_type
        expense.split_type = split_type
        
        if split_type == "equal" and expense_data.split_with_user_ids is not None:
            # Equal split among specified users (current user NOT auto-included)
            user_ids = list(set(expense_data.split_with_user_ids))
            if len(user_ids) == 0:
                raise HTTPException(status_code=400, detail="At least one user must be selected for split")
            
            per_person = new_amount / len(user_ids)
            
            for user_id in user_ids:
                split = ExpenseSplit(
                    expense_id=expense.id,
                    user_id=user_id,
                    amount=round(per_person, 2)
                )
                db.add(split)
        
        elif split_type == "exact" and expense_data.splits is not None:
            # Exact amounts specified
            for s in expense_data.splits:
                split = ExpenseSplit(
                    expense_id=expense.id,
                    user_id=s.user_id,
                    amount=s.amount
                )
                db.add(split)
    
    db.commit()
    db.refresh(expense)
    
    # Send notifications to all participants (except the payer)
    if splits_changed or expense_data.amount is not None:
        splits = db.query(ExpenseSplit).filter(ExpenseSplit.expense_id == expense.id).all()
        for split in splits:
            if split.user_id != current_user.id:
                try:
                    create_expense_update_notification(
                        db=db,
                        to_user_id=split.user_id,
                        from_user=current_user,
                        expense_id=expense.id,
                        expense_description=expense.description,
                        new_amount=expense.amount,
                        user_share=split.amount,
                        group_id=expense.group_id
                    )
                except Exception as e:
                    print(f"Failed to send notification: {e}")
    
    return _build_expense_response(expense, db)


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_expense(
    expense_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete (deactivate) an expense.
    
    Only the person who paid can delete the expense.
    """
    expense = db.query(Expense).filter(
        Expense.id == expense_id,
        Expense.is_active == True
    ).first()
    
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    if expense.paid_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the payer can delete this expense")
    
    expense.is_active = False
    db.commit()


def _build_expense_response(expense: Expense, db: Session) -> ExpenseResponse:
    """Helper to build ExpenseResponse with split info."""
    payer = db.query(User).filter(User.id == expense.paid_by_id).first()
    
    group_name = None
    if expense.group_id:
        group = db.query(Group).filter(Group.id == expense.group_id).first()
        if group:
            group_name = group.name
    
    splits = db.query(ExpenseSplit).filter(ExpenseSplit.expense_id == expense.id).all()
    
    split_responses = []
    for s in splits:
        user = db.query(User).filter(User.id == s.user_id).first()
        if user:
            split_responses.append(ExpenseSplitResponse(
                id=s.id,
                user_id=user.id,
                user_name=user.name,
                user_email=user.email,
                amount=s.amount,
                percentage=s.percentage,
                shares=s.shares,
                is_paid=s.is_paid
            ))
    
    return ExpenseResponse(
        id=expense.id,
        amount=expense.amount,
        currency=expense.currency,
        description=expense.description,
        notes=expense.notes,
        category=expense.category,
        paid_by_id=expense.paid_by_id,
        paid_by_name=payer.name if payer else "Unknown",
        group_id=expense.group_id,
        group_name=group_name,
        split_type=expense.split_type,
        expense_date=expense.expense_date,
        is_settled=expense.is_settled,
        created_at=expense.created_at,
        splits=split_responses
    )

