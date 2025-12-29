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
    # Secret key for creating JWT tokens
    # IMPORTANT: Change this in production!
    secret_key: str = "your-super-secret-key-change-this"
    
    # How long before a login token expires (in minutes)
    access_token_expire_minutes: int = 1440  # 24 hours
    
    # Algorithm for JWT encoding
    algorithm: str = "HS256"
    
    # --- AI Features ---
    # OpenAI API key for smart features
    openai_api_key: Optional[str] = None
    
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

