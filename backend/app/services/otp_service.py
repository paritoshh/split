"""
===========================================
OTP SERVICE
===========================================
Service for generating, storing, and verifying OTPs.
- Generates 6-digit OTP
- Stores in DynamoDB with TTL (auto-deletes after expiry)
- Rate limiting (max 3 OTPs per mobile per hour)
- Verification with expiry check
===========================================
"""

import secrets
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Tuple
from app.db.dynamodb_client import get_table, get_table_name
from app.config import settings
import boto3
from botocore.exceptions import ClientError
from boto3.dynamodb import conditions

logger = logging.getLogger(__name__)


def generate_otp() -> str:
    """Generate a 6-digit OTP."""
    return f"{secrets.randbelow(1000000):06d}"




def check_rate_limit(mobile: str) -> Tuple[bool, Optional[str]]:
    """
    Check if mobile number has exceeded rate limit.
    Returns (allowed, error_message)
    """
    from app.db.dynamodb_client import get_dynamodb_client
    from app.db.dynamodb_client import get_table_name
    
    client = get_dynamodb_client()
    table_name = get_table_name("otps")
    
    try:
        # Get all OTPs for this mobile in the last hour
        one_hour_ago = int((datetime.utcnow() - timedelta(hours=1)).timestamp())
        
        # Query OTPs for this mobile
        response = client.query(
            TableName=table_name,
            KeyConditionExpression="mobile = :mobile",
            ExpressionAttributeValues={
                ":mobile": {"S": mobile}
            }
        )
        
        # Count OTPs created in last hour
        recent_otps = [
            item for item in response.get('Items', [])
            if int(item.get('created_at', {}).get('N', '0')) > one_hour_ago
        ]
        
        if len(recent_otps) >= settings.otp_rate_limit_per_hour:
            return False, f"Rate limit exceeded. Maximum {settings.otp_rate_limit_per_hour} OTPs per hour."
        
        return True, None
    except Exception as e:
        logger.error(f"Error checking rate limit: {e}")
        # Allow on error to avoid blocking legitimate users
        return True, None


def store_otp(mobile: str, otp: str) -> str:
    """
    Store OTP in DynamoDB with TTL.
    Returns OTP ID for tracking.
    """
    from app.db.dynamodb_client import get_dynamodb_client
    from app.db.dynamodb_client import get_table_name
    
    client = get_dynamodb_client()
    table_name = get_table_name("otps")
    
    # Generate unique OTP ID
    otp_id = f"{mobile}_{int(datetime.utcnow().timestamp() * 1000)}"
    
    # Calculate expiry time (TTL in seconds since epoch)
    expiry_time = int((datetime.utcnow() + timedelta(minutes=settings.otp_expiry_minutes)).timestamp())
    created_at = int(datetime.utcnow().timestamp())
    
    try:
        client.put_item(
            TableName=table_name,
            Item={
                'mobile': {'S': mobile},
                'otp_id': {'S': otp_id},
                'otp': {'S': otp},
                'created_at': {'N': str(created_at)},
                'expires_at': {'N': str(expiry_time)},
                'ttl': {'N': str(expiry_time)}  # DynamoDB TTL field
            }
        )
        logger.info(f"Stored OTP for mobile: {mobile[:5]}***")
        return otp_id
    except Exception as e:
        logger.error(f"Error storing OTP: {e}")
        raise


def verify_otp(mobile: str, otp: str) -> Tuple[bool, Optional[str]]:
    """
    Verify OTP for mobile number.
    Returns (is_valid, error_message or otp_token)
    """
    from app.db.dynamodb_client import get_dynamodb_client
    from app.db.dynamodb_client import get_table_name
    
    client = get_dynamodb_client()
    table_name = get_table_name("otps")
    
    try:
        # Query all OTPs for this mobile
        response = client.query(
            TableName=table_name,
            KeyConditionExpression="mobile = :mobile",
            ExpressionAttributeValues={
                ":mobile": {"S": mobile}
            }
        )
        
        current_time = int(datetime.utcnow().timestamp())
        
        # Find matching OTP that hasn't expired
        for item in response.get('Items', []):
            stored_otp = item.get('otp', {}).get('S', '')
            expires_at = int(item.get('expires_at', {}).get('N', '0'))
            otp_id = item.get('otp_id', {}).get('S', '')
            
            # Check if OTP matches and hasn't expired
            if stored_otp == otp and expires_at > current_time:
                # Generate OTP token for registration (valid for 10 minutes)
                otp_token = secrets.token_urlsafe(32)
                
                # Store OTP token temporarily
                token_expiry = int((datetime.utcnow() + timedelta(minutes=10)).timestamp())
                token_mobile = f"TOKEN_{mobile}"
                client.put_item(
                    TableName=table_name,
                    Item={
                        'mobile': {'S': token_mobile},
                        'otp_id': {'S': otp_token},
                        'otp': {'S': 'VERIFIED'},
                        'created_at': {'N': str(current_time)},
                        'expires_at': {'N': str(token_expiry)},
                        'ttl': {'N': str(token_expiry)}
                    }
                )
                
                # Delete the used OTP
                client.delete_item(
                    TableName=table_name,
                    Key={
                        'mobile': {'S': mobile},
                        'otp_id': {'S': otp_id}
                    }
                )
                
                logger.info(f"OTP verified for mobile: {mobile[:5]}***")
                return True, otp_token
        
        # OTP not found or expired
        return False, "Invalid or expired OTP"
        
    except Exception as e:
        logger.error(f"Error verifying OTP: {e}")
        return False, "Error verifying OTP"


def verify_otp_token(mobile: str, otp_token: str) -> bool:
    """
    Verify OTP token (used during registration).
    Returns True if token is valid.
    """
    from app.db.dynamodb_client import get_dynamodb_client
    from app.db.dynamodb_client import get_table_name
    
    client = get_dynamodb_client()
    table_name = get_table_name("otps")
    token_mobile = f"TOKEN_{mobile}"
    
    try:
        response = client.get_item(
            TableName=table_name,
            Key={
                'mobile': {'S': token_mobile},
                'otp_id': {'S': otp_token}
            }
        )
        
        if 'Item' not in response:
            return False
        
        item = response['Item']
        expires_at = int(item.get('expires_at', {}).get('N', '0'))
        current_time = int(datetime.utcnow().timestamp())
        otp_value = item.get('otp', {}).get('S', '')
        
        if expires_at > current_time and otp_value == 'VERIFIED':
            # Delete token after use
            client.delete_item(
                TableName=table_name,
                Key={
                    'mobile': {'S': token_mobile},
                    'otp_id': {'S': otp_token}
                }
            )
            return True
        
        return False
        
    except Exception as e:
        logger.error(f"Error verifying OTP token: {e}")
        return False

