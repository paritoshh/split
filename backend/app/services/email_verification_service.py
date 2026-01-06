"""
===========================================
EMAIL VERIFICATION SERVICE
===========================================
Service for generating, storing, and verifying email verification codes.
- Generates 6-digit verification code
- Stores in DynamoDB with TTL (auto-deletes after expiry)
- Verification with expiry check (3 days)
===========================================
"""

import secrets
import logging
from datetime import datetime, timedelta
from typing import Optional, Tuple
from app.db.dynamodb_client import get_table
from app.config import settings

logger = logging.getLogger(__name__)


def generate_verification_code() -> str:
    """Generate a 6-digit verification code."""
    return f"{secrets.randbelow(1000000):06d}"




def store_verification_code(email: str, code: str) -> str:
    """
    Store email verification code in DynamoDB with TTL.
    Returns code ID for tracking.
    """
    from app.db.dynamodb_client import get_dynamodb_client
    from app.db.dynamodb_client import get_table_name
    
    client = get_dynamodb_client()
    table_name = get_table_name("email_verification_codes")
    
    # Generate unique code ID
    code_id = f"{email}_{int(datetime.utcnow().timestamp() * 1000)}"
    
    # Calculate expiry time (TTL in seconds since epoch)
    expiry_time = int((datetime.utcnow() + timedelta(days=settings.email_verification_expiry_days)).timestamp())
    created_at = int(datetime.utcnow().timestamp())
    
    try:
        client.put_item(
            TableName=table_name,
            Item={
                'email': {'S': email.lower()},
                'code_id': {'S': code_id},
                'verification_code': {'S': code},
                'created_at': {'N': str(created_at)},
                'expires_at': {'N': str(expiry_time)},
                'ttl': {'N': str(expiry_time)}  # DynamoDB TTL field
            }
        )
        logger.info(f"Stored verification code for email: {email[:5]}***")
        return code_id
    except Exception as e:
        logger.error(f"Error storing verification code: {e}")
        raise


def verify_email_code(email: str, code: str) -> Tuple[bool, Optional[str]]:
    """
    Verify email verification code.
    Returns (is_valid, error_message)
    """
    from app.db.dynamodb_client import get_dynamodb_client
    from app.db.dynamodb_client import get_table_name
    
    client = get_dynamodb_client()
    table_name = get_table_name("email_verification_codes")
    
    try:
        # Query all codes for this email
        response = client.query(
            TableName=table_name,
            KeyConditionExpression="email = :email",
            ExpressionAttributeValues={
                ":email": {"S": email.lower()}
            }
        )
        
        current_time = int(datetime.utcnow().timestamp())
        
        # Find matching code that hasn't expired
        for item in response.get('Items', []):
            stored_code = item.get('verification_code', {}).get('S', '')
            expires_at = int(item.get('expires_at', {}).get('N', '0'))
            code_id = item.get('code_id', {}).get('S', '')
            
            # Check if code matches and hasn't expired
            if stored_code == code and expires_at > current_time:
                # Delete the used code
                client.delete_item(
                    TableName=table_name,
                    Key={
                        'email': {'S': email.lower()},
                        'code_id': {'S': code_id}
                    }
                )
                
                logger.info(f"Email verification code verified for: {email[:5]}***")
                return True, None
        
        # Code not found or expired
        return False, "Invalid or expired verification code"
        
    except Exception as e:
        logger.error(f"Error verifying email code: {e}")
        return False, "Error verifying code"

