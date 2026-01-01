# Check if local setup is configured correctly

Write-Host "=== Checking Local Development Setup ===" -ForegroundColor Cyan
Write-Host ""

# Check if .env file exists
Write-Host "1. Checking backend .env file..." -ForegroundColor Yellow
if (Test-Path "backend\.env") {
    Write-Host "   ✅ .env file exists" -ForegroundColor Green
    
    # Read .env file
    $envContent = Get-Content "backend\.env" -Raw
    
    # Check for DynamoDB endpoint
    if ($envContent -match "DYNAMODB_ENDPOINT_URL") {
        $endpointLine = ($envContent -split "`n" | Where-Object { $_ -match "DYNAMODB_ENDPOINT_URL" })
        Write-Host "   $endpointLine" -ForegroundColor Gray
        
        if ($endpointLine -match "http://localhost:8000") {
            Write-Host "   ✅ Using DynamoDB Local (correct for local dev)" -ForegroundColor Green
        } elseif ($endpointLine -match "DYNAMODB_ENDPOINT_URL=" -and $endpointLine -notmatch "http://") {
            Write-Host "   ⚠️  DYNAMODB_ENDPOINT_URL is empty or not set!" -ForegroundColor Red
            Write-Host "   ❌ This means you're connecting to AWS DynamoDB (slow!)" -ForegroundColor Red
            Write-Host "   Fix: Set DYNAMODB_ENDPOINT_URL=http://localhost:8000 in backend/.env" -ForegroundColor Yellow
        } else {
            Write-Host "   ⚠️  Using custom endpoint: $endpointLine" -ForegroundColor Yellow
        }
    } else {
        Write-Host "   ⚠️  DYNAMODB_ENDPOINT_URL not found in .env" -ForegroundColor Red
        Write-Host "   ❌ This means you're connecting to AWS DynamoDB (slow!)" -ForegroundColor Red
    }
    
    # Check DATABASE_TYPE
    if ($envContent -match "DATABASE_TYPE=dynamodb") {
        Write-Host "   ✅ DATABASE_TYPE is dynamodb" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  DATABASE_TYPE might not be set to dynamodb" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ❌ .env file NOT found in backend/" -ForegroundColor Red
    Write-Host "   Fix: copy backend/env.dynamodb.local.example to backend/.env" -ForegroundColor Yellow
}

Write-Host ""

# Check if DynamoDB Local is running
Write-Host "2. Checking DynamoDB Local..." -ForegroundColor Yellow
$dockerStatus = docker ps --filter "name=hisab-dynamodb" --format "{{.Status}}" 2>&1
if ($LASTEXITCODE -eq 0 -and $dockerStatus) {
    Write-Host "   ✅ DynamoDB Local is running" -ForegroundColor Green
    Write-Host "   Status: $dockerStatus" -ForegroundColor Gray
} else {
    Write-Host "   ❌ DynamoDB Local is NOT running" -ForegroundColor Red
    Write-Host "   Fix: Run 'docker-compose up -d' in project root" -ForegroundColor Yellow
}

Write-Host ""

# Check frontend API URL
Write-Host "3. Checking frontend API configuration..." -ForegroundColor Yellow
$viteConfig = Get-Content "frontend/vite.config.js" -Raw 2>&1
if ($viteConfig) {
    if ($viteConfig -match "proxy.*127.0.0.1:8000" -or $viteConfig -match "proxy.*localhost:8000") {
        Write-Host "   ✅ Frontend is configured to use local backend proxy" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Frontend proxy might not be configured correctly" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ⚠️  Could not read vite.config.js" -ForegroundColor Yellow
}

Write-Host ""

# Check backend server
Write-Host "4. Checking if backend is running..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:8000/health" -TimeoutSec 2 -ErrorAction Stop
    Write-Host "   ✅ Backend is running on http://127.0.0.1:8000" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Backend is NOT running on http://127.0.0.1:8000" -ForegroundColor Red
    Write-Host "   Fix: Start backend with 'uvicorn app.main:app --reload --host 0.0.0.0'" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host "If you see ❌ errors above, that's likely causing the slowness/timeouts." -ForegroundColor Yellow
Write-Host ""
Write-Host "Common issues:" -ForegroundColor Yellow
Write-Host "1. DYNAMODB_ENDPOINT_URL not set → Connecting to AWS (slow!)" -ForegroundColor Gray
Write-Host "2. DynamoDB Local not running → Backend can't connect" -ForegroundColor Gray
Write-Host "3. Frontend pointing to AWS → All requests go to AWS (slow!)" -ForegroundColor Gray
Write-Host "4. Backend not running → Frontend can't connect" -ForegroundColor Gray

