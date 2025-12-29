"""
===========================================
DATABASE ABSTRACTION LAYER
===========================================
This module provides a unified interface for database operations,
supporting both SQLite (development) and DynamoDB (production).

Usage:
    from app.db import get_db_service
    
    db = get_db_service()
    user = db.get_user_by_email("test@example.com")
===========================================
"""

from app.config import settings

# Export based on database type
if settings.database_type == "dynamodb":
    from app.db.dynamodb_client import get_dynamodb_client, create_tables
    from app.db.dynamodb_service import DynamoDBService as DBService
else:
    # SQLite uses existing database.py setup
    from app.database import get_db, SessionLocal
    from app.db.sqlite_service import SQLiteService as DBService


def get_db_service():
    """Get the appropriate database service based on configuration."""
    return DBService()

