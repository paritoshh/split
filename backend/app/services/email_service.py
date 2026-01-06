"""
===========================================
EMAIL SERVICE
===========================================
Service for sending emails via AWS SES.
Used for sending email verification codes.
===========================================
"""

import logging
import boto3
from botocore.exceptions import ClientError
from typing import Optional, Tuple
from app.config import settings
import os

logger = logging.getLogger(__name__)

_ses_client = None


def get_ses_client():
    """Get or create SES client."""
    global _ses_client
    if _ses_client is None:
        is_lambda = os.environ.get("AWS_LAMBDA_FUNCTION_NAME") is not None
        
        if is_lambda:
            # Lambda: use IAM role
            logger.info("🔵 Lambda environment - using IAM role for SES")
            _ses_client = boto3.client("ses", region_name=settings.aws_region)
        elif (settings.aws_access_key_id and 
              settings.aws_secret_access_key and
              settings.aws_access_key_id.strip() and 
              settings.aws_secret_access_key.strip()):
            # Local testing with explicit credentials
            logger.info("Using explicit AWS credentials for SES (local testing)")
            _ses_client = boto3.client(
                "ses",
                region_name=settings.aws_region,
                aws_access_key_id=settings.aws_access_key_id,
                aws_secret_access_key=settings.aws_secret_access_key
            )
        else:
            # Use IAM role or default credentials
            logger.info("Using IAM role for SES")
            _ses_client = boto3.client("ses", region_name=settings.aws_region)
    
    return _ses_client


def send_email_verification_code(email: str, verification_code: str) -> Tuple[bool, Optional[str]]:
    """
    Send email verification code via AWS SES.
    Returns (success, error_message)
    """
    try:
        ses_client = get_ses_client()
        
        if not settings.ses_sender_email:
            logger.error("SES sender email not configured")
            return False, "Email service not configured"
        
        # Format email
        subject = "Verify your email - Hisab"
        body_text = f"""
Your Hisab email verification code is: {verification_code}

This code is valid for {settings.email_verification_expiry_days} days.

If you didn't request this code, please ignore this email.
        """.strip()
        
        body_html = f"""
<html>
<head></head>
<body>
  <h2>Verify your email - Hisab</h2>
  <p>Your email verification code is: <strong style="font-size: 20px; color: #6366f1;">{verification_code}</strong></p>
  <p>This code is valid for {settings.email_verification_expiry_days} days.</p>
  <p>If you didn't request this code, please ignore this email.</p>
</body>
</html>
        """.strip()
        
        # Send email
        response = ses_client.send_email(
            Source=settings.ses_sender_email,
            Destination={
                'ToAddresses': [email]
            },
            Message={
                'Subject': {
                    'Data': subject,
                    'Charset': 'UTF-8'
                },
                'Body': {
                    'Text': {
                        'Data': body_text,
                        'Charset': 'UTF-8'
                    },
                    'Html': {
                        'Data': body_html,
                        'Charset': 'UTF-8'
                    }
                }
            }
        )
        
        message_id = response.get('MessageId')
        logger.info(f"✅ Email sent to {email} - MessageId: {message_id}")
        
        return True, None
        
    except ClientError as e:
        error_code = e.response.get('Error', {}).get('Code', 'Unknown')
        error_message = e.response.get('Error', {}).get('Message', str(e))
        logger.error(f"❌ Failed to send email to {email}: {error_code} - {error_message}")
        return False, f"Failed to send email: {error_message}"
    except Exception as e:
        logger.error(f"❌ Unexpected error sending email: {e}")
        return False, f"Failed to send email: {str(e)}"

