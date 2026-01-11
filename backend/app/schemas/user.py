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

from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, Union
from datetime import datetime


class UserBase(BaseModel):
    """
    Base schema with common user fields.
    Other schemas inherit from this to avoid repetition.
    """
    email: EmailStr = Field(..., description="Email address (mandatory)")
    name: str = Field(..., min_length=1, max_length=100)
    mobile: Optional[str] = Field(None, description="Optional mobile number with country code (e.g., +91XXXXXXXXXX)")
    
    @field_validator('mobile', mode='before')
    @classmethod
    def validate_mobile(cls, v):
        """Convert empty strings to None and validate mobile if provided."""
        if v is None or v == "" or (isinstance(v, str) and v.strip() == ""):
            return None
        if isinstance(v, str) and (len(v) < 10 or len(v) > 20):
            raise ValueError("Mobile number must be between 10 and 20 characters")
        return v


class UserCreate(UserBase):
    """
    Schema for creating a new user (signup).
    
    Requires:
    - email: Email address (mandatory, must be verified)
    - name: User's display name
    - password: Plain text password
    
    Optional:
    - mobile: Mobile number with country code (optional, hidden from UI)
    """
    password: str = Field(..., min_length=6, description="Password must be at least 6 characters")


class UserLogin(BaseModel):
    """
    Schema for user login.
    
    We need email and password to authenticate.
    """
    email: EmailStr = Field(..., description="Email address")
    password: str


class UserResponse(UserBase):
    """
    Schema for returning user data in API responses.
    
    Notice: NO password field here!
    We never send passwords back to the client.
    """
    id: Union[int, str]  # int for SQLite, str (UUID) for DynamoDB
    is_active: bool
    email_verified: bool = False  # Email verification is mandatory
    mobile_verified: bool = False  # Mobile verification is optional (if mobile provided)
    created_at: Optional[datetime] = None
    
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
    email: Optional[EmailStr] = Field(None, description="Optional email address")


class Token(BaseModel):
    """
    Schema for Cognito token response after login.
    
    Returns access_token, id_token, and refresh_token from Cognito.
    """
    access_token: str
    id_token: Optional[str] = None
    refresh_token: Optional[str] = None
    token_type: str = "Bearer"
    expires_in: Optional[int] = None


# ===========================================
# EMAIL VERIFICATION SCHEMAS
# ===========================================

class SendEmailVerificationRequest(BaseModel):
    """Request to send email verification code."""
    email: EmailStr


class VerifyEmailRequest(BaseModel):
    """Request to verify email."""
    email: EmailStr
    verification_code: str = Field(..., min_length=4, max_length=6, description="Verification code received via email")


class VerifyEmailResponse(BaseModel):
    """Response after email verification."""
    success: bool
    message: str


# ===========================================
# COGNITO SCHEMAS
# ===========================================

class CognitoTokenResponse(BaseModel):
    """Response after Cognito authentication."""
    access_token: str
    id_token: str
    refresh_token: str
    token_type: str = "Bearer"
    expires_in: int


# ===========================================
# SUPPORT QUERY SCHEMAS
# ===========================================

class SupportQueryCreate(BaseModel):
    """Schema for creating a support query."""
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    mobile: Optional[str] = Field(None, min_length=10, max_length=20, description="Optional mobile number with country code")
    query: str = Field(..., min_length=10, max_length=2000, description="Query text")


class SupportQueryResponse(BaseModel):
    """Response after submitting support query."""
    success: bool
    enquiry_id: str = Field(..., description="Unique enquiry ID for tracking")
    message: str

