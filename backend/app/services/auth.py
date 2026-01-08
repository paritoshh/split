"""
===========================================
AUTHENTICATION SERVICE
===========================================
Handles user authentication using AWS Cognito:
- Token verification
- Getting current logged-in user

All authentication is handled by AWS Cognito.
===========================================
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app.db import get_db_service, DBService
from app.services.cognito_service import get_cognito_service

# --- OAuth2 Setup ---
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db_service: DBService = Depends(get_db_service)
) -> dict:
    """
    Get the currently logged-in user from Cognito token.
    
    Returns a dict with user info (works with both SQLite and DynamoDB).
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        cognito_service = get_cognito_service()
        cognito_user = cognito_service.verify_token(token)
        
        # Extract mobile from Cognito user attributes (username is mobile)
        mobile = cognito_user['username']  # Username is mobile number
        email = cognito_user['attributes'].get('email')
        
        # Get user from database using mobile
        user = db_service.get_user_by_mobile(mobile)
        
        if user is None:
            # User exists in Cognito but not in our DB - create a basic record
            # This can happen if user was created directly in Cognito
            user = {
                'id': cognito_user['sub'],
                'mobile': mobile,
                'email': email,
                'name': cognito_user['attributes'].get('name', 'User'),
                'mobile_verified': cognito_user['attributes'].get('phone_number_verified', 'false') == 'true',
                'email_verified': cognito_user['attributes'].get('email_verified', 'false') == 'true' if email else False,
                'is_active': cognito_user['user_status'] != 'ARCHIVED'
            }
        else:
            # Update verification status from Cognito
            user['mobile_verified'] = cognito_user['attributes'].get('phone_number_verified', 'false') == 'true'
            if email:
                user['email_verified'] = cognito_user['attributes'].get('email_verified', 'false') == 'true'
        
        if not user.get("is_active", True):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Inactive user"
            )
        
        return user
        
    except HTTPException:
        raise
    except Exception as e:
        raise credentials_exception
