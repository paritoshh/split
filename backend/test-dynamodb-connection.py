#!/usr/bin/env python3
"""
Quick test to verify DynamoDB connection and tables
Run this on your Windows machine to diagnose the issue
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db.dynamodb_client import get_dynamodb_client, get_table_name
from app.config import settings

print("=" * 60)
print("DYNAMODB CONNECTION TEST")
print("=" * 60)
print(f"Database Type: {settings.database_type}")
print(f"Endpoint URL: {settings.dynamodb_endpoint_url or 'AWS (not set)'}")
print(f"Region: {settings.aws_region}")
print(f"Table Prefix: {settings.dynamodb_table_prefix}")
print("=" * 60)

try:
    # Get client
    print("\n1. Getting DynamoDB client...")
    client = get_dynamodb_client()
    print("   ✅ Client created")
    
    # List tables
    print("\n2. Listing tables...")
    response = client.list_tables()
    tables = response.get('TableNames', [])
    print(f"   ✅ Found {len(tables)} tables:")
    for table in tables:
        print(f"      - {table}")
    
    # Check if users table exists
    users_table = get_table_name("users")
    print(f"\n3. Checking for users table: {users_table}")
    if users_table in tables:
        print(f"   ✅ Table exists: {users_table}")
        
        # Try to query it
        print("\n4. Testing query on users table...")
        try:
            result = client.query(
                TableName=users_table,
                IndexName="email-index",
                KeyConditionExpression="email = :email",
                ExpressionAttributeValues={":email": {"S": "test@example.com"}}
            )
            print(f"   ✅ Query successful (found {len(result.get('Items', []))} items)")
        except Exception as e:
            print(f"   ⚠️  Query failed: {e}")
            print(f"      This might be OK if the table is empty")
    else:
        print(f"   ❌ Table does NOT exist: {users_table}")
        print(f"\n   🔧 FIX: Run this command:")
        print(f"      cd backend")
        print(f"      python scripts/init_dynamodb.py")
    
    print("\n" + "=" * 60)
    print("✅ Connection test complete!")
    print("=" * 60)
    
except Exception as e:
    print(f"\n❌ ERROR: {e}")
    print("\n🔧 TROUBLESHOOTING:")
    print("   1. Is DynamoDB Local running?")
    print("      docker ps | grep dynamodb")
    print("   2. Is .env configured correctly?")
    print("      Check: DYNAMODB_ENDPOINT_URL=http://localhost:8000")
    print("   3. Try restarting DynamoDB:")
    print("      docker-compose restart")
    sys.exit(1)

