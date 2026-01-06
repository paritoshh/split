"""
===========================================
AUTHENTICATION SERVICE
===========================================
Handles user authentication:
- Password hashing (secure storage)
- JWT token creation and verification
- Getting current logged-in user

Supports both SQLite and DynamoDB backends.
===========================================
"""

from datetime import datetime, timedelta
from typing import Optional, Union
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

# IMPORTANT: Import bcrypt BEFORE passlib to ensure it's available
# This is critical for Lambda where module loading order matters
try:
    import bcrypt
    # Verify bcrypt is actually working
    bcrypt.gensalt()  # This will fail if bcrypt isn't properly installed
except ImportError as e:
    raise ImportError(f"bcrypt module not found. This is required for password hashing. Error: {e}")
except Exception as e:
    raise RuntimeError(f"bcrypt module found but not working properly. Error: {e}")

from passlib.context import CryptContext

from app.config import settings
from app.db import get_db_service, DBService
from app.schemas.user import TokenData

# --- Password Hashing Setup ---
# Explicitly ensure bcrypt backend is available before creating context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# --- OAuth2 Setup ---
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Check if a plain password matches a hashed password."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password for secure storage."""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT token containing user data."""
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    
    to_encode.update({"exp": expire})
    
    encoded_jwt = jwt.encode(
        to_encode, 
        settings.secret_key, 
        algorithm=settings.algorithm
    )
    
    return encoded_jwt


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db_service: DBService = Depends(get_db_service)
) -> dict:
    """
    Get the currently logged-in user from JWT token.
    
    Returns a dict with user info (works with both SQLite and DynamoDB).
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(
            token, 
            settings.secret_key, 
            algorithms=[settings.algorithm]
        )
        
        mobile: str = payload.get("sub")  # Changed from email to mobile
        user_id = payload.get("user_id")
        
        if mobile is None:
            raise credentials_exception
            
        token_data = TokenData(mobile=mobile, user_id=user_id)
        
    except JWTError:
        raise credentials_exception
    
    # Get user from database using mobile
    user = db_service.get_user_by_mobile(token_data.mobile)
    
    if user is None:
        raise credentials_exception
        
    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )
    
    return user


def authenticate_user(db_service: DBService, mobile: str, password: str) -> Optional[dict]:
    """
    Authenticate a user with mobile and password.
    
    Returns user dict if credentials are valid, None otherwise.
    """
    user = db_service.get_user_by_mobile(mobile)
    
    if not user:
        return None
        
    if not verify_password(password, user.get("hashed_password", "")):
        return None
        
    return user
