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
    Creates user in Cognito (mobile verification required).
    Creates user record in database.
    Returns user data (mobile not verified yet).
    """
    import logging
    logger = logging.getLogger(__name__)
    
    # Try to create in Cognito first (Cognito is source of truth)
    # If mobile already exists, Cognito will throw UsernameExistsException
    try:
        cognito_service = get_cognito_service()
        cognito_result = cognito_service.register_user(
            mobile=user_data.mobile,
            password=user_data.password,
            name=user_data.name,
            email=user_data.email
        )
        logger.info(f"Successfully created user {user_data.mobile} in Cognito")
    except HTTPException as e:
        # If Cognito says user exists, check if it's a duplicate registration
        if e.status_code == status.HTTP_400_BAD_REQUEST and ("already registered" in e.detail.lower() or "username exists" in e.detail.lower()):
            logger.info(f"User {user_data.mobile} already exists in Cognito")
            
            # Check if user exists in our database
            existing_user = db_service.get_user_by_mobile(user_data.mobile)
            if existing_user:
                logger.info(f"User {user_data.mobile} exists in both Cognito and DynamoDB - tell user to login")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Mobile number already registered. Please try logging in instead."
                )
            else:
                # User exists in Cognito but not in DynamoDB
                # This can happen if previous registration created Cognito user but DB creation failed
                # Tell user to login - the DB record will be created on first login via get_current_user
                logger.warning(f"User {user_data.mobile} exists in Cognito but not in DynamoDB. User should login to sync.")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Mobile number already registered in Cognito. Please try logging in instead. If login fails, contact support."
                )
        else:
            # Re-raise other HTTP exceptions
            raise e
    
    # Cognito registration succeeded - now create/update in database
    # Check if user already exists in database (might have been created in a previous attempt)
    existing_user = db_service.get_user_by_mobile(user_data.mobile)
    if existing_user:
        # User exists in DB - update with Cognito sub if missing
        try:
            if cognito_result and cognito_result.get('user_sub') and not existing_user.get("cognito_sub"):
                db_service.update_user(existing_user["id"], cognito_sub=cognito_result['user_sub'])
                logger.info(f"Updated existing user {user_data.mobile} with Cognito sub")
            return UserResponse(
                id=existing_user["id"],
                mobile=existing_user.get("mobile") or user_data.mobile,
                email=existing_user.get("email"),
                name=existing_user["name"],
                is_active=existing_user.get("is_active", True),
                mobile_verified=False,  # User needs to verify via Cognito
                email_verified=existing_user.get("email_verified", False),
                created_at=existing_user.get("created_at")
            )
        except Exception as e:
            logger.error(f"Failed to update existing user: {e}")
            # Continue to create new user record
    
    # Create new user in database
    # Note: mobile_verified will be False until user confirms via Cognito
    try:
        # Try mobile-based signature (DynamoDB)
        new_user = db_service.create_user(
            mobile=user_data.mobile,
            name=user_data.name,
            hashed_password="",  # Not used with Cognito
            email=user_data.email,
            email_verified=False
        )
    except TypeError:
        # Fallback to email-based signature (SQLite) - shouldn't happen but handle it
        new_user = db_service.create_user(
            email=user_data.email or user_data.mobile,  # Use mobile as email if no email
            name=user_data.name,
            hashed_password="",  # Not used with Cognito
            phone=user_data.mobile
        )
    except Exception as e:
        # If DB creation fails, log but don't fail registration (user is in Cognito)
        logger.error(f"Failed to create user in database: {e}")
        # Return a minimal user response
        return UserResponse(
            id="",  # Will be set after DB creation
            mobile=user_data.mobile,
            email=user_data.email,
            name=user_data.name,
            is_active=True,
            mobile_verified=False,
            email_verified=False,
            created_at=None
        )
    
    # Update with Cognito sub if possible
    if cognito_result and cognito_result.get('user_sub'):
        try:
            db_service.update_user(new_user["id"], cognito_sub=cognito_result['user_sub'])
            logger.info(f"Updated user {user_data.mobile} with Cognito sub: {cognito_result['user_sub']}")
        except Exception as e:
            logger.warning(f"Failed to update user with Cognito sub: {e}")
            # Don't fail - user is created, sub will be updated on first login
    
    return UserResponse(
        id=new_user["id"],
        mobile=new_user.get("mobile") or user_data.mobile,
        email=new_user.get("email"),
        name=new_user["name"],
        is_active=new_user.get("is_active", True),
        mobile_verified=False,  # User needs to verify via Cognito
        email_verified=new_user.get("email_verified", False),
        created_at=new_user.get("created_at")
    )


@router.post("/confirm-signup", response_model=dict)
async def confirm_signup(
    mobile: str,
    confirmation_code: str
):
    """
    Confirm user signup with verification code from Cognito.
    Verifies mobile number.
    """
    try:
        cognito_service = get_cognito_service()
        cognito_service.confirm_signup(mobile, confirmation_code)
        
        # Update user in database to mark mobile as verified
        from app.db import get_db_service
        db_service = get_db_service()
        user = db_service.get_user_by_mobile(mobile)
        if user:
            db_service.update_user(user["id"], mobile_verified=True)
        
        return {"message": "Mobile verified successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Confirmation failed: {str(e)}"
        )


@router.post("/resend-confirmation", response_model=dict)
async def resend_confirmation(mobile: str):
    """
    Resend confirmation code to user's mobile.
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
    Login with mobile number and password.
    Authenticates via Cognito and returns tokens.
    """
    try:
        cognito_service = get_cognito_service()
        tokens = cognito_service.authenticate_user(login_data.mobile, login_data.password)
        
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
async def forgot_password(mobile: str):
    """
    Initiate forgot password flow.
    """
    try:
        cognito_service = get_cognito_service()
        cognito_service.forgot_password(mobile)
        return {"message": "Password reset code sent to mobile"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initiate password reset: {str(e)}"
        )


@router.post("/confirm-forgot-password", response_model=dict)
async def confirm_forgot_password(
    mobile: str,
    confirmation_code: str,
    new_password: str
):
    """
    Confirm forgot password with verification code.
    """
    try:
        cognito_service = get_cognito_service()
        cognito_service.confirm_forgot_password(mobile, confirmation_code, new_password)
        return {"message": "Password reset successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reset password: {str(e)}"
        )
