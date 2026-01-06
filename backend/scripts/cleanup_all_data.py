"""
===========================================
CLEANUP ALL DATA SCRIPT
===========================================
Deletes all existing data from all DynamoDB tables.
Use this to start fresh with the new mobile-based authentication system.

WARNING: This will permanently delete ALL data from:
- users
- groups
- group_members
- expenses
- expense_splits
- settlements
- notifications
- otps
- email_verification_codes
- support_queries

Usage:
    python scripts/cleanup_all_data.py

To confirm deletion, you'll be prompted.
===========================================
"""

import sys
import os

# Add parent directory to path so we can import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.dynamodb_client import get_dynamodb_client, get_table_name
from app.config import settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def delete_all_items_from_table(client, table_name: str):
    """Delete all items from a DynamoDB table."""
    logger.info(f"🗑️  Deleting all items from {table_name}...")
    
    deleted_count = 0
    
    try:
        # Scan to get all items
        response = client.scan(TableName=table_name)
        items = response.get('Items', [])
        
        if not items:
            logger.info(f"   ✅ {table_name} is already empty")
            return 0
        
        # Delete items in batches (DynamoDB allows up to 25 items per batch)
        batch_size = 25
        for i in range(0, len(items), batch_size):
            batch = items[i:i + batch_size]
            
            # Prepare delete requests
            delete_requests = []
            for item in batch:
                # Extract key attributes (varies by table)
                key = {}
                
                # Determine key structure based on table name
                if 'user_id' in item:
                    key['user_id'] = item['user_id']
                elif 'group_id' in item:
                    key['group_id'] = item['group_id']
                    if 'user_id' in item:  # Composite key
                        key['user_id'] = item['user_id']
                elif 'expense_id' in item:
                    key['expense_id'] = item['expense_id']
                    if 'user_id' in item:  # Composite key
                        key['user_id'] = item['user_id']
                elif 'settlement_id' in item:
                    key['settlement_id'] = item['settlement_id']
                elif 'notification_id' in item:
                    key['user_id'] = item['user_id']
                    key['notification_id'] = item['notification_id']
                elif 'otp_id' in item:
                    key['mobile'] = item['mobile']
                    key['otp_id'] = item['otp_id']
                elif 'code_id' in item:
                    key['email'] = item['email']
                    key['code_id'] = item['code_id']
                elif 'enquiry_id' in item:
                    key['enquiry_id'] = item['enquiry_id']
                else:
                    logger.warning(f"   ⚠️  Unknown key structure in {table_name}, skipping item")
                    continue
                
                delete_requests.append({'DeleteRequest': {'Key': key}})
            
            if delete_requests:
                # Batch delete
                client.batch_write_item(
                    RequestItems={
                        table_name: delete_requests
                    }
                )
                deleted_count += len(delete_requests)
                logger.info(f"   ✅ Deleted {len(delete_requests)} items (total: {deleted_count})")
        
        # Handle pagination if there are more items
        while 'LastEvaluatedKey' in response:
            response = client.scan(
                TableName=table_name,
                ExclusiveStartKey=response['LastEvaluatedKey']
            )
            items = response.get('Items', [])
            
            if items:
                for i in range(0, len(items), batch_size):
                    batch = items[i:i + batch_size]
                    delete_requests = []
                    
                    for item in batch:
                        key = {}
                        if 'user_id' in item:
                            key['user_id'] = item['user_id']
                        elif 'group_id' in item:
                            key['group_id'] = item['group_id']
                            if 'user_id' in item:
                                key['user_id'] = item['user_id']
                        elif 'expense_id' in item:
                            key['expense_id'] = item['expense_id']
                            if 'user_id' in item:
                                key['user_id'] = item['user_id']
                        elif 'settlement_id' in item:
                            key['settlement_id'] = item['settlement_id']
                        elif 'notification_id' in item:
                            key['user_id'] = item['user_id']
                            key['notification_id'] = item['notification_id']
                        elif 'otp_id' in item:
                            key['mobile'] = item['mobile']
                            key['otp_id'] = item['otp_id']
                        elif 'code_id' in item:
                            key['email'] = item['email']
                            key['code_id'] = item['code_id']
                        elif 'enquiry_id' in item:
                            key['enquiry_id'] = item['enquiry_id']
                        else:
                            continue
                        
                        delete_requests.append({'DeleteRequest': {'Key': key}})
                    
                    if delete_requests:
                        client.batch_write_item(
                            RequestItems={
                                table_name: delete_requests
                            }
                        )
                        deleted_count += len(delete_requests)
                        logger.info(f"   ✅ Deleted {len(delete_requests)} items (total: {deleted_count})")
        
        logger.info(f"   ✅ Completed: {deleted_count} items deleted from {table_name}")
        return deleted_count
        
    except Exception as e:
        logger.error(f"   ❌ Error deleting from {table_name}: {e}")
        return deleted_count


def cleanup_all_data():
    """Delete all data from all tables."""
    logger.info("=" * 60)
    logger.info("🧹 DATA CLEANUP SCRIPT")
    logger.info("=" * 60)
    logger.info(f"📦 Database type: {settings.database_type}")
    logger.info(f"📍 DynamoDB Endpoint: {settings.dynamodb_endpoint_url or 'AWS (default)'}")
    logger.info(f"📍 AWS Region: {settings.aws_region}")
    logger.info("")
    
    # Confirm deletion
    print("\n⚠️  WARNING: This will DELETE ALL DATA from all tables!")
    print("   Tables affected:")
    print("   - users")
    print("   - groups")
    print("   - group_members")
    print("   - expenses")
    print("   - expense_splits")
    print("   - settlements")
    print("   - notifications")
    print("   - otps")
    print("   - email_verification_codes")
    print("   - support_queries")
    print("")
    
    confirmation = input("Type 'DELETE ALL DATA' to confirm: ")
    
    if confirmation != "DELETE ALL DATA":
        logger.info("❌ Cleanup cancelled. No data was deleted.")
        return
    
    logger.info("")
    logger.info("🚀 Starting cleanup...")
    logger.info("")
    
    client = get_dynamodb_client()
    
    # List of all tables
    tables = [
        "users",
        "groups",
        "group_members",
        "expenses",
        "expense_splits",
        "settlements",
        "notifications",
        "otps",
        "email_verification_codes",
        "support_queries"
    ]
    
    total_deleted = 0
    
    for table_base_name in tables:
        table_name = get_table_name(table_base_name)
        
        # Check if table exists
        try:
            client.describe_table(TableName=table_name)
        except client.exceptions.ResourceNotFoundException:
            logger.info(f"⏭️  Skipping {table_name} (table does not exist)")
            continue
        
        deleted = delete_all_items_from_table(client, table_name)
        total_deleted += deleted
        logger.info("")
    
    logger.info("=" * 60)
    logger.info(f"✅ CLEANUP COMPLETE!")
    logger.info(f"   Total items deleted: {total_deleted}")
    logger.info("=" * 60)
    logger.info("")
    logger.info("💡 You can now start fresh with mobile-based authentication!")
    logger.info("   Run: python scripts/init_dynamodb.py (if needed)")
    logger.info("   Then register new users with mobile numbers.")


if __name__ == "__main__":
    try:
        cleanup_all_data()
    except KeyboardInterrupt:
        logger.info("\n\n❌ Cleanup interrupted by user. Some data may have been deleted.")
        sys.exit(1)
    except Exception as e:
        logger.error(f"\n\n❌ Error during cleanup: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

