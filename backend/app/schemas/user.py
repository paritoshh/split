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
from typing import Optional, Union
from datetime import datetime


class UserBase(BaseModel):
    """
    Base schema with common user fields.
    Other schemas inherit from this to avoid repetition.
    """
    name: str = Field(..., min_length=1, max_length=100)
    mobile: str = Field(..., min_length=10, max_length=20, description="Mobile number with country code (e.g., +91XXXXXXXXXX)")
    email: Optional[EmailStr] = Field(None, description="Optional email address")


class UserCreate(UserBase):
    """
    Schema for creating a new user (signup).
    
    Requires:
    - mobile: Mobile number with country code (e.g., +91XXXXXXXXXX)
    - name: User's display name
    - password: Plain text password (will be hashed before storing)
    
    Optional:
    - email: Email address (optional, must be verified before use)
    """
    password: str = Field(..., min_length=6, description="Password must be at least 6 characters")
    otp_token: str = Field(..., description="OTP verification token from /api/auth/verify-otp")


class UserLogin(BaseModel):
    """
    Schema for user login.
    
    We need mobile number and password to authenticate.
    """
    mobile: str = Field(..., min_length=10, max_length=20, description="Mobile number with country code")
    password: str


class UserResponse(UserBase):
    """
    Schema for returning user data in API responses.
    
    Notice: NO password field here!
    We never send passwords back to the client.
    """
    id: Union[int, str]  # int for SQLite, str (UUID) for DynamoDB
    is_active: bool
    email_verified: bool = False
    mobile_verified: bool = True  # Always true if OTP was used
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
    email: Optional[EmailStr] = Field(None, description="Email address (must be verified before use)")


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
    
    When we create a token, we encode the user's mobile inside it.
    When we verify a token, we extract this data.
    """
    mobile: Optional[str] = None
    user_id: Optional[Union[int, str]] = None  # int for SQLite, str (UUID) for DynamoDB


# ===========================================
# OTP SCHEMAS
# ===========================================

class SendOTPRequest(BaseModel):
    """Request to send OTP to mobile number."""
    mobile: str = Field(..., min_length=10, max_length=20, description="Mobile number with country code")


class VerifyOTPRequest(BaseModel):
    """Request to verify OTP."""
    mobile: str = Field(..., min_length=10, max_length=20, description="Mobile number with country code")
    otp: str = Field(..., min_length=4, max_length=6, description="OTP code received via SMS")


class VerifyOTPResponse(BaseModel):
    """Response after OTP verification."""
    success: bool
    otp_token: Optional[str] = Field(None, description="Token to use for registration (valid for 10 minutes)")
    message: str


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
# SUPPORT QUERY SCHEMAS
# ===========================================

class SupportQueryCreate(BaseModel):
    """Schema for creating a support query."""
    name: str = Field(..., min_length=1, max_length=100)
    mobile: str = Field(..., min_length=10, max_length=20, description="Mobile number with country code")
    email: EmailStr
    query: str = Field(..., min_length=10, max_length=2000, description="Query text")


class SupportQueryResponse(BaseModel):
    """Response after submitting support query."""
    success: bool
    enquiry_id: str = Field(..., description="Unique enquiry ID for tracking")
    message: str

