"""
===========================================
DATABASE ABSTRACTION LAYER
===========================================
This module provides a unified interface for database operations,
supporting both SQLite (development) and DynamoDB (production).

Usage:
    from app.db import get_db_service, DBService
    
    # In routers:
    db_service: DBService = Depends(get_db_service)
    user = db_service.get_user_by_email("test@example.com")
===========================================
"""

from typing import Generator
from app.config import settings

# Import both services
from app.db.dynamodb_service import DynamoDBService
from app.db.sqlite_service import SQLiteService

# Type alias for the database service
DBService = DynamoDBService if settings.database_type == "dynamodb" else SQLiteService


def get_db_service() -> Generator:
    """
    FastAPI dependency that provides the database service.
    
    Usage in routers:
        @router.get("/users")
        def get_users(db: DBService = Depends(get_db_service)):
            return db.search_users("test")
    """
    if settings.database_type == "dynamodb":
        # DynamoDB service doesn't need session management
        service = DynamoDBService()
        try:
            yield service
        finally:
            pass  # No cleanup needed for DynamoDB
    else:
        # SQLite service needs session management
        service = SQLiteService()
        try:
            yield service
        finally:
            service._close_session()


# Also export for direct imports
__all__ = ["get_db_service", "DBService", "DynamoDBService", "SQLiteService"]
