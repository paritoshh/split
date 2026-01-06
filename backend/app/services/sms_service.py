"""
===========================================
SMS SERVICE
===========================================
Service for sending SMS via AWS SNS.
Used for sending OTP codes to mobile numbers.
===========================================
"""

import logging
import boto3
from botocore.exceptions import ClientError
from typing import Optional
from app.config import settings
import os

logger = logging.getLogger(__name__)

_sns_client = None


def get_sns_client():
    """Get or create SNS client."""
    global _sns_client
    if _sns_client is None:
        is_lambda = os.environ.get("AWS_LAMBDA_FUNCTION_NAME") is not None
        
        if is_lambda:
            # Lambda: use IAM role
            logger.info("🔵 Lambda environment - using IAM role for SNS")
            _sns_client = boto3.client("sns", region_name=settings.aws_region)
        elif (settings.aws_access_key_id and 
              settings.aws_secret_access_key and
              settings.aws_access_key_id.strip() and 
              settings.aws_secret_access_key.strip()):
            # Local testing with explicit credentials
            logger.info("Using explicit AWS credentials for SNS (local testing)")
            _sns_client = boto3.client(
                "sns",
                region_name=settings.aws_region,
                aws_access_key_id=settings.aws_access_key_id,
                aws_secret_access_key=settings.aws_secret_access_key
            )
        else:
            # Use IAM role or default credentials
            logger.info("Using IAM role for SNS")
            _sns_client = boto3.client("sns", region_name=settings.aws_region)
    
    return _sns_client


def send_otp_sms(mobile: str, otp: str) -> tuple[bool, Optional[str]]:
    """
    Send OTP via SMS using AWS SNS.
    Returns (success, error_message)
    """
    try:
        sns_client = get_sns_client()
        
        # Format message
        message = f"Your Hisab verification code is {otp}. Valid for {settings.otp_expiry_minutes} minutes."
        
        # Send SMS
        response = sns_client.publish(
            PhoneNumber=mobile,
            Message=message,
            MessageAttributes={
                'AWS.SNS.SMS.SMSType': {
                    'DataType': 'String',
                    'StringValue': 'Transactional'
                }
            }
        )
        
        message_id = response.get('MessageId')
        logger.info(f"✅ SMS sent to {mobile[:5]}*** - MessageId: {message_id}")
        
        return True, None
        
    except ClientError as e:
        error_code = e.response.get('Error', {}).get('Code', 'Unknown')
        error_message = e.response.get('Error', {}).get('Message', str(e))
        logger.error(f"❌ Failed to send SMS to {mobile[:5]}***: {error_code} - {error_message}")
        return False, f"Failed to send SMS: {error_message}"
    except Exception as e:
        logger.error(f"❌ Unexpected error sending SMS: {e}")
        return False, f"Failed to send SMS: {str(e)}"

