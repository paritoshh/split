# Expense and Group Mapping

## Database Structure

### Expenses Table (`hisab_expenses`)
Each expense record contains:
- `expense_id` (Primary Key) - UUID string
- `group_id` (Optional) - UUID string, references a group
- `paid_by_id` - UUID string, who paid for the expense
- `amount`, `description`, `category`, etc.

**Key Point:** `group_id` is stored directly in the expense record. If `group_id` is `null` or not set, the expense is a personal expense (not tied to any group).

### Groups Table (`hisab_groups`)
Each group record contains:
- `group_id` (Primary Key) - UUID string
- `name`, `description`, `created_by_id`, etc.

### Relationship
- **One-to-Many**: One group can have many expenses
- **Optional**: An expense can exist without a group (personal expense)
- **Direct Reference**: Expenses reference groups via `group_id` field

## How It Works

### 1. Creating an Expense with a Group

**Frontend Flow:**
```
User selects group → formData.group_id = "group-uuid"
User fills expense details → formData.amount, description, etc.
User submits → expenseData = { amount, description, group_id: "group-uuid", ... }
API call → POST /api/expenses/ with expenseData
```

**Backend Flow:**
```
1. Receives ExpenseCreate with group_id
2. Validates group exists: get_group_by_id(group_id)
3. Validates user is member: is_group_member(group_id, user_id)
4. Creates expense: create_expense(..., group_id=str(group_id), ...)
5. Stores in DynamoDB: { expense_id, group_id: "group-uuid", ... }
```

**Database Storage:**
```json
{
  "expense_id": "expense-uuid-123",
  "group_id": "group-uuid-456",  // ← This links expense to group
  "amount": 100.00,
  "description": "Dinner",
  "paid_by_id": "user-uuid-789",
  ...
}
```

### 2. Querying Expenses by Group

**To get all expenses in a group:**
```python
# Backend query
get_group_expenses(group_id)
# DynamoDB query uses GSI: group_id-index
# Returns all expenses where group_id = "group-uuid-456"
```

**DynamoDB Query:**
```
Table: hisab_expenses
Index: group_id-index
KeyCondition: group_id = "group-uuid-456"
Filter: is_active = true
```

### 3. Why group_id Might Be Null

**Possible Reasons:**
1. **Frontend not sending it**: `group_id` is `null` or empty in the request
2. **Race condition**: Groups haven't loaded when form is submitted
3. **User selected "No group"**: Intentionally creating a personal expense
4. **Backend filtering**: `group_id` is `None` and gets filtered out before saving

**Current Issue:**
The frontend might be sending `group_id: null` instead of omitting it or sending the actual UUID.

## Current Code Flow

### Frontend (AddExpensePage.jsx)
```javascript
// Line 266: Get group_id from URL or formData
const finalGroupId = preSelectedGroup ? String(preSelectedGroup) : formData.group_id

// Line 297: Use groupIdToUse parameter
const groupIdRaw = groupIdToUse || formData.group_id || preSelectedGroup

// Line 311: Add to expenseData if valid
if (groupIdValue !== '' && groupIdValue !== 'null' && groupIdValue !== 'undefined') {
  expenseData.group_id = groupIdValue
}
```

### Backend (expenses.py)
```python
# Line 50: Check if group_id provided
if expense_data.group_id:
    # Validate group exists
    group = db_service.get_group_by_id(str(expense_data.group_id))
    
# Line 118: Pass to create_expense
group_id=str(expense_data.group_id) if expense_data.group_id else None
```

### Database (dynamodb_service.py)
```python
# Line 754: Store group_id
"group_id": str(group_id) if group_id else None

# Line 762: Remove None values
item = {k: v for k, v in item.items() if v is not None}
# If group_id is None, it gets removed (expense has no group)
```

## Debugging Steps

1. **Check Frontend Console:**
   - Look for "🔍 Group ID Debug" logs
   - Check "Expense data after cleanup" - should show `group_id` if set

2. **Check Network Tab:**
   - POST request to `/api/expenses/`
   - Request payload should have `group_id` as string (not null)

3. **Check Backend Logs:**
   - Look for "Creating expense - group_id received: ..."
   - Look for "Final group_id to save: ..."

4. **Check Database:**
   - Query `hisab_expenses` table
   - Check if `group_id` field exists and has value

## Fix for Null group_id

The issue is likely in the frontend - `group_id` is being sent as `null` instead of being omitted or having a value. The cleanup code should remove it, but if it's explicitly set to `null` in the JSON, it might still be sent.

**Solution:** Ensure the frontend never includes `group_id` in the request if it's null/empty.

