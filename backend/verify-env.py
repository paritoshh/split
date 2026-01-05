#!/usr/bin/env python3
"""
Quick script to verify backend .env configuration
"""
import os
from pathlib import Path

# Load .env file manually
env_file = Path(__file__).parent / '.env'
if env_file.exists():
    print("✅ .env file exists")
    with open(env_file) as f:
        content = f.read()
        if 'DYNAMODB_ENDPOINT_URL=http://localhost:8000' in content:
            print("✅ DYNAMODB_ENDPOINT_URL is set to localhost:8000")
        elif 'DYNAMODB_ENDPOINT_URL' in content:
            print("⚠️  DYNAMODB_ENDPOINT_URL is set but not to localhost:8000")
            for line in content.split('\n'):
                if 'DYNAMODB_ENDPOINT_URL' in line:
                    print(f"   {line}")
        else:
            print("❌ DYNAMODB_ENDPOINT_URL is NOT set in .env")
            print("   This means backend will try to connect to AWS DynamoDB!")
        
        if 'DATABASE_TYPE=dynamodb' in content:
            print("✅ DATABASE_TYPE is set to dynamodb")
        else:
            print("❌ DATABASE_TYPE is NOT set to dynamodb")
else:
    print("❌ .env file does NOT exist!")
    print("   Run: cp env.dynamodb.local.example .env")

print("\n" + "="*50)
print("To fix:")
print("1. cd backend")
print("2. cp env.dynamodb.local.example .env")
print("3. Make sure DYNAMODB_ENDPOINT_URL=http://localhost:8000")
print("4. Restart backend: uvicorn app.main:app --reload")

