#!/usr/bin/env python3
"""
===========================================
INITIALIZE DYNAMODB TABLES
===========================================
Run this script to create all DynamoDB tables locally.

Usage:
    python scripts/init_dynamodb.py

Before running:
    1. Start Docker: docker-compose up -d
    2. Ensure .env has: DATABASE_TYPE=dynamodb
    3. Ensure .env has: DYNAMODB_ENDPOINT_URL=http://localhost:8000
===========================================
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.dynamodb_client import create_tables, delete_tables, get_dynamodb_client
from app.config import settings


def main():
    print("=" * 50)
    print("HISAB - DynamoDB Table Setup")
    print("=" * 50)
    print(f"Database Type: {settings.database_type}")
    print(f"AWS Region: {settings.aws_region}")
    print(f"Table Prefix: {settings.dynamodb_table_prefix}")
    print(f"Endpoint URL: {settings.dynamodb_endpoint_url or 'AWS (production)'}")
    print("=" * 50)
    
    if settings.database_type != "dynamodb":
        print("❌ Error: DATABASE_TYPE must be 'dynamodb' to run this script")
        print("   Set DATABASE_TYPE=dynamodb in your .env file")
        sys.exit(1)
    
    # Test connection
    try:
        client = get_dynamodb_client()
        tables = client.list_tables()
        print(f"✅ Connected to DynamoDB")
        print(f"   Existing tables: {tables.get('TableNames', [])}")
    except Exception as e:
        print(f"❌ Failed to connect to DynamoDB: {e}")
        print("   Make sure Docker is running: docker-compose up -d")
        sys.exit(1)
    
    # Check if we should reset
    if "--reset" in sys.argv:
        print("\n⚠️  Deleting existing tables...")
        delete_tables()
        print("✅ Tables deleted")
    
    # Create tables
    print("\n📦 Creating tables...")
    create_tables()
    
    # List created tables
    tables = client.list_tables()
    print(f"\n✅ Setup complete! Tables: {tables.get('TableNames', [])}")
    print("\n📋 Next steps:")
    print("   1. View tables at: http://localhost:8001")
    print("   2. Start backend: cd backend && uvicorn app.main:app --reload")
    print("   3. The app will use DynamoDB instead of SQLite")


if __name__ == "__main__":
    main()

