"""
===========================================
USER SCHEMAS
===========================================
Pydantic schemas for user-related API operations.

What are Schemas?
- They define WHAT data looks like
- They validate incoming data automatically
- They document the API (shows up in /docs)
- They're different from Models:
  - Models = database structure
  - Schemas = API request/response structure

Common patterns:
- UserCreate: What we need to CREATE a user
- UserResponse: What we RETURN about a user
- UserLogin: What we need to LOGIN
===========================================
"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime


class UserBase(BaseModel):
    """
    Base schema with common user fields.
    Other schemas inherit from this to avoid repetition.
    """
    email: EmailStr  # EmailStr validates email format automatically
    name: str = Field(..., min_length=1, max_length=100)
    phone: Optional[str] = Field(None, max_length=15)
    upi_id: Optional[str] = None


class UserCreate(UserBase):
    """
    Schema for creating a new user (signup).
    
    Requires:
    - email: Valid email address
    - name: User's display name
    - password: Plain text password (will be hashed before storing)
    
    Optional:
    - phone: Phone number
    - upi_id: UPI ID for payments
    """
    password: str = Field(..., min_length=6, description="Password must be at least 6 characters")


class UserLogin(BaseModel):
    """
    Schema for user login.
    
    We only need email and password to authenticate.
    """
    email: EmailStr
    password: str


class UserResponse(UserBase):
    """
    Schema for returning user data in API responses.
    
    Notice: NO password field here!
    We never send passwords back to the client.
    """
    id: int
    is_active: bool
    created_at: datetime
    
    class Config:
        # This allows Pydantic to read data from SQLAlchemy models
        # Without this, it won't know how to convert Model -> Schema
        from_attributes = True


class UserUpdate(BaseModel):
    """
    Schema for updating user profile.
    All fields are optional - only update what's provided.
    """
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    phone: Optional[str] = Field(None, max_length=15)
    upi_id: Optional[str] = None


class Token(BaseModel):
    """
    Schema for JWT token response after login.
    
    What is a JWT?
    - JSON Web Token
    - A secure way to prove "I am logged in"
    - Client stores this and sends it with each request
    - Server verifies it to know who the user is
    """
    access_token: str
    token_type: str = "bearer"  # Always "bearer" for JWT


class TokenData(BaseModel):
    """
    Schema for data stored inside the JWT token.
    
    When we create a token, we encode the user's email inside it.
    When we verify a token, we extract this data.
    """
    email: Optional[str] = None
    user_id: Optional[int] = None

