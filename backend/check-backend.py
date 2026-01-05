#!/usr/bin/env python3
"""
Quick script to check if backend is running and what port
"""
import requests
import sys

ports_to_check = [8000, 8002, 3000, 5000]

print("=" * 60)
print("CHECKING BACKEND SERVER STATUS")
print("=" * 60)

backend_found = False

for port in ports_to_check:
    try:
        url = f"http://localhost:{port}/health"
        response = requests.get(url, timeout=2)
        if response.status_code == 200:
            print(f"✅ Backend found on port {port}")
            print(f"   Health check: {response.json()}")
            backend_found = True
            break
    except requests.exceptions.ConnectionError:
        print(f"❌ Nothing on port {port}")
    except requests.exceptions.Timeout:
        print(f"⏱️  Timeout on port {port}")
    except Exception as e:
        print(f"⚠️  Error checking port {port}: {e}")

if not backend_found:
    print("\n" + "=" * 60)
    print("❌ Backend server is NOT running!")
    print("=" * 60)
    print("\n🔧 To start the backend:")
    print("   cd backend")
    print("   uvicorn app.main:app --reload --host 0.0.0.0 --port 8002")
    print("\n   Note: Using port 8002 to avoid conflict with DynamoDB (port 8000)")
    print("   Then access API at: http://localhost:8002")
    sys.exit(1)
else:
    print("\n" + "=" * 60)
    print("✅ Backend is running!")
    print("=" * 60)

