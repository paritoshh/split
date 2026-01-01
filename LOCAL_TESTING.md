# Local Testing Guide

## Prerequisites
- Python 3.11+ installed
- Node.js and npm installed
- Docker Desktop running (for DynamoDB Local)

## Step 1: Pull Latest Code
```bash
cd D:\Paritosh\projects\split\split
git pull
```

## Step 2: Start DynamoDB Local
```bash
# Make sure Docker Desktop is running
docker-compose up -d

# Verify it's running
# Open http://localhost:8001 in browser (DynamoDB Admin UI)
```

## Step 3: Setup Backend
```bash
cd backend

# Create virtual environment (if not exists)
python -m venv venv

# Activate virtual environment
# On Windows PowerShell:
.\venv\Scripts\Activate.ps1
# On Windows CMD:
# venv\Scripts\activate.bat

# Install dependencies
pip install -r requirements.txt

# Copy environment file
copy env.dynamodb.local.example .env

# Initialize DynamoDB tables
python scripts/init_dynamodb.py
```

## Step 4: Start Backend Server
```bash
# Make sure you're in backend directory with venv activated
uvicorn app.main:app --reload --host 0.0.0.0

# Backend will run on http://127.0.0.1:8000
# API docs: http://127.0.0.1:8000/docs
```

## Step 5: Setup Frontend (in a new terminal)
```bash
cd frontend

# Install dependencies (if not already done)
npm install

# Start dev server
npm run dev

# Frontend will run on http://localhost:5173
# Or http://127.0.0.1:5173
```

## Step 6: Test Expense Creation

1. **Open the app**: http://localhost:5173 or http://127.0.0.1:5173

2. **Login or Register** a test user

3. **Create a Group** (optional, for testing group expenses)

4. **Create an Expense**:
   - Click "Add Expense" or navigate to `/add-expense`
   - Fill in amount, description
   - **Test without group**: Leave "Group" dropdown as "No group"
   - **Test with group**: Select a group from dropdown
   - Fill in other details and submit

5. **Check Browser Console** (F12):
   - Look for console logs:
     - "Expense data being sent" (before cleanup)
     - "Expense data after cleanup" (after removing nulls)
     - "Has group_id?" (should be false if no group selected)

6. **Check Network Tab**:
   - Open Network tab in DevTools
   - Find the POST request to `/api/expenses/`
   - Click on it and check "Payload" or "Request" tab
   - Verify that `group_id` is **NOT** in the request if no group was selected
   - Verify that `group_id` **IS** in the request (as a string) if a group was selected

## Troubleshooting

### Backend not starting
- Check if port 8000 is already in use
- Make sure DynamoDB Local is running (`docker-compose ps`)
- Check backend logs for errors

### Frontend not connecting to backend
- Check `frontend/vite.config.js` - proxy should point to `http://127.0.0.1:8000`
- Check browser console for CORS errors
- Verify backend is running on port 8000

### group_id still showing as null
- Check browser console logs to see what `formData.group_id` value is
- Check if the cleanup code is running (look for "Expense data after cleanup" log)
- Verify the latest code is pulled and frontend is restarted

### DynamoDB errors
- Make sure Docker is running
- Restart DynamoDB: `docker-compose restart`
- Reinitialize tables: `python scripts/init_dynamodb.py`

## Quick Test Checklist

- [ ] Backend running on http://127.0.0.1:8000
- [ ] Frontend running on http://localhost:5173
- [ ] DynamoDB Local running (docker-compose up -d)
- [ ] Can login/register
- [ ] Can create expense without group (check group_id is NOT in request)
- [ ] Can create expense with group (check group_id IS in request as string)
- [ ] Console logs show cleanup working
- [ ] Network tab shows correct request payload

