"""
===========================================
AUTHENTICATION SERVICE
===========================================
Handles user authentication:
- Password hashing (secure storage)
- JWT token creation and verification
- Getting current logged-in user

Security concepts explained:

1. PASSWORD HASHING
   - Never store passwords as plain text!
   - We use bcrypt to create a "hash" (scrambled version)
   - Same password always produces same hash
   - But you can't reverse a hash to get the password
   
2. JWT TOKENS
   - After login, we give user a "token"
   - Token contains user info, encoded with our secret key
   - User sends token with each request
   - We verify token to know who they are
   - Tokens expire after some time (security)
===========================================
"""

from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.config import settings
from app.database import get_db
from app.models.user import User
from app.schemas.user import TokenData

# --- Password Hashing Setup ---
# CryptContext handles password hashing using bcrypt algorithm
# bcrypt is slow on purpose - makes it hard for attackers to guess passwords
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# --- OAuth2 Setup ---
# This tells FastAPI where to find the token in requests
# "tokenUrl" is the endpoint where users get their token (login)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Check if a plain password matches a hashed password.
    
    How it works:
    1. Takes the plain password
    2. Hashes it using the same algorithm
    3. Compares with stored hash
    4. Returns True if they match
    
    Args:
        plain_password: The password user typed
        hashed_password: The hash stored in database
        
    Returns:
        True if password is correct, False otherwise
    """
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """
    Hash a password for secure storage.
    
    NEVER store plain passwords! Always hash them.
    
    Args:
        password: Plain text password
        
    Returns:
        Hashed password string
    """
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT token containing user data.
    
    How JWT works:
    1. We put user data (email, id) into a dictionary
    2. Add an expiration time
    3. Encode it all with our secret key
    4. Result is a long string (the token)
    
    Args:
        data: Dictionary with user info (e.g., {"sub": "user@email.com"})
        expires_delta: How long until token expires
        
    Returns:
        JWT token string
    """
    to_encode = data.copy()
    
    # Set expiration time
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    
    # Add expiration to token data
    to_encode.update({"exp": expire})
    
    # Create the token
    encoded_jwt = jwt.encode(
        to_encode, 
        settings.secret_key, 
        algorithm=settings.algorithm
    )
    
    return encoded_jwt


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """
    Get the currently logged-in user from JWT token.
    
    This is a "dependency" - FastAPI automatically calls it
    for any endpoint that needs the current user.
    
    How it works:
    1. Extract token from request header
    2. Decode and verify the token
    3. Get user from database
    4. Return user object
    
    If anything fails, return 401 Unauthorized error.
    
    Usage in endpoints:
        @app.get("/me")
        def get_my_profile(current_user: User = Depends(get_current_user)):
            return current_user
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # Decode the JWT token
        payload = jwt.decode(
            token, 
            settings.secret_key, 
            algorithms=[settings.algorithm]
        )
        
        # Extract email from token
        email: str = payload.get("sub")
        user_id: int = payload.get("user_id")
        
        if email is None:
            raise credentials_exception
            
        token_data = TokenData(email=email, user_id=user_id)
        
    except JWTError:
        raise credentials_exception
    
    # Get user from database (case-insensitive email)
    user = db.query(User).filter(func.lower(User.email) == func.lower(token_data.email)).first()
    
    if user is None:
        raise credentials_exception
        
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )
    
    return user


def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    """
    Authenticate a user with email and password.
    
    Args:
        db: Database session
        email: User's email
        password: Plain text password
        
    Returns:
        User object if credentials are valid, None otherwise
    """
    # Find user by email (case-insensitive)
    user = db.query(User).filter(func.lower(User.email) == func.lower(email)).first()
    
    if not user:
        return None
        
    if not verify_password(password, user.hashed_password):
        return None
        
    return user

