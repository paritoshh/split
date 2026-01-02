"""
===========================================
SETTLEMENTS ROUTER
===========================================
API endpoints for:
- Record settlements (mark as paid)
- Get settlement history
- Generate UPI payment links

Supports both SQLite and DynamoDB backends.
All endpoints require authentication.
===========================================
"""

from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from urllib.parse import quote

from app.db import get_db_service, DBService
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
    current_user: dict = Depends(get_current_user),
    db_service: DBService = Depends(get_db_service)
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
    from_user_id = str(settlement_data.from_user_id) if settlement_data.from_user_id else current_user["id"]
    
    # Verify the payer exists (if not current user)
    if str(from_user_id) != str(current_user["id"]):
        from_user = db_service.get_user_by_id(str(from_user_id))
        if not from_user:
            raise HTTPException(status_code=404, detail="Payer user not found")
    else:
        from_user = current_user
    
    # Verify the recipient exists
    to_user = db_service.get_user_by_id(str(settlement_data.to_user_id))
    if not to_user:
        raise HTTPException(status_code=404, detail="Recipient user not found")
    
    # Can't settle with yourself
    if str(from_user_id) == str(settlement_data.to_user_id):
        raise HTTPException(status_code=400, detail="Cannot settle with yourself")
    
    # Verify current user is involved in the settlement
    if str(current_user["id"]) != str(from_user_id) and str(current_user["id"]) != str(settlement_data.to_user_id):
        raise HTTPException(status_code=403, detail="You can only record settlements you are involved in")
    
    # Create settlement record
    settlement = db_service.create_settlement(
        from_user_id=str(from_user_id),
        to_user_id=str(settlement_data.to_user_id),
        amount=settlement_data.amount,
        group_id=str(settlement_data.group_id) if settlement_data.group_id else None,
        payment_method=settlement_data.payment_method,
        transaction_ref=settlement_data.transaction_ref,
        notes=settlement_data.notes
    )
    
    # Send notification to the other party
    try:
        notify_user_id = to_user["id"] if str(current_user["id"]) == str(from_user_id) else from_user_id
        create_settlement_notification(
            db_service=db_service,
            to_user_id=notify_user_id,
            from_user=from_user,
            amount=settlement_data.amount,
            group_id=settlement_data.group_id
        )
    except Exception as e:
        print(f"Failed to send settlement notification: {e}")
    
    # Get group name if applicable
    group_name = None
    if settlement.get("group_id"):
        group = db_service.get_group_by_id(str(settlement["group_id"]))
        if group:
            group_name = group.get("name")
    
    return SettlementResponse(
        id=settlement["id"],
        from_user_id=from_user["id"],
        from_user_name=from_user.get("name", "Unknown"),
        to_user_id=to_user["id"],
        to_user_name=to_user.get("name", "Unknown"),
        amount=settlement.get("amount", 0),
        group_id=settlement.get("group_id"),
        group_name=group_name,
        payment_method=settlement.get("payment_method", "other"),
        transaction_ref=settlement.get("transaction_ref"),
        notes=settlement.get("notes"),
        created_at=settlement.get("created_at")
    )


@router.get("/", response_model=List[SettlementResponse])
async def list_settlements(
    group_id: Optional[str] = None,
    limit: int = 50,
    current_user: dict = Depends(get_current_user),
    db_service: DBService = Depends(get_db_service)
):
    """
    List all settlements involving the current user.
    
    **Query Parameters:**
    - group_id: Filter by group (optional)
    - limit: Max results (default 50)
    """
    if group_id:
        settlements = db_service.get_group_settlements(str(group_id))
        # Filter to only include current user's settlements
        settlements = [
            s for s in settlements 
            if str(s.get("from_user_id")) == str(current_user["id"]) or 
               str(s.get("to_user_id")) == str(current_user["id"])
        ]
    else:
        settlements = db_service.get_user_settlements(current_user["id"])
    
    # Limit results
    settlements = settlements[:limit]
    
    result = []
    for s in settlements:
        from_user = s.get("from_user") or db_service.get_user_by_id(str(s.get("from_user_id")))
        to_user = s.get("to_user") or db_service.get_user_by_id(str(s.get("to_user_id")))
        
        group_name = None
        if s.get("group_id"):
            group = db_service.get_group_by_id(str(s["group_id"]))
            if group:
                group_name = group.get("name")
        
        result.append(SettlementResponse(
            id=s["id"],
            from_user_id=s["from_user_id"],
            from_user_name=from_user.get("name", "Unknown") if from_user else "Unknown",
            to_user_id=s["to_user_id"],
            to_user_name=to_user.get("name", "Unknown") if to_user else "Unknown",
            amount=s.get("amount", 0),
            group_id=s.get("group_id"),
            group_name=group_name,
            payment_method=s.get("payment_method", "other"),
            transaction_ref=s.get("transaction_ref"),
            notes=s.get("notes"),
            created_at=s.get("created_at")
        ))
    
    return result


@router.get("/upi-link/{user_id}", response_model=UPIPaymentInfo)
async def generate_upi_link(
    user_id: str,
    amount: float,
    group_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db_service: DBService = Depends(get_db_service)
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
    payee = db_service.get_user_by_id(str(user_id))
    if not payee:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Determine payment address (pa parameter)
    # Best Practice: Use UPI ID format (username@bank) when available
    # - Shows banking name in GPay
    # - More reliable across all UPI apps
    # - Falls back to phone@upi only if UPI ID is not available
    # 
    # Note: "Could not load banking name" warning with phone@upi is a GPay limitation
    # and doesn't prevent payment - it's just informational
    payment_address = None
    payee_upi_id_display = None
    
    # Prefer UPI ID format (username@bank) - this is the standard and shows banking name
    if payee.get("upi_id"):
        payment_address = payee["upi_id"]
        payee_upi_id_display = payment_address
    # Fallback to phone number format only if UPI ID is not available
    elif payee.get("phone"):
        # Remove any non-digit characters from phone
        phone_clean = ''.join(c for c in payee["phone"] if c.isdigit())
        if len(phone_clean) == 10:  # Valid Indian mobile number
            payment_address = f"{phone_clean}@upi"
            payee_upi_id_display = payment_address
        else:
            raise HTTPException(
                status_code=400, 
                detail=f"{payee.get('name', 'User')} has an invalid phone number. Please add a valid UPI ID or phone number."
            )
    else:
        raise HTTPException(
            status_code=400, 
            detail=f"{payee.get('name', 'User')} hasn't added their UPI ID or phone number. Ask them to update their profile."
        )
    
    # Build transaction note
    note = f"Hisab settlement from {current_user.get('name', 'User')}"
    if group_id:
        group = db_service.get_group_by_id(str(group_id))
        if group:
            note = f"Hisab: {group.get('name')} settlement"
    
    # Clean name for UPI links - remove special characters that might cause issues
    # Some UPI apps (especially GPay) have issues with special characters
    payee_name = payee.get('name', 'User')
    clean_name = ''.join(c for c in payee_name if c.isalnum() or c.isspace()).strip()[:50]
    if not clean_name:
        clean_name = 'User'
    
    # Build UPI deep link
    # Use payment_address (phone@upi or UPI ID) for better GPay compatibility
    upi_link = (
        f"upi://pay?"
        f"pa={quote(payment_address)}&"
        f"pn={quote(clean_name)}&"
        f"am={amount}&"
        f"cu=INR&"
        f"tn={quote(note)}"
    )
    
    return UPIPaymentInfo(
        payee_upi_id=payee_upi_id_display or payment_address,  # Show original UPI ID if available, else the payment address
        payee_name=clean_name,  # Use cleaned name
        amount=amount,
        transaction_note=note,
        upi_link=upi_link
    )


@router.get("/user/{user_id}/upi-id")
async def get_user_upi_id(
    user_id: str,
    current_user: dict = Depends(get_current_user),
    db_service: DBService = Depends(get_db_service)
):
    """
    Get a user's UPI ID for payment.
    
    Returns whether they have a UPI ID set up.
    """
    user = db_service.get_user_by_id(str(user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "user_id": user["id"],
        "name": user.get("name", "Unknown"),
        "has_upi_id": bool(user.get("upi_id")),
        "upi_id": user.get("upi_id")
    }
