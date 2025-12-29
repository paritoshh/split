"""
===========================================
EXPENSES ROUTER
===========================================
API endpoints for:
- Create expense
- List expenses (all, by group)
- Update/delete expense
- Get balances

Supports both SQLite and DynamoDB backends.
All endpoints require authentication.
All endpoints are prefixed with /api/expenses
===========================================
"""

from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from datetime import datetime

from app.db import get_db_service, DBService
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
    current_user: dict = Depends(get_current_user),
    db_service: DBService = Depends(get_db_service)
):
    """
    Create a new expense.
    """
    # Validate group membership if group_id provided
    if expense_data.group_id:
        group = db_service.get_group_by_id(str(expense_data.group_id))
        if not group or not group.get("is_active", True):
            raise HTTPException(status_code=404, detail="Group not found")
        
        if not db_service.is_group_member(str(expense_data.group_id), current_user["id"]):
            raise HTTPException(status_code=403, detail="You are not a member of this group")
    
    # Prepare splits
    splits = []
    if expense_data.split_type.value == "equal":
        # Equal split among current user and specified users
        user_ids = [current_user["id"]] + [str(uid) for uid in (expense_data.split_with_user_ids or [])]
        user_ids = list(set(user_ids))  # Remove duplicates
        
        per_person = expense_data.amount / len(user_ids)
        
        for user_id in user_ids:
            splits.append({
                "user_id": str(user_id),
                "amount": round(per_person, 2)
            })
    
    elif expense_data.split_type.value == "exact":
        total_split = 0
        for s in expense_data.splits:
            splits.append({
                "user_id": str(s.user_id),
                "amount": s.amount
            })
            total_split += s.amount
        
        # Add current user's share if not included
        current_user_in_splits = any(str(s.user_id) == str(current_user["id"]) for s in expense_data.splits)
        if not current_user_in_splits:
            remaining = expense_data.amount - total_split
            if remaining > 0:
                splits.append({
                    "user_id": str(current_user["id"]),
                    "amount": remaining
                })
    
    elif expense_data.split_type.value == "percentage":
        for s in expense_data.splits:
            amount = (expense_data.amount * s.percentage) / 100
            splits.append({
                "user_id": str(s.user_id),
                "amount": round(amount, 2),
                "percentage": s.percentage
            })
    
    elif expense_data.split_type.value == "shares":
        total_shares = sum(s.shares for s in expense_data.splits)
        for s in expense_data.splits:
            amount = (expense_data.amount * s.shares) / total_shares
            splits.append({
                "user_id": str(s.user_id),
                "amount": round(amount, 2),
                "shares": s.shares
            })
    
    # Create the expense
    expense_date = expense_data.expense_date.isoformat() if expense_data.expense_date else datetime.utcnow().isoformat()
    
    new_expense = db_service.create_expense(
        amount=expense_data.amount,
        description=expense_data.description,
        paid_by_id=current_user["id"],
        group_id=str(expense_data.group_id) if expense_data.group_id else None,
        split_type=expense_data.split_type.value,
        category=expense_data.category,
        currency=expense_data.currency,
        expense_date=expense_date,
        notes=expense_data.notes,
        splits=splits
    )
    
    # Send notifications to all participants (except the payer)
    for split in splits:
        if str(split["user_id"]) != str(current_user["id"]):
            try:
                create_expense_notification(
                    db_service=db_service,
                    to_user_id=split["user_id"],
                    from_user=current_user,
                    expense_id=new_expense["id"],
                    expense_description=expense_data.description,
                    amount=expense_data.amount,
                    user_share=split["amount"],
                    group_id=expense_data.group_id
                )
            except Exception as e:
                print(f"Failed to send notification: {e}")
    
    return _build_expense_response(db_service, new_expense["id"])


@router.get("/", response_model=List[ExpenseResponse])
async def list_expenses(
    group_id: Optional[int] = None,
    category: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user),
    db_service: DBService = Depends(get_db_service)
):
    """
    List expenses.
    """
    if group_id:
        # Verify membership
        if not db_service.is_group_member(str(group_id), current_user["id"]):
            raise HTTPException(status_code=403, detail="You are not a member of this group")
        
        expenses = db_service.get_group_expenses(str(group_id), skip=offset, limit=limit)
    else:
        expenses = db_service.get_user_expenses(current_user["id"], skip=offset, limit=limit)
    
    # Filter by category if specified
    if category:
        expenses = [e for e in expenses if e.get("category") == category]
    
    return [_build_expense_response_from_dict(db_service, e) for e in expenses]


# ===========================================
# BALANCE ROUTES - Must come BEFORE /{expense_id}
# ===========================================

@router.get("/balances/overall", response_model=List[BalanceResponse])
async def get_overall_balances(
    current_user: dict = Depends(get_current_user),
    db_service: DBService = Depends(get_db_service)
):
    """
    Get your overall balance with everyone.
    """
    balances = db_service.calculate_user_balances(current_user["id"])
    
    result = []
    for user_id, amount in balances.items():
        if abs(amount) > 0.01:
            user = db_service.get_user_by_id(str(user_id))
            if user:
                result.append(BalanceResponse(
                    user_id=user["id"],
                    user_name=user.get("name", "Unknown"),
                    user_email=user.get("email", ""),
                    amount=round(amount, 2)
                ))
    
    return result


@router.get("/balances/group/{group_id}", response_model=GroupBalanceResponse)
async def get_group_balances(
    group_id: int,
    current_user: dict = Depends(get_current_user),
    db_service: DBService = Depends(get_db_service)
):
    """
    Get your balance in a specific group.
    """
    # Verify membership
    if not db_service.is_group_member(str(group_id), current_user["id"]):
        raise HTTPException(status_code=403, detail="You are not a member of this group")
    
    group = db_service.get_group_by_id(str(group_id))
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Get group expenses
    expenses = db_service.get_group_expenses(str(group_id), limit=1000)
    
    # Calculate balances
    balances = {}
    total_expenses = 0
    your_paid = 0
    your_share = 0
    
    for expense in expenses:
        total_expenses += expense.get("amount", 0)
        
        if str(expense.get("paid_by_id")) == str(current_user["id"]):
            your_paid += expense.get("amount", 0)
            
            # Others owe you
            for split in expense.get("splits", []):
                if str(split.get("user_id")) != str(current_user["id"]):
                    split_user_id = str(split.get("user_id"))
                    if split_user_id not in balances:
                        balances[split_user_id] = 0
                    balances[split_user_id] += split.get("amount", 0)
        
        # Your share
        for split in expense.get("splits", []):
            if str(split.get("user_id")) == str(current_user["id"]):
                your_share += split.get("amount", 0)
                
                if str(expense.get("paid_by_id")) != str(current_user["id"]):
                    payer_id = str(expense.get("paid_by_id"))
                    if payer_id not in balances:
                        balances[payer_id] = 0
                    balances[payer_id] -= split.get("amount", 0)
    
    # Factor in settlements
    settlements = db_service.get_group_settlements(str(group_id))
    for settlement in settlements:
        from_user_id = str(settlement.get("from_user_id"))
        to_user_id = str(settlement.get("to_user_id"))
        amount = settlement.get("amount", 0)
        
        if from_user_id == str(current_user["id"]):
            if to_user_id not in balances:
                balances[to_user_id] = 0
            balances[to_user_id] += amount
        elif to_user_id == str(current_user["id"]):
            if from_user_id not in balances:
                balances[from_user_id] = 0
            balances[from_user_id] -= amount
    
    # Build balance responses
    balance_list = []
    for user_id, amount in balances.items():
        if abs(amount) > 0.01:
            user = db_service.get_user_by_id(str(user_id))
            if user:
                balance_list.append(BalanceResponse(
                    user_id=user["id"],
                    user_name=user.get("name", "Unknown"),
                    user_email=user.get("email", ""),
                    amount=round(amount, 2)
                ))
    
    return GroupBalanceResponse(
        group_id=group["id"],
        group_name=group.get("name", "Unknown"),
        total_expenses=round(total_expenses, 2),
        your_total_paid=round(your_paid, 2),
        your_total_share=round(your_share, 2),
        your_balance=round(your_paid - your_share, 2),
        balances=balance_list
    )


@router.post("/settle", status_code=status.HTTP_200_OK)
async def record_settlement(
    settlement: SettlementCreate,
    current_user: dict = Depends(get_current_user),
    db_service: DBService = Depends(get_db_service)
):
    """
    Record a settlement payment (legacy endpoint - use /api/settlements instead).
    """
    to_user = db_service.get_user_by_id(str(settlement.to_user_id))
    if not to_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "message": f"Settlement of ₹{settlement.amount} to {to_user.get('name', 'Unknown')} recorded",
        "settlement": {
            "from": current_user.get("name", "Unknown"),
            "to": to_user.get("name", "Unknown"),
            "amount": settlement.amount,
            "notes": settlement.notes
        }
    }


# ===========================================
# INDIVIDUAL EXPENSE ROUTES
# ===========================================

@router.get("/{expense_id}", response_model=ExpenseResponse)
async def get_expense(
    expense_id: str,
    current_user: dict = Depends(get_current_user),
    db_service: DBService = Depends(get_db_service)
):
    """
    Get details of a specific expense.
    """
    expense = db_service.get_expense_by_id(str(expense_id))
    
    if not expense or not expense.get("is_active", True):
        raise HTTPException(status_code=404, detail="Expense not found")
    
    # Check if user is involved
    is_payer = str(expense.get("paid_by_id")) == str(current_user["id"])
    is_in_split = any(
        str(s.get("user_id")) == str(current_user["id"]) 
        for s in expense.get("splits", [])
    )
    
    if not is_payer and not is_in_split:
        raise HTTPException(status_code=403, detail="You are not involved in this expense")
    
    return _build_expense_response_from_dict(db_service, expense)


@router.put("/{expense_id}", response_model=ExpenseResponse)
async def update_expense(
    expense_id: str,
    expense_data: ExpenseUpdate,
    current_user: dict = Depends(get_current_user),
    db_service: DBService = Depends(get_db_service)
):
    """
    Update an expense.
    """
    expense = db_service.get_expense_by_id(str(expense_id))
    
    if not expense or not expense.get("is_active", True):
        raise HTTPException(status_code=404, detail="Expense not found")
    
    if str(expense.get("paid_by_id")) != str(current_user["id"]):
        raise HTTPException(status_code=403, detail="Only the payer can update this expense")
    
    # Update basic fields
    update_fields = {}
    if expense_data.description is not None:
        update_fields["description"] = expense_data.description
    if expense_data.notes is not None:
        update_fields["notes"] = expense_data.notes
    if expense_data.category is not None:
        update_fields["category"] = expense_data.category
    if expense_data.expense_date is not None:
        update_fields["expense_date"] = expense_data.expense_date.isoformat()
    if expense_data.amount is not None:
        update_fields["amount"] = expense_data.amount
    
    if update_fields:
        db_service.update_expense(str(expense_id), **update_fields)
    
    # Handle splits update
    splits_changed = False
    new_amount = expense_data.amount if expense_data.amount is not None else expense.get("amount", 0)
    
    if expense_data.split_type is not None or expense_data.split_with_user_ids is not None or expense_data.splits is not None:
        splits_changed = True
        
        # Delete existing splits
        db_service.delete_expense_splits(str(expense_id))
        
        split_type = expense_data.split_type.value if expense_data.split_type else expense.get("split_type", "equal")
        db_service.update_expense(str(expense_id), split_type=split_type)
        
        if split_type == "equal" and expense_data.split_with_user_ids is not None:
            user_ids = list(set(str(uid) for uid in expense_data.split_with_user_ids))
            if len(user_ids) == 0:
                raise HTTPException(status_code=400, detail="At least one user must be selected for split")
            
            per_person = new_amount / len(user_ids)
            
            for user_id in user_ids:
                db_service.create_expense_split(
                    expense_id=str(expense_id),
                    user_id=str(user_id),
                    amount=round(per_person, 2)
                )
        
        elif split_type == "exact" and expense_data.splits is not None:
            for s in expense_data.splits:
                db_service.create_expense_split(
                    expense_id=str(expense_id),
                    user_id=str(s.user_id),
                    amount=s.amount
                )
    
    # Send notifications
    if splits_changed or expense_data.amount is not None:
        updated_expense = db_service.get_expense_by_id(str(expense_id))
        for split in updated_expense.get("splits", []):
            if str(split.get("user_id")) != str(current_user["id"]):
                try:
                    create_expense_update_notification(
                        db_service=db_service,
                        to_user_id=split.get("user_id"),
                        from_user=current_user,
                        expense_id=expense_id,
                        expense_description=updated_expense.get("description", ""),
                        new_amount=updated_expense.get("amount", 0),
                        user_share=split.get("amount", 0),
                        group_id=updated_expense.get("group_id")
                    )
                except Exception as e:
                    print(f"Failed to send notification: {e}")
    
    return _build_expense_response(db_service, str(expense_id))


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_expense(
    expense_id: str,
    current_user: dict = Depends(get_current_user),
    db_service: DBService = Depends(get_db_service)
):
    """
    Delete (deactivate) an expense.
    """
    expense = db_service.get_expense_by_id(str(expense_id))
    
    if not expense or not expense.get("is_active", True):
        raise HTTPException(status_code=404, detail="Expense not found")
    
    if str(expense.get("paid_by_id")) != str(current_user["id"]):
        raise HTTPException(status_code=403, detail="Only the payer can delete this expense")
    
    db_service.delete_expense(str(expense_id))


def _build_expense_response(db_service: DBService, expense_id: str) -> ExpenseResponse:
    """Helper to build ExpenseResponse by fetching expense."""
    expense = db_service.get_expense_by_id(str(expense_id))
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    return _build_expense_response_from_dict(db_service, expense)


def _build_expense_response_from_dict(db_service: DBService, expense: dict) -> ExpenseResponse:
    """Helper to build ExpenseResponse from expense dict."""
    paid_by_user = expense.get("paid_by_user") or db_service.get_user_by_id(str(expense.get("paid_by_id")))
    paid_by_name = paid_by_user.get("name", "Unknown") if paid_by_user else "Unknown"
    
    group_name = None
    if expense.get("group_id"):
        group = db_service.get_group_by_id(str(expense["group_id"]))
        if group:
            group_name = group.get("name")
    
    split_responses = []
    for s in expense.get("splits", []):
        user = s.get("user") or db_service.get_user_by_id(str(s.get("user_id")))
        if user:
            split_responses.append(ExpenseSplitResponse(
                id=s.get("id", 0) or s.get("expense_id", 0),
                user_id=user["id"],
                user_name=user.get("name", "Unknown"),
                user_email=user.get("email", ""),
                amount=s.get("amount", 0),
                percentage=s.get("percentage"),
                shares=s.get("shares"),
                is_paid=s.get("is_paid", False)
            ))
    
    return ExpenseResponse(
        id=expense["id"],
        amount=expense.get("amount", 0),
        currency=expense.get("currency", "INR"),
        description=expense.get("description", ""),
        notes=expense.get("notes"),
        category=expense.get("category", "other"),
        paid_by_id=expense["paid_by_id"],
        paid_by_name=paid_by_name,
        group_id=expense.get("group_id"),
        group_name=group_name,
        split_type=expense.get("split_type", "equal"),
        expense_date=expense.get("expense_date"),
        is_settled=expense.get("is_settled", False),
        created_at=expense.get("created_at"),
        splits=split_responses
    )
