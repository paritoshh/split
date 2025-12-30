# Create DynamoDB tables in AWS
# This script creates all required tables for the Hisab app

$AWS_REGION = "ap-south-1"
$TABLE_PREFIX = "hisab_"

Write-Host "=== Creating DynamoDB Tables in AWS ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Region: $AWS_REGION" -ForegroundColor Gray
Write-Host "Table Prefix: $TABLE_PREFIX" -ForegroundColor Gray
Write-Host ""

# Function to create a table
function Create-DynamoDBTable {
    param(
        [string]$TableName,
        [string]$TableDefinition
    )
    
    $fullName = "$TABLE_PREFIX$TableName"
    Write-Host "Creating table: $fullName..." -ForegroundColor Yellow
    
    # Check if table exists
    $existingTable = aws dynamodb describe-table --table-name $fullName --region $AWS_REGION 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Table already exists: $fullName" -ForegroundColor Green
        return
    }
    
    # Create the table
    $result = aws dynamodb create-table `
        --table-name $fullName `
        --cli-input-json $TableDefinition `
        --region $AWS_REGION 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Created: $fullName" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Error creating $fullName" -ForegroundColor Red
        Write-Host "   $result" -ForegroundColor Gray
    }
}

# Users table
Write-Host "1. Creating users table..." -ForegroundColor Yellow
$usersJson = @"
{
    "TableName": "hisab_users",
    "KeySchema": [
        {"AttributeName": "user_id", "KeyType": "HASH"}
    ],
    "AttributeDefinitions": [
        {"AttributeName": "user_id", "AttributeType": "S"},
        {"AttributeName": "email", "AttributeType": "S"}
    ],
    "GlobalSecondaryIndexes": [
        {
            "IndexName": "email-index",
            "KeySchema": [{"AttributeName": "email", "KeyType": "HASH"}],
            "Projection": {"ProjectionType": "ALL"}
        }
    ],
    "BillingMode": "PAY_PER_REQUEST"
}
"@
aws dynamodb create-table --cli-input-json $usersJson --region $AWS_REGION 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Created: hisab_users" -ForegroundColor Green
} else {
    $check = aws dynamodb describe-table --table-name hisab_users --region $AWS_REGION 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Already exists: hisab_users" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Error creating hisab_users" -ForegroundColor Red
    }
}

# Groups table
Write-Host "2. Creating groups table..." -ForegroundColor Yellow
$groupsJson = @"
{
    "TableName": "hisab_groups",
    "KeySchema": [
        {"AttributeName": "group_id", "KeyType": "HASH"}
    ],
    "AttributeDefinitions": [
        {"AttributeName": "group_id", "AttributeType": "S"},
        {"AttributeName": "created_by_id", "AttributeType": "S"}
    ],
    "GlobalSecondaryIndexes": [
        {
            "IndexName": "created_by-index",
            "KeySchema": [{"AttributeName": "created_by_id", "KeyType": "HASH"}],
            "Projection": {"ProjectionType": "ALL"}
        }
    ],
    "BillingMode": "PAY_PER_REQUEST"
}
"@
aws dynamodb create-table --cli-input-json $groupsJson --region $AWS_REGION 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Created: hisab_groups" -ForegroundColor Green
} else {
    $check = aws dynamodb describe-table --table-name hisab_groups --region $AWS_REGION 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Already exists: hisab_groups" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Error creating hisab_groups" -ForegroundColor Red
    }
}

# Group members table
Write-Host "3. Creating group_members table..." -ForegroundColor Yellow
$groupMembersJson = @"
{
    "TableName": "hisab_group_members",
    "KeySchema": [
        {"AttributeName": "group_id", "KeyType": "HASH"},
        {"AttributeName": "user_id", "KeyType": "RANGE"}
    ],
    "AttributeDefinitions": [
        {"AttributeName": "group_id", "AttributeType": "S"},
        {"AttributeName": "user_id", "AttributeType": "S"}
    ],
    "GlobalSecondaryIndexes": [
        {
            "IndexName": "user_id-index",
            "KeySchema": [{"AttributeName": "user_id", "KeyType": "HASH"}],
            "Projection": {"ProjectionType": "ALL"}
        }
    ],
    "BillingMode": "PAY_PER_REQUEST"
}
"@
aws dynamodb create-table --cli-input-json $groupMembersJson --region $AWS_REGION 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Created: hisab_group_members" -ForegroundColor Green
} else {
    $check = aws dynamodb describe-table --table-name hisab_group_members --region $AWS_REGION 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Already exists: hisab_group_members" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Error creating hisab_group_members" -ForegroundColor Red
    }
}

# Expenses table
Write-Host "4. Creating expenses table..." -ForegroundColor Yellow
$expensesJson = @"
{
    "TableName": "hisab_expenses",
    "KeySchema": [
        {"AttributeName": "expense_id", "KeyType": "HASH"}
    ],
    "AttributeDefinitions": [
        {"AttributeName": "expense_id", "AttributeType": "S"},
        {"AttributeName": "group_id", "AttributeType": "S"},
        {"AttributeName": "paid_by_id", "AttributeType": "S"}
    ],
    "GlobalSecondaryIndexes": [
        {
            "IndexName": "group_id-index",
            "KeySchema": [{"AttributeName": "group_id", "KeyType": "HASH"}],
            "Projection": {"ProjectionType": "ALL"}
        },
        {
            "IndexName": "paid_by-index",
            "KeySchema": [{"AttributeName": "paid_by_id", "KeyType": "HASH"}],
            "Projection": {"ProjectionType": "ALL"}
        }
    ],
    "BillingMode": "PAY_PER_REQUEST"
}
"@
aws dynamodb create-table --cli-input-json $expensesJson --region $AWS_REGION 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Created: hisab_expenses" -ForegroundColor Green
} else {
    $check = aws dynamodb describe-table --table-name hisab_expenses --region $AWS_REGION 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Already exists: hisab_expenses" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Error creating hisab_expenses" -ForegroundColor Red
    }
}

# Expense splits table
Write-Host "5. Creating expense_splits table..." -ForegroundColor Yellow
$expenseSplitsJson = @"
{
    "TableName": "hisab_expense_splits",
    "KeySchema": [
        {"AttributeName": "expense_id", "KeyType": "HASH"},
        {"AttributeName": "user_id", "KeyType": "RANGE"}
    ],
    "AttributeDefinitions": [
        {"AttributeName": "expense_id", "AttributeType": "S"},
        {"AttributeName": "user_id", "AttributeType": "S"}
    ],
    "GlobalSecondaryIndexes": [
        {
            "IndexName": "user_id-index",
            "KeySchema": [{"AttributeName": "user_id", "KeyType": "HASH"}],
            "Projection": {"ProjectionType": "ALL"}
        }
    ],
    "BillingMode": "PAY_PER_REQUEST"
}
"@
aws dynamodb create-table --cli-input-json $expenseSplitsJson --region $AWS_REGION 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Created: hisab_expense_splits" -ForegroundColor Green
} else {
    $check = aws dynamodb describe-table --table-name hisab_expense_splits --region $AWS_REGION 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Already exists: hisab_expense_splits" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Error creating hisab_expense_splits" -ForegroundColor Red
    }
}

# Settlements table
Write-Host "6. Creating settlements table..." -ForegroundColor Yellow
$settlementsJson = @"
{
    "TableName": "hisab_settlements",
    "KeySchema": [
        {"AttributeName": "settlement_id", "KeyType": "HASH"}
    ],
    "AttributeDefinitions": [
        {"AttributeName": "settlement_id", "AttributeType": "S"},
        {"AttributeName": "group_id", "AttributeType": "S"},
        {"AttributeName": "from_user_id", "AttributeType": "S"},
        {"AttributeName": "to_user_id", "AttributeType": "S"}
    ],
    "GlobalSecondaryIndexes": [
        {
            "IndexName": "group_id-index",
            "KeySchema": [{"AttributeName": "group_id", "KeyType": "HASH"}],
            "Projection": {"ProjectionType": "ALL"}
        },
        {
            "IndexName": "from_user-index",
            "KeySchema": [{"AttributeName": "from_user_id", "KeyType": "HASH"}],
            "Projection": {"ProjectionType": "ALL"}
        },
        {
            "IndexName": "to_user-index",
            "KeySchema": [{"AttributeName": "to_user_id", "KeyType": "HASH"}],
            "Projection": {"ProjectionType": "ALL"}
        }
    ],
    "BillingMode": "PAY_PER_REQUEST"
}
"@
aws dynamodb create-table --cli-input-json $settlementsJson --region $AWS_REGION 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Created: hisab_settlements" -ForegroundColor Green
} else {
    $check = aws dynamodb describe-table --table-name hisab_settlements --region $AWS_REGION 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Already exists: hisab_settlements" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Error creating hisab_settlements" -ForegroundColor Red
    }
}

# Notifications table
Write-Host "7. Creating notifications table..." -ForegroundColor Yellow
$notificationsJson = @"
{
    "TableName": "hisab_notifications",
    "KeySchema": [
        {"AttributeName": "user_id", "KeyType": "HASH"},
        {"AttributeName": "notification_id", "KeyType": "RANGE"}
    ],
    "AttributeDefinitions": [
        {"AttributeName": "user_id", "AttributeType": "S"},
        {"AttributeName": "notification_id", "AttributeType": "S"}
    ],
    "BillingMode": "PAY_PER_REQUEST"
}
"@
aws dynamodb create-table --cli-input-json $notificationsJson --region $AWS_REGION 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Created: hisab_notifications" -ForegroundColor Green
} else {
    $check = aws dynamodb describe-table --table-name hisab_notifications --region $AWS_REGION 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Already exists: hisab_notifications" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Error creating hisab_notifications" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Tables are being created. They may take a few seconds to become active." -ForegroundColor Yellow
Write-Host ""
Write-Host "Wait 30 seconds, then test the API:" -ForegroundColor Cyan
Write-Host "   .\deployment\test-after-iam-fix.ps1" -ForegroundColor White

