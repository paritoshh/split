# Test login endpoint directly

param(
    [Parameter(Mandatory=$true)]
    [string]$Email,
    
    [Parameter(Mandatory=$true)]
    [string]$Password
)

$API_URL = "https://e65w7up0h8.execute-api.ap-south-1.amazonaws.com"

Write-Host "=== Testing Login Endpoint ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Email: $Email" -ForegroundColor Gray
Write-Host "API: $API_URL/api/auth/login" -ForegroundColor Gray
Write-Host ""

# Create form data
$body = @{
    username = $Email
    password = $Password
} | ConvertTo-Json

Write-Host "Sending request..." -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest `
        -Uri "$API_URL/api/auth/login" `
        -Method POST `
        -ContentType "application/x-www-form-urlencoded" `
        -Body "username=$Email&password=$Password" `
        -ErrorAction Stop
    
    Write-Host ""
    Write-Host "✅ Success: $($response.StatusCode)" -ForegroundColor Green
    Write-Host ""
    Write-Host "Response:" -ForegroundColor Yellow
    $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
} catch {
    Write-Host ""
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host ""
        Write-Host "Response body:" -ForegroundColor Yellow
        Write-Host $responseBody
    }
    
    Write-Host ""
    Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Next Steps ===" -ForegroundColor Cyan
Write-Host "If you got a 500 error, check Lambda logs:" -ForegroundColor Yellow
Write-Host "  .\deployment\check-login-error.ps1" -ForegroundColor Gray

