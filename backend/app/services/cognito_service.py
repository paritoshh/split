"""
===========================================
COGNITO SERVICE
===========================================
Handles AWS Cognito authentication:
- User registration
- User login
- Token verification
- User profile management

Uses boto3 to interact with AWS Cognito User Pool.
===========================================
"""

import boto3
from botocore.exceptions import ClientError
from typing import Optional, Dict, Any
from fastapi import HTTPException, status

from app.config import settings


class CognitoService:
    """Service for AWS Cognito operations."""
    
    def __init__(self):
        if not settings.cognito_user_pool_id:
            raise ValueError("COGNITO_USER_POOL_ID is required.")
        
        if not settings.cognito_app_client_id:
            raise ValueError("COGNITO_APP_CLIENT_ID is required.")
        
        # Initialize Cognito client
        self.client = boto3.client(
            'cognito-idp',
            region_name=settings.cognito_region
        )
        self.user_pool_id = settings.cognito_user_pool_id
        self.app_client_id = settings.cognito_app_client_id
    
    def register_user(self, mobile: str, password: str, name: str, email: Optional[str] = None) -> Dict[str, Any]:
        """
        Register a new user in Cognito.
        
        Uses mobile number as username. Mobile verification is mandatory.
        Email is optional.
        
        Returns:
            Dict with user attributes and confirmation status
        """
        import logging
        logger = logging.getLogger(__name__)
        
        # Ensure mobile number is in E.164 format (required by Cognito)
        # E.164 format: +[country code][number] (e.g., +919876543210)
        if not mobile.startswith('+'):
            logger.warning(f"Mobile number '{mobile}' doesn't start with '+'. Cognito requires E.164 format.")
            # Try to add + if it's missing (assumes Indian number if starts with 91)
            if mobile.startswith('91') and len(mobile) >= 12:
                mobile = '+' + mobile
                logger.info(f"Auto-corrected mobile to: {mobile}")
            else:
                logger.error(f"Mobile number '{mobile}' is not in E.164 format. Expected format: +91XXXXXXXXXX")
        
        try:
            # Prepare user attributes
            user_attributes = [
                {'Name': 'phone_number', 'Value': mobile},
                {'Name': 'name', 'Value': name},
            ]
            
            if email:
                user_attributes.append({'Name': 'email', 'Value': email})
            
            logger.info(f"Registering user with mobile: {mobile}, email: {email or 'None'}")
            
            # Sign up user - use mobile as username
            response = self.client.sign_up(
                ClientId=self.app_client_id,
                Username=mobile,  # Use mobile as username
                Password=password,
                UserAttributes=user_attributes
            )
            
            # Log code delivery details for debugging
            code_delivery = response.get('CodeDeliveryDetails', {})
            logger.info(f"Code delivery details: {code_delivery}")
            if code_delivery:
                logger.info(f"  - Destination: {code_delivery.get('Destination', 'N/A')}")
                logger.info(f"  - Delivery medium: {code_delivery.get('DeliveryMedium', 'N/A')}")
                logger.info(f"  - Attribute name: {code_delivery.get('AttributeName', 'N/A')}")
            else:
                logger.warning("No code delivery details in response - verification code may not be sent!")
            
            return {
                'user_sub': response['UserSub'],
                'code_delivery_details': code_delivery,
                'user_confirmed': response.get('UserConfirmed', False)
            }
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            
            if error_code == 'UsernameExistsException':
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Mobile number already registered"
                )
            elif error_code == 'InvalidPasswordException':
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Password does not meet requirements"
                )
            elif error_code == 'InvalidParameterException':
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid parameter: {error_message}"
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Registration failed: {error_message}"
                )
    
    def confirm_signup(self, mobile: str, confirmation_code: str) -> bool:
        """
        Confirm user signup with verification code.
        
        Returns:
            True if successful
        """
        try:
            self.client.confirm_sign_up(
                ClientId=self.app_client_id,
                Username=mobile,  # Use mobile as username
                ConfirmationCode=confirmation_code
            )
            return True
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            
            if error_code == 'CodeMismatchException':
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid verification code"
                )
            elif error_code == 'ExpiredCodeException':
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Verification code has expired"
                )
            elif error_code == 'NotAuthorizedException':
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="User is already confirmed"
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Confirmation failed: {error_message}"
                )
    
    def resend_confirmation_code(self, mobile: str) -> Dict[str, Any]:
        """
        Resend confirmation code to user's mobile.
        
        Returns:
            Dict with code delivery details
        """
        try:
            response = self.client.resend_confirmation_code(
                ClientId=self.app_client_id,
                Username=mobile  # Use mobile as username
            )
            return response.get('CodeDeliveryDetails', {})
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            
            if error_code == 'UserNotFoundException':
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="User not found"
                )
            elif error_code == 'LimitExceededException':
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many requests. Please try again later."
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to resend code: {error_message}"
                )
    
    def authenticate_user(self, mobile: str, password: str) -> Dict[str, Any]:
        """
        Authenticate user and get tokens.
        
        Uses mobile number for authentication.
        
        Returns:
            Dict with access_token, id_token, refresh_token, etc.
        """
        try:
            response = self.client.initiate_auth(
                ClientId=self.app_client_id,
                AuthFlow='USER_PASSWORD_AUTH',
                AuthParameters={
                    'USERNAME': mobile,  # Use mobile as username
                    'PASSWORD': password
                }
            )
            
            authentication_result = response['AuthenticationResult']
            
            return {
                'access_token': authentication_result['AccessToken'],
                'id_token': authentication_result['IdToken'],
                'refresh_token': authentication_result['RefreshToken'],
                'token_type': 'Bearer',
                'expires_in': authentication_result['ExpiresIn']
            }
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            
            if error_code == 'NotAuthorizedException':
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Incorrect mobile number or password"
                )
            elif error_code == 'UserNotConfirmedException':
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Mobile not verified. Please check your mobile for verification code."
                )
            elif error_code == 'UserNotFoundException':
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Incorrect mobile number or password"
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Authentication failed: {error_message}"
                )
    
    def get_user(self, access_token: str) -> Dict[str, Any]:
        """
        Get user information from access token.
        
        Returns:
            Dict with user attributes
        """
        try:
            response = self.client.get_user(AccessToken=access_token)
            
            # Parse user attributes
            user_attributes = {}
            for attr in response.get('UserAttributes', []):
                user_attributes[attr['Name']] = attr['Value']
            
            return {
                'username': response['Username'],
                'user_status': response['UserStatus'],
                'attributes': user_attributes,
                'sub': user_attributes.get('sub', response['Username'])
            }
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            
            if error_code == 'NotAuthorizedException':
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid or expired token"
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to get user: {error_message}"
                )
    
    def verify_token(self, access_token: str) -> Dict[str, Any]:
        """
        Verify and decode access token.
        This is a wrapper around get_user that also validates the token.
        
        Returns:
            Dict with user information
        """
        return self.get_user(access_token)
    
    def update_user_attributes(self, access_token: str, attributes: Dict[str, str]) -> bool:
        """
        Update user attributes.
        
        Args:
            access_token: User's access token
            attributes: Dict of attribute name -> value (e.g., {'name': 'New Name'})
        
        Returns:
            True if successful
        """
        try:
            user_attributes = [
                {'Name': key, 'Value': value}
                for key, value in attributes.items()
            ]
            
            self.client.update_user_attributes(
                AccessToken=access_token,
                UserAttributes=user_attributes
            )
            return True
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            
            if error_code == 'NotAuthorizedException':
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid or expired token"
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to update user: {error_message}"
                )
    
    def change_password(self, access_token: str, old_password: str, new_password: str) -> bool:
        """
        Change user password.
        
        Returns:
            True if successful
        """
        try:
            self.client.change_password(
                AccessToken=access_token,
                PreviousPassword=old_password,
                ProposedPassword=new_password
            )
            return True
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            
            if error_code == 'NotAuthorizedException':
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid password"
                )
            elif error_code == 'InvalidPasswordException':
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="New password does not meet requirements"
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to change password: {error_message}"
                )
    
    def forgot_password(self, mobile: str) -> Dict[str, Any]:
        """
        Initiate forgot password flow.
        
        Returns:
            Dict with code delivery details
        """
        try:
            response = self.client.forgot_password(
                ClientId=self.app_client_id,
                Username=mobile  # Use mobile as username
            )
            return response.get('CodeDeliveryDetails', {})
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            
            if error_code == 'UserNotFoundException':
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="User not found"
                )
            elif error_code == 'LimitExceededException':
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many requests. Please try again later."
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to initiate password reset: {error_message}"
                )
    
    def confirm_forgot_password(self, mobile: str, confirmation_code: str, new_password: str) -> bool:
        """
        Confirm forgot password with verification code.
        
        Returns:
            True if successful
        """
        try:
            self.client.confirm_forgot_password(
                ClientId=self.app_client_id,
                Username=mobile,  # Use mobile as username
                ConfirmationCode=confirmation_code,
                Password=new_password
            )
            return True
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            
            if error_code == 'CodeMismatchException':
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid verification code"
                )
            elif error_code == 'ExpiredCodeException':
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Verification code has expired"
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to reset password: {error_message}"
                )


# Create singleton instance
cognito_service: Optional[CognitoService] = None


def get_cognito_service() -> CognitoService:
    """Get or create Cognito service instance."""
    global cognito_service
    if cognito_service is None:
        cognito_service = CognitoService()
    return cognito_service

