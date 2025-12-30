# How to Run Lambda Deployment on Windows

## Problem
Windows might open `.ps1` files in Notepad instead of executing them.

## Solution: Run PowerShell Scripts Properly

### Option 1: Run from PowerShell (Recommended)

1. Open **PowerShell** (not Command Prompt)
   - Press `Win + X` → Select "Windows PowerShell" or "Terminal"
   - Or search for "PowerShell" in Start menu

2. Navigate to your project:
   ```powershell
   cd D:\Paritosh\projects\split\split
   ```

3. Run the script:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\deployment\build-lambda-docker.ps1
   ```

### Option 2: Change Execution Policy (One-time setup)

If you get "execution of scripts is disabled" error:

1. Open PowerShell as Administrator:
   - Right-click PowerShell → "Run as Administrator"

2. Run this command:
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

3. Then you can run scripts normally:
   ```powershell
   cd D:\Paritosh\projects\split\split
   .\deployment\build-lambda-docker.ps1
   ```

### Option 3: Right-click Method

1. Right-click on `build-lambda-docker.ps1`
2. Select "Run with PowerShell"

---

## Quick Commands

```powershell
# Navigate to project
cd D:\Paritosh\projects\split\split

# Pull latest code
git pull

# Run deployment (choose one method above)
powershell -ExecutionPolicy Bypass -File .\deployment\build-lambda-docker.ps1
```

---

## Expected Output

You should see:
```
========================================
  Building Lambda Package (Docker)
========================================

Checking Docker...
✅ Docker is running

Cleaning up old files...

Building Lambda package in Docker (this may take 2-5 minutes)...
[This will show Docker build output]

✅ Package created: XX.XX MB

🚀 Uploading to Lambda...
✅ Lambda function updated successfully!

✅ Lambda deployment complete!
```

---

## Troubleshooting

### "Docker is not running"
- Open Docker Desktop
- Wait until it shows "Docker Desktop is running"

### "execution of scripts is disabled"
- Use Option 2 above to change execution policy

### "File opens in Notepad"
- Make sure you're in PowerShell, not Command Prompt
- Use `powershell -ExecutionPolicy Bypass -File` command

