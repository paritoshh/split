"""
===========================================
AUTHENTICATION ROUTER
===========================================
API endpoints for:
- User registration (signup)
- User login
- Get current user profile

Supports both SQLite and DynamoDB backends.
All endpoints are prefixed with /api/auth
===========================================
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.security import OAuth2PasswordRequestForm
from datetime import timedelta
from typing import List

from app.db import get_db_service, DBService
from app.schemas.user import UserCreate, UserResponse, Token, UserUpdate
from app.services.auth import (
    get_password_hash,
    create_access_token,
    authenticate_user,
    get_current_user
)
from app.config import settings

router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"]
)


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserCreate, 
    db_service: DBService = Depends(get_db_service)
):
    """
    Register a new user.
    """
    # Check if email already exists
    existing_user = db_service.get_user_by_email(user_data.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    hashed_password = get_password_hash(user_data.password)
    
    new_user = db_service.create_user(
        email=user_data.email,
        name=user_data.name,
        hashed_password=hashed_password,
        phone=user_data.phone,
        upi_id=user_data.upi_id
    )
    
    return UserResponse(
        id=new_user["id"],
        email=new_user["email"],
        name=new_user["name"],
        phone=new_user.get("phone"),
        upi_id=new_user.get("upi_id"),
        is_active=new_user.get("is_active", True),
        created_at=new_user.get("created_at")
    )


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db_service: DBService = Depends(get_db_service)
):
    """
    Login and get access token.
    """
    user = authenticate_user(db_service, form_data.username, form_data.password)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create access token
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": user["email"], "user_id": user["id"]},
        expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """
    Get current logged-in user's profile.
    """
    import logging
    import sys
    logger = logging.getLogger(__name__)
    
    # Force log to stdout (CloudWatch)
    print(f"[ERROR] /auth/me called - Starting")
    sys.stdout.flush()
    
    try:
        print(f"[ERROR] /auth/me - current_user keys: {list(current_user.keys()) if current_user else 'None'}")
        sys.stdout.flush()
        
        logger.error(f"[ERROR] Getting user profile for user_id: {current_user.get('id')}")
        logger.error(f"[ERROR] Current user data: {current_user}")
        
        # Ensure all required fields are present
        user_data = {
            "id": current_user.get("id"),
            "email": current_user.get("email"),
            "name": current_user.get("name"),
            "phone": current_user.get("phone"),
            "upi_id": current_user.get("upi_id"),
            "is_active": current_user.get("is_active", True),
            "created_at": current_user.get("created_at")
        }
        
        print(f"[ERROR] /auth/me - user_data: {user_data}")
        sys.stdout.flush()
        
        # Validate required fields
        if not user_data["id"]:
            error_msg = "User missing 'id' field"
            print(f"[ERROR] {error_msg}")
            sys.stdout.flush()
            logger.error(f"[ERROR] {error_msg}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="User data is missing required field: id"
            )
        if not user_data["email"]:
            error_msg = "User missing 'email' field"
            print(f"[ERROR] {error_msg}")
            sys.stdout.flush()
            logger.error(f"[ERROR] {error_msg}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="User data is missing required field: email"
            )
        if not user_data["name"]:
            error_msg = "User missing 'name' field"
            print(f"[ERROR] {error_msg}")
            sys.stdout.flush()
            logger.error(f"[ERROR] {error_msg}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="User data is missing required field: name"
            )
        
        print(f"[ERROR] /auth/me - Creating UserResponse")
        sys.stdout.flush()
        result = UserResponse(**user_data)
        print(f"[ERROR] /auth/me - Success")
        sys.stdout.flush()
        return result
    except HTTPException:
        print(f"[ERROR] /auth/me - HTTPException raised")
        sys.stdout.flush()
        raise
    except Exception as e:
        error_msg = f"Error in /auth/me: {str(e)}"
        print(f"[ERROR] {error_msg}")
        print(f"[ERROR] Current user data: {current_user}")
        import traceback
        print(f"[ERROR] Traceback: {traceback.format_exc()}")
        sys.stdout.flush()
        logger.error(f"[ERROR] {error_msg}")
        logger.error(f"[ERROR] Current user data: {current_user}")
        logger.error(f"[ERROR] Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get user profile: {str(e)}"
        )


@router.put("/me", response_model=UserResponse)
async def update_me(
    user_data: UserUpdate,
    current_user: dict = Depends(get_current_user),
    db_service: DBService = Depends(get_db_service)
):
    """
    Update current user's profile.
    """
    update_fields = {}
    if user_data.name is not None:
        update_fields["name"] = user_data.name
    if user_data.phone is not None:
        update_fields["phone"] = user_data.phone
    if user_data.upi_id is not None:
        update_fields["upi_id"] = user_data.upi_id
    
    if update_fields:
        updated_user = db_service.update_user(current_user["id"], **update_fields)
    else:
        updated_user = current_user
    
    return UserResponse(
        id=updated_user["id"],
        email=updated_user["email"],
        name=updated_user["name"],
        phone=updated_user.get("phone"),
        upi_id=updated_user.get("upi_id"),
        is_active=updated_user.get("is_active", True),
        created_at=updated_user.get("created_at")
    )


@router.get("/search", response_model=List[UserResponse])
async def search_users(
    q: str = Query(..., min_length=4, description="Search query (min 4 characters)"),
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
            email=u["email"],
            name=u["name"],
            phone=u.get("phone"),
            upi_id=u.get("upi_id"),
            is_active=u.get("is_active", True),
            created_at=u.get("created_at")
        )
        for u in users
    ]
