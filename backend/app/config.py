"""
===========================================
CONFIGURATION SETTINGS
===========================================
This file manages all application settings.
It reads values from environment variables (from .env file).

Why use a config file?
- Keep sensitive data (API keys, passwords) out of code
- Easy to change settings without modifying code
- Different settings for development vs production
===========================================
"""

from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Optional, Literal


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    
    Pydantic automatically:
    1. Reads from .env file
    2. Validates the values
    3. Converts types (str to int, etc.)
    """
    
    # --- App Info ---
    app_name: str = "Hisab"
    debug: bool = True
    
    # --- Database Type ---
    # "sqlite" for local SQLite (development)
    # "dynamodb" for AWS DynamoDB (production)
    database_type: Literal["sqlite", "dynamodb"] = "sqlite"
    
    # --- SQLite Database ---
    # SQLite URL format: sqlite:///./filename.db
    database_url: str = "sqlite:///./split.db"
    
    # --- DynamoDB Settings ---
    # AWS region for DynamoDB
    aws_region: str = "ap-south-1"  # Mumbai region
    # DynamoDB table name prefix (e.g., "hisab_" -> "hisab_users", "hisab_groups")
    dynamodb_table_prefix: str = "hisab_"
    # Local DynamoDB endpoint (for testing with Docker)
    dynamodb_endpoint_url: Optional[str] = None  # e.g., "http://localhost:8000" for local
    
    # --- AWS Credentials (for local DynamoDB testing) ---
    # These are optional - for local testing, any value works
    # For AWS deployment, use IAM roles instead of hardcoded keys
    aws_access_key_id: Optional[str] = None
    aws_secret_access_key: Optional[str] = None
    
    # --- Security ---
    # Note: Authentication is handled by AWS Cognito
    # No JWT secret key needed
    
    # --- AI Features ---
    # OpenAI API key for smart features
    openai_api_key: Optional[str] = None
    
    # --- SMS Service (AWS SNS) ---
    # AWS SNS is used for sending OTP via SMS
    # No API key needed - uses IAM role in Lambda, or AWS credentials locally
    # Note: SMS costs ~₹0.50-0.80 per message in India
    
    # --- Email Service (AWS SES) ---
    # AWS SES is used for sending email verification codes
    # Free tier: 62,000 emails/month
    # No API key needed - uses IAM role in Lambda, or AWS credentials locally
    # Email sender address (must be verified in SES)
    ses_sender_email: Optional[str] = Field(None, description="Verified sender email address in AWS SES")
    
    # --- AWS Cognito ---
    # AWS Cognito User Pool for authentication
    # Get these values from AWS Cognito Console
    cognito_user_pool_id: str = Field(..., description="Cognito User Pool ID (e.g., ap-south-1_XXXXXXXXX)")
    cognito_app_client_id: str = Field(..., description="Cognito App Client ID")
    cognito_region: str = "ap-south-1"  # Region where Cognito User Pool is created
    
    # --- OTP Settings ---
    otp_expiry_minutes: int = 5  # OTP expires in 5 minutes
    otp_rate_limit_per_hour: int = 3  # Max 3 OTPs per mobile per hour
    email_verification_expiry_days: int = 3  # Email verification code expires in 3 days
    
    # --- CORS ---
    # Which frontend URLs can access our API
    # This is a security feature to prevent unauthorized websites from using our API
    # Includes: localhost for dev, capacitor for mobile app, local network IP, production CloudFront
    # Can be overridden via ALLOWED_ORIGINS environment variable
    allowed_origins: str = "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,capacitor://localhost,http://localhost,http://192.168.1.254:5173,https://hisab.paritoshagarwal.com,http://hisab-paritosh-frontend.s3-website.ap-south-1.amazonaws.com"
    
    class Config:
        # Tell Pydantic to read from .env file
        env_file = ".env"
        # Make variable names case-insensitive
        # So DATABASE_URL in .env maps to database_url here
        env_file_encoding = "utf-8"


# Create a single instance to use throughout the app
# Import this wherever you need settings: from app.config import settings
settings = Settings()

