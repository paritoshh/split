"""
===========================================
SUPPORT ROUTER
===========================================
API endpoints for support queries.
No authentication required - can be submitted from login page.
===========================================
"""

from fastapi import APIRouter, HTTPException, status
import uuid
from datetime import datetime

from app.schemas.user import SupportQueryCreate, SupportQueryResponse
from app.db.dynamodb_client import get_dynamodb_client, get_table_name

router = APIRouter(
    prefix="/api/support",
    tags=["Support"]
)


@router.post("/submit-query", response_model=SupportQueryResponse, status_code=status.HTTP_201_CREATED)
async def submit_query(query_data: SupportQueryCreate):
    """
    Submit a support query.
    No authentication required - accessible from login page.
    Returns enquiry ID for tracking.
    """
    client = get_dynamodb_client()
    table_name = get_table_name("support_queries")
    
    # Generate unique enquiry ID
    enquiry_id = str(uuid.uuid4())
    
    # Create query item
    item = {
        "enquiry_id": {"S": enquiry_id},
        "name": {"S": query_data.name},
        "mobile": {"S": query_data.mobile},
        "email": {"S": query_data.email.lower()},
        "query": {"S": query_data.query},
        "created_at": {"S": datetime.utcnow().isoformat()},
        "status": {"S": "pending"}  # pending, resolved, etc.
    }
    
    try:
        client.put_item(TableName=table_name, Item=item)
        
        return SupportQueryResponse(
            success=True,
            enquiry_id=enquiry_id,
            message="Your query has been submitted successfully. We'll get back to you soon."
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to submit query: {str(e)}"
        )

