"""
===========================================
SETTLEMENTS ROUTER
===========================================
API endpoints for:
- Record settlements (mark as paid)
- Get settlement history
- Generate UPI payment links

All endpoints require authentication.
===========================================
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from typing import List, Optional
from urllib.parse import quote

from app.database import get_db
from app.models.user import User
from app.models.group import Group
from app.models.settlement import Settlement
from app.services.auth import get_current_user
from app.services.notification import create_settlement_notification
from app.schemas.settlement import SettlementCreate, SettlementResponse, UPIPaymentInfo

router = APIRouter(
    prefix="/api/settlements",
    tags=["Settlements"]
)


@router.post("/", response_model=SettlementResponse, status_code=status.HTTP_201_CREATED)
async def record_settlement(
    settlement_data: SettlementCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Record a settlement payment.
    
    This doesn't transfer money - it records that you've settled up
    after paying via GPay/PhonePe/Cash/etc.
    
    **Request Body:**
    - to_user_id: Who is receiving the payment
    - from_user_id: (optional) Who paid - defaults to current user
    - amount: How much was paid
    - group_id: (optional) Settle within a specific group
    - payment_method: upi, cash, bank_transfer, other
    - transaction_ref: (optional) UPI transaction ID
    - notes: (optional) Any notes
    """
    # Determine the payer (from_user)
    # If from_user_id is provided and different from current user, 
    # it means current user is recording that someone paid them
    from_user_id = settlement_data.from_user_id or current_user.id
    
    # Verify the payer exists (if not current user)
    if from_user_id != current_user.id:
        from_user = db.query(User).filter(User.id == from_user_id).first()
        if not from_user:
            raise HTTPException(status_code=404, detail="Payer user not found")
    else:
        from_user = current_user
    
    # Verify the recipient exists
    to_user = db.query(User).filter(User.id == settlement_data.to_user_id).first()
    if not to_user:
        raise HTTPException(status_code=404, detail="Recipient user not found")
    
    # Can't settle with yourself
    if from_user_id == settlement_data.to_user_id:
        raise HTTPException(status_code=400, detail="Cannot settle with yourself")
    
    # Verify current user is involved in the settlement
    if current_user.id != from_user_id and current_user.id != settlement_data.to_user_id:
        raise HTTPException(status_code=403, detail="You can only record settlements you are involved in")
    
    # Create settlement record
    settlement = Settlement(
        from_user_id=from_user_id,
        to_user_id=settlement_data.to_user_id,
        amount=settlement_data.amount,
        group_id=settlement_data.group_id,
        payment_method=settlement_data.payment_method,
        transaction_ref=settlement_data.transaction_ref,
        notes=settlement_data.notes
    )
    
    db.add(settlement)
    db.commit()
    db.refresh(settlement)
    
    # Send notification to the other party (not the current user)
    try:
        # Notify the other person involved in the settlement
        notify_user_id = to_user.id if current_user.id == from_user_id else from_user_id
        create_settlement_notification(
            db=db,
            to_user_id=notify_user_id,
            from_user=from_user,
            amount=settlement_data.amount,
            group_id=settlement_data.group_id
        )
    except Exception as e:
        print(f"Failed to send settlement notification: {e}")
    
    # Build response
    group_name = None
    if settlement.group_id:
        group = db.query(Group).filter(Group.id == settlement.group_id).first()
        if group:
            group_name = group.name
    
    return SettlementResponse(
        id=settlement.id,
        from_user_id=from_user_id,
        from_user_name=from_user.name,
        to_user_id=to_user.id,
        to_user_name=to_user.name,
        amount=settlement.amount,
        group_id=settlement.group_id,
        group_name=group_name,
        payment_method=settlement.payment_method,
        transaction_ref=settlement.transaction_ref,
        notes=settlement.notes,
        created_at=settlement.created_at
    )


@router.get("/", response_model=List[SettlementResponse])
async def list_settlements(
    group_id: Optional[int] = None,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all settlements involving the current user.
    
    **Query Parameters:**
    - group_id: Filter by group (optional)
    - limit: Max results (default 50)
    """
    query = db.query(Settlement).filter(
        Settlement.is_active == True,
        or_(
            Settlement.from_user_id == current_user.id,
            Settlement.to_user_id == current_user.id
        )
    )
    
    if group_id:
        query = query.filter(Settlement.group_id == group_id)
    
    settlements = query.order_by(Settlement.created_at.desc()).limit(limit).all()
    
    result = []
    for s in settlements:
        from_user = db.query(User).filter(User.id == s.from_user_id).first()
        to_user = db.query(User).filter(User.id == s.to_user_id).first()
        
        group_name = None
        if s.group_id:
            group = db.query(Group).filter(Group.id == s.group_id).first()
            if group:
                group_name = group.name
        
        result.append(SettlementResponse(
            id=s.id,
            from_user_id=s.from_user_id,
            from_user_name=from_user.name if from_user else "Unknown",
            to_user_id=s.to_user_id,
            to_user_name=to_user.name if to_user else "Unknown",
            amount=s.amount,
            group_id=s.group_id,
            group_name=group_name,
            payment_method=s.payment_method,
            transaction_ref=s.transaction_ref,
            notes=s.notes,
            created_at=s.created_at
        ))
    
    return result


@router.get("/upi-link/{user_id}", response_model=UPIPaymentInfo)
async def generate_upi_link(
    user_id: int,
    amount: float,
    group_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate a UPI payment link for settling up.
    
    **Path Parameters:**
    - user_id: ID of the person you want to pay
    
    **Query Parameters:**
    - amount: How much to pay
    - group_id: (optional) Group context for the payment note
    
    **Returns:** UPI link that opens GPay/PhonePe/Paytm
    """
    # Get the payee
    payee = db.query(User).filter(User.id == user_id).first()
    if not payee:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if payee has UPI ID
    if not payee.upi_id:
        raise HTTPException(
            status_code=400, 
            detail=f"{payee.name} hasn't added their UPI ID yet. Ask them to update their profile."
        )
    
    # Build transaction note
    note = f"Hisab settlement from {current_user.name}"
    if group_id:
        group = db.query(Group).filter(Group.id == group_id).first()
        if group:
            note = f"Hisab: {group.name} settlement"
    
    # Build UPI deep link
    # Format: upi://pay?pa=UPI_ID&pn=NAME&am=AMOUNT&cu=INR&tn=NOTE
    upi_link = (
        f"upi://pay?"
        f"pa={quote(payee.upi_id)}&"
        f"pn={quote(payee.name)}&"
        f"am={amount}&"
        f"cu=INR&"
        f"tn={quote(note)}"
    )
    
    return UPIPaymentInfo(
        payee_upi_id=payee.upi_id,
        payee_name=payee.name,
        amount=amount,
        transaction_note=note,
        upi_link=upi_link
    )


@router.get("/user/{user_id}/upi-id")
async def get_user_upi_id(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a user's UPI ID for payment.
    
    Returns whether they have a UPI ID set up.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "user_id": user.id,
        "name": user.name,
        "has_upi_id": bool(user.upi_id),
        "upi_id": user.upi_id  # Will be None if not set
    }

