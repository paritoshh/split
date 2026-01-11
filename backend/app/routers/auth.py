"""
===========================================
AUTHENTICATION ROUTER
===========================================
API endpoints for:
- User registration (with email + password, Cognito handles verification)
- User login (email + password)
- Email verification confirmation
- Get current user profile
- Update user profile
- Password reset (forgot password)

All endpoints are prefixed with /api/auth

Uses AWS Cognito for all authentication.
===========================================
"""

from fastapi import APIRouter, Depends, HTTPException, status
from typing import List

from app.db import get_db_service, DBService
from app.schemas.user import (
    UserCreate, UserResponse, Token, UserUpdate, UserLogin
)
from app.services.auth import get_current_user
from app.services.cognito_service import get_cognito_service

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
    Register a new user in Cognito.
    Creates user in Cognito (email verification required).
    Creates user record in database.
    Returns user data (email not verified yet).
    """
    import logging
    logger = logging.getLogger(__name__)
    
    # Try to create in Cognito first (Cognito is source of truth)
    # If email already exists, Cognito will throw UsernameExistsException
    cognito_result = None
    user_already_in_cognito = False
    
    try:
        cognito_service = get_cognito_service()
        cognito_result = cognito_service.register_user(
            email=user_data.email,
            password=user_data.password,
            name=user_data.name,
            mobile=user_data.mobile  # Optional, hidden from UI
        )
        logger.info(f"Successfully created user {user_data.email} in Cognito")
    except HTTPException as e:
        # If Cognito says user exists, check if it's a duplicate registration
        if e.status_code == status.HTTP_400_BAD_REQUEST and ("already registered" in e.detail.lower() or "username exists" in e.detail.lower()):
            logger.info(f"User {user_data.email} already exists in Cognito")
            user_already_in_cognito = True
            
            # Check if user exists in our database
            existing_user = db_service.get_user_by_email(user_data.email)
            if existing_user:
                logger.info(f"User {user_data.email} exists in both Cognito and DynamoDB - tell user to login")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email address already registered. Please try logging in instead."
                )
            else:
                # User exists in Cognito but not in DynamoDB
                # This can happen if previous registration created Cognito user but DB creation failed
                # We'll create the DynamoDB record now to sync them
                logger.warning(f"User {user_data.email} exists in Cognito but not in DynamoDB. Creating DynamoDB record to sync...")
                # We'll create the DB record below, but we don't have cognito_result['user_sub']
                # We'll need to get it from Cognito or leave it null (will be updated on login)
                cognito_result = {'user_sub': None, 'code_delivery_details': None, 'user_confirmed': False}
        else:
            # Re-raise other HTTP exceptions
            raise e
    
    # Cognito registration succeeded OR user already exists in Cognito - now create/update in database
    # Check if user already exists in database (might have been created in a previous attempt)
    existing_user = db_service.get_user_by_email(user_data.email)
    if existing_user:
        # User exists in DB - update with Cognito sub if missing
        try:
            if cognito_result and cognito_result.get('user_sub') and not existing_user.get("cognito_sub"):
                db_service.update_user(existing_user["id"], cognito_sub=cognito_result['user_sub'])
                logger.info(f"Updated existing user {user_data.mobile} with Cognito sub")
            elif user_already_in_cognito:
                logger.info(f"User {user_data.mobile} exists in both Cognito and DynamoDB")
            return UserResponse(
                id=existing_user["id"],
                email=existing_user.get("email") or user_data.email,
                mobile=existing_user.get("mobile"),
                name=existing_user["name"],
                is_active=existing_user.get("is_active", True),
                email_verified=existing_user.get("email_verified", False),  # User needs to verify via Cognito
                mobile_verified=existing_user.get("mobile_verified", False),
                created_at=existing_user.get("created_at")
            )
        except Exception as e:
            logger.error(f"Failed to update existing user: {e}")
            # Continue to create new user record
    
    # Create new user in database
    # Note: email_verified will be False until user confirms via Cognito
    try:
        # Use email-based signature (DynamoDB)
        new_user = db_service.create_user(
            email=user_data.email,
            name=user_data.name,
            hashed_password="",  # Not used with Cognito
            mobile=user_data.mobile,  # Optional, hidden from UI
            email_verified=False
        )
        logger.info(f"Successfully created user {user_data.email} in DynamoDB")
    except Exception as e:
        # If DB creation fails, log the error and raise it (don't silently fail)
        logger.error(f"Failed to create user in database: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"User created in Cognito but failed to create database record. Please contact support. Error: {str(e)}"
        )
    
    # Update with Cognito sub if possible
    if cognito_result and cognito_result.get('user_sub'):
        try:
            db_service.update_user(new_user["id"], cognito_sub=cognito_result['user_sub'])
            logger.info(f"Updated user {user_data.email} with Cognito sub: {cognito_result['user_sub']}")
        except Exception as e:
            logger.warning(f"Failed to update user with Cognito sub: {e}")
            # Don't fail - user is created, sub will be updated on first login
    
    return UserResponse(
        id=new_user["id"],
        email=new_user.get("email") or user_data.email,
        mobile=new_user.get("mobile"),
        name=new_user["name"],
        is_active=new_user.get("is_active", True),
        email_verified=new_user.get("email_verified", False),  # User needs to verify via Cognito
        mobile_verified=new_user.get("mobile_verified", False),
        created_at=new_user.get("created_at")
    )


@router.post("/confirm-signup", response_model=dict)
async def confirm_signup(
    email: str,
    confirmation_code: str
):
    """
    Confirm user signup with verification code from Cognito.
    Verifies email address.
    """
    try:
        cognito_service = get_cognito_service()
        cognito_service.confirm_signup(email, confirmation_code)
        
        # Update user in database to mark email as verified
        from app.db import get_db_service
        db_service = get_db_service()
        user = db_service.get_user_by_email(email)
        if user:
            db_service.update_user(user["id"], email_verified=True)
        
        return {"message": "Email verified successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Confirmation failed: {str(e)}"
        )


@router.post("/resend-confirmation", response_model=dict)
async def resend_confirmation(email: str):
    """
    Resend confirmation code to user's email.
    """
    try:
        cognito_service = get_cognito_service()
        cognito_service.resend_confirmation_code(email)
        return {"message": "Confirmation code sent successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to resend code: {str(e)}"
        )


@router.post("/login", response_model=Token)
async def login(login_data: UserLogin):
    """
    Login with email and password.
    Authenticates via Cognito and returns tokens.
    """
    try:
        cognito_service = get_cognito_service()
        tokens = cognito_service.authenticate_user(login_data.email, login_data.password)
        
        # Return Cognito tokens
        # Note: We return access_token in the Token schema for compatibility
        # Frontend should use id_token for user info and access_token for API calls
        return {
            "access_token": tokens["access_token"],
            "id_token": tokens.get("id_token"),
            "refresh_token": tokens.get("refresh_token"),
            "token_type": tokens["token_type"],
            "expires_in": tokens["expires_in"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Login failed: {str(e)}"
        )


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: dict = Depends(get_current_user),
    db_service: DBService = Depends(get_db_service)
):
    """
    Get current logged-in user's profile.
    """
    return UserResponse(
        id=current_user["id"],
        mobile=current_user.get("mobile"),
        email=current_user.get("email"),
        name=current_user["name"],
        is_active=current_user.get("is_active", True),
        mobile_verified=current_user.get("mobile_verified", False),
        email_verified=current_user.get("email_verified", False),
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
    Updates attributes in Cognito and user record in database.
    """
    update_fields = {}
    
    if user_data.name is not None:
        update_fields["name"] = user_data.name
    
    if user_data.email is not None:
        update_fields["email"] = user_data.email
        # Email verification will be handled separately if needed
    
    # Update database
    if update_fields:
        updated_user = db_service.update_user(current_user["id"], **update_fields)
    else:
        updated_user = current_user
    
    # TODO: Update Cognito attributes if needed
    # This would require passing the access token through context
    
    return UserResponse(
        id=updated_user["id"],
        mobile=updated_user.get("mobile"),
        email=updated_user.get("email"),
        name=updated_user["name"],
        is_active=updated_user.get("is_active", True),
        mobile_verified=updated_user.get("mobile_verified", False),
        email_verified=updated_user.get("email_verified", False),
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
            mobile_verified=u.get("mobile_verified", False),
            email_verified=u.get("email_verified", False),
            created_at=u.get("created_at")
        )
        for u in users
    ]


@router.post("/forgot-password", response_model=dict)
async def forgot_password(email: str):
    """
    Initiate forgot password flow.
    """
    try:
        cognito_service = get_cognito_service()
        cognito_service.forgot_password(email)
        return {"message": "Password reset code sent to email"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initiate password reset: {str(e)}"
        )


@router.post("/confirm-forgot-password", response_model=dict)
async def confirm_forgot_password(
    email: str,
    confirmation_code: str,
    new_password: str
):
    """
    Confirm forgot password with verification code.
    """
    try:
        cognito_service = get_cognito_service()
        cognito_service.confirm_forgot_password(email, confirmation_code, new_password)
        return {"message": "Password reset successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reset password: {str(e)}"
        )
