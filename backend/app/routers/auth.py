"""
===========================================
AUTHENTICATION ROUTER
===========================================
API endpoints for:
- OTP sending and verification
- User registration (with mobile + OTP)
- User login (mobile + password)
- Email verification
- Mobile number update
- Get current user profile
- Update user profile

All endpoints are prefixed with /api/auth
===========================================
"""

from fastapi import APIRouter, Depends, HTTPException, status
from datetime import timedelta
from typing import List

from app.db import get_db_service, DBService
from app.schemas.user import (
    UserCreate, UserResponse, Token, UserUpdate, UserLogin,
    SendOTPRequest, VerifyOTPRequest, VerifyOTPResponse,
    SendEmailVerificationRequest, VerifyEmailRequest, VerifyEmailResponse
)
from app.services.auth import (
    get_password_hash,
    create_access_token,
    authenticate_user,
    get_current_user
)
from app.services.otp_service import (
    generate_otp, check_rate_limit, store_otp, verify_otp, verify_otp_token
)
from app.services.sms_service import send_otp_sms
from app.services.email_verification_service import (
    generate_verification_code, store_verification_code, verify_email_code
)
from app.services.email_service import send_email_verification_code
from app.config import settings

router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"]
)


@router.post("/send-otp", response_model=dict)
async def send_otp(request: SendOTPRequest):
    """
    Send OTP to mobile number.
    Used for registration and mobile number updates.
    """
    # Check rate limit
    allowed, error_msg = check_rate_limit(request.mobile)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=error_msg
        )
    
    # Generate and store OTP
    otp = generate_otp()
    store_otp(request.mobile, otp)
    
    # Send SMS
    success, error_msg = send_otp_sms(request.mobile, otp)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_msg or "Failed to send OTP"
        )
    
    return {"message": "OTP sent successfully"}


@router.post("/verify-otp", response_model=VerifyOTPResponse)
async def verify_otp_endpoint(request: VerifyOTPRequest):
    """
    Verify OTP and get registration token.
    This token must be used within 10 minutes to complete registration.
    """
    is_valid, result = verify_otp(request.mobile, request.otp)
    
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result or "Invalid or expired OTP"
        )
    
    return VerifyOTPResponse(
        success=True,
        otp_token=result,
        message="OTP verified successfully"
    )


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserCreate, 
    db_service: DBService = Depends(get_db_service)
):
    """
    Register a new user.
    Requires OTP token from /api/auth/verify-otp.
    """
    # Verify OTP token
    if not verify_otp_token(user_data.mobile, user_data.otp_token):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP token. Please verify OTP again."
        )
    
    # Check if mobile already exists
    existing_user = db_service.get_user_by_mobile(user_data.mobile)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mobile number already registered"
        )
    
    # Check if email already exists (if provided)
    email_verified = False
    if user_data.email:
        existing_email_user = db_service.get_user_by_email(user_data.email)
        if existing_email_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        # Send email verification code if email provided
        verification_code = generate_verification_code()
        store_verification_code(user_data.email, verification_code)
        send_email_verification_code(user_data.email, verification_code)
        # Email will be verified later, so email_verified = False
    
    # Create new user
    hashed_password = get_password_hash(user_data.password)
    
    new_user = db_service.create_user(
        mobile=user_data.mobile,
        name=user_data.name,
        hashed_password=hashed_password,
        email=user_data.email,
        email_verified=email_verified
    )
    
    return UserResponse(
        id=new_user["id"],
        mobile=new_user["mobile"],
        email=new_user.get("email"),
        name=new_user["name"],
        is_active=new_user.get("is_active", True),
        email_verified=new_user.get("email_verified", False),
        mobile_verified=new_user.get("mobile_verified", True),
        created_at=new_user.get("created_at")
    )


@router.post("/login", response_model=Token)
async def login(
    login_data: UserLogin,
    db_service: DBService = Depends(get_db_service)
):
    """
    Login with mobile number and password.
    Returns JWT access token.
    """
    user = authenticate_user(db_service, login_data.mobile, login_data.password)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect mobile number or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create access token
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": user["mobile"], "user_id": user["id"]},
        expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/send-email-verification", response_model=dict)
async def send_email_verification(
    request: SendEmailVerificationRequest,
    current_user: dict = Depends(get_current_user),
    db_service: DBService = Depends(get_db_service)
):
    """
    Send email verification code.
    Can be called during registration (if email provided) or later from profile.
    """
    # Check if email belongs to current user or is being added
    if current_user.get("email") and current_user.get("email") != request.email.lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email does not match your account"
        )
    
    # Check if email is already verified
    if current_user.get("email_verified"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already verified"
        )
    
    # Generate and store verification code
    verification_code = generate_verification_code()
    store_verification_code(request.email, verification_code)
    
    # Send email
    success, error_msg = send_email_verification_code(request.email, verification_code)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_msg or "Failed to send verification email"
        )
    
    return {"message": "Verification code sent to email"}


@router.post("/verify-email", response_model=VerifyEmailResponse)
async def verify_email(
    request: VerifyEmailRequest,
    current_user: dict = Depends(get_current_user),
    db_service: DBService = Depends(get_db_service)
):
    """
    Verify email with verification code.
    """
    # Verify code
    is_valid, error_msg = verify_email_code(request.email, request.verification_code)
    
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg or "Invalid or expired verification code"
        )
    
    # Update user's email_verified status
    # Also update email if it's different from current
    update_data = {"email_verified": True}
    if current_user.get("email") != request.email.lower():
        update_data["email"] = request.email.lower()
    
    db_service.update_user(current_user["id"], **update_data)
    
    return VerifyEmailResponse(
        success=True,
        message="Email verified successfully"
    )


@router.post("/update-mobile", response_model=dict)
async def update_mobile(
    new_mobile: str,
    otp: str,
    current_user: dict = Depends(get_current_user),
    db_service: DBService = Depends(get_db_service)
):
    """
    Update mobile number. Requires OTP verification on new number.
    """
    # Verify OTP for new mobile
    is_valid, result = verify_otp(new_mobile, otp)
    
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result or "Invalid or expired OTP"
        )
    
    # Check if new mobile is already registered
    existing_user = db_service.get_user_by_mobile(new_mobile)
    if existing_user and existing_user["id"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mobile number already registered"
        )
    
    # Update mobile
    db_service.update_user(current_user["id"], mobile=new_mobile, mobile_verified=True)
    
    return {"message": "Mobile number updated successfully"}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """
    Get current logged-in user's profile.
    """
    return UserResponse(
        id=current_user["id"],
        mobile=current_user["mobile"],
        email=current_user.get("email"),
        name=current_user["name"],
        is_active=current_user.get("is_active", True),
        email_verified=current_user.get("email_verified", False),
        mobile_verified=current_user.get("mobile_verified", True),
        created_at=current_user.get("created_at")
    )


@router.put("/me", response_model=UserResponse)
async def update_me(
    user_data: UserUpdate,
    current_user: dict = Depends(get_current_user),
    db_service: DBService = Depends(get_db_service)
):
    """
    Update current user's profile.
    Note: Email can only be updated if not verified, or must be re-verified.
    """
    update_fields = {}
    
    if user_data.name is not None:
        update_fields["name"] = user_data.name
    
    if user_data.email is not None:
        # If email is already verified and user is changing it, require re-verification
        if current_user.get("email_verified") and current_user.get("email") != user_data.email.lower():
            # New email requires verification
            update_fields["email"] = user_data.email.lower()
            update_fields["email_verified"] = False
        elif not current_user.get("email_verified"):
            # Can update unverified email
            update_fields["email"] = user_data.email.lower()
        # If email is verified and same, no change needed
    
    if update_fields:
        updated_user = db_service.update_user(current_user["id"], **update_fields)
    else:
        updated_user = current_user
    
    return UserResponse(
        id=updated_user["id"],
        mobile=updated_user["mobile"],
        email=updated_user.get("email"),
        name=updated_user["name"],
        is_active=updated_user.get("is_active", True),
        email_verified=updated_user.get("email_verified", False),
        mobile_verified=updated_user.get("mobile_verified", True),
        created_at=updated_user.get("created_at")
    )


@router.get("/search", response_model=List[UserResponse])
async def search_users(
    q: str,
    current_user: dict = Depends(get_current_user),
    db_service: DBService = Depends(get_db_service)
):
    """
    Search users by name or email.
    """
    users = db_service.search_users(q, exclude_ids=[current_user["id"]])
    
    return [
        UserResponse(
            id=u["id"],
            mobile=u.get("mobile"),
            email=u.get("email"),
            name=u["name"],
            is_active=u.get("is_active", True),
            email_verified=u.get("email_verified", False),
            mobile_verified=u.get("mobile_verified", True),
            created_at=u.get("created_at")
        )
        for u in users
    ]
