"""
===========================================
AUTHENTICATION ROUTER
===========================================
API endpoints for:
- User registration (signup)
- User login
- Get current user profile

All endpoints are prefixed with /api/auth
===========================================
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import timedelta
from typing import List

from app.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse, Token, UserUpdate
from app.services.auth import (
    get_password_hash,
    create_access_token,
    authenticate_user,
    get_current_user
)
from app.config import settings

# Create router with prefix and tags
# Tags are used to group endpoints in API docs
router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"]
)


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """
    Register a new user.
    
    **Request Body:**
    - email: Valid email address
    - name: Display name
    - password: At least 6 characters
    - phone: (optional) Phone number
    - upi_id: (optional) UPI ID for payments
    
    **Returns:** Created user info (without password)
    
    **Errors:**
    - 400: Email already registered
    """
    # Check if email already exists (case-insensitive)
    email_lower = user_data.email.lower()
    existing_user = db.query(User).filter(func.lower(User.email) == email_lower).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user (store email in lowercase)
    hashed_password = get_password_hash(user_data.password)
    
    new_user = User(
        email=email_lower,  # Store in lowercase
        name=user_data.name,
        phone=user_data.phone,
        upi_id=user_data.upi_id,
        hashed_password=hashed_password
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)  # Refresh to get the auto-generated ID
    
    return new_user


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """
    Login and get access token.
    
    **Request Body (form data):**
    - username: Email address (FastAPI uses 'username' for OAuth2)
    - password: Password
    
    **Returns:** JWT access token
    
    **Errors:**
    - 401: Invalid credentials
    
    **Usage:**
    After login, include the token in the Authorization header:
    `Authorization: Bearer <your_token>`
    """
    # Authenticate user
    user = authenticate_user(db, form_data.username, form_data.password)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create access token
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": user.email, "user_id": user.id},
        expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """
    Get current logged-in user's profile.
    
    **Requires:** Valid JWT token in Authorization header
    
    **Returns:** Current user's info
    """
    return current_user


@router.put("/me", response_model=UserResponse)
async def update_me(
    user_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update current user's profile.
    
    **Requires:** Valid JWT token
    
    **Request Body:** (all optional)
    - name: New display name
    - phone: New phone number
    - upi_id: New UPI ID
    
    **Returns:** Updated user info
    """
    # Update only provided fields
    if user_data.name is not None:
        current_user.name = user_data.name
    if user_data.phone is not None:
        current_user.phone = user_data.phone
    if user_data.upi_id is not None:
        current_user.upi_id = user_data.upi_id
    
    db.commit()
    db.refresh(current_user)
    
    return current_user


@router.get("/search", response_model=List[UserResponse])
async def search_users(
    q: str = Query(..., min_length=4, description="Search query (min 4 characters)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Search users by name or email.
    
    **Query Parameters:**
    - q: Search query (minimum 4 characters)
    
    **Returns:** List of matching users (max 10)
    
    **Example:**
    - GET /api/auth/search?q=paritosh
    - GET /api/auth/search?q=gmail
    """
    search_term = f"%{q.lower()}%"
    
    # Search by name or email (case-insensitive)
    users = db.query(User).filter(
        User.is_active == True,
        User.id != current_user.id,  # Exclude current user
        (func.lower(User.name).like(search_term) | func.lower(User.email).like(search_term))
    ).limit(10).all()
    
    return users

