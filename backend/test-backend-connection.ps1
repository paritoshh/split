# Test if backend is accessible
Write-Host "Testing backend connection..." -ForegroundColor Cyan

# Test health endpoint
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8002/health" -Method GET -TimeoutSec 5
    Write-Host "Backend is running on port 8002" -ForegroundColor Green
    Write-Host "Response: $($response.Content)" -ForegroundColor Gray
} catch {
    Write-Host "Backend is NOT accessible on port 8002" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To start the backend:" -ForegroundColor Cyan
    Write-Host "   cd backend" -ForegroundColor White
    Write-Host "   uvicorn app.main:app --reload --host 0.0.0.0 --port 8002" -ForegroundColor White
}

# Test if port is in use
Write-Host ""
Write-Host "Checking if port 8002 is in use..." -ForegroundColor Cyan
$port = Get-NetTCPConnection -LocalPort 8002 -ErrorAction SilentlyContinue
if ($port) {
    Write-Host "Port 8002 is in use (backend might be running)" -ForegroundColor Green
} else {
    Write-Host "Port 8002 is NOT in use (backend is not running)" -ForegroundColor Red
}

