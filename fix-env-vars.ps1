# Fix Lambda Environment Variables

Write-Host "=== Step 1: Fix ALLOWED_ORIGINS ===" -ForegroundColor Green
Write-Host ""
Write-Host "Current issue: ALLOWED_ORIGINS is set to '*' which doesn't work with credentials" -ForegroundColor Yellow
Write-Host "We need to set specific origins" -ForegroundColor Yellow
Write-Host ""

# Generate a secure SECRET_KEY
Write-Host "Generating secure SECRET_KEY..." -ForegroundColor Yellow
$SECRET_KEY = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
Write-Host "Generated SECRET_KEY: $SECRET_KEY" -ForegroundColor Cyan
Write-Host ""

# Update Lambda environment variables
Write-Host "Updating Lambda environment variables..." -ForegroundColor Yellow
Write-Host ""

$envVars = @{
    DATABASE_TYPE = "dynamodb"
    DYNAMODB_TABLE_PREFIX = "hisab_"
    SECRET_KEY = $SECRET_KEY
    ALLOWED_ORIGINS = "https://hisab.paritoshagarwal.com,http://localhost:5173,capacitor://localhost,http://127.0.0.1:5173"
    DEBUG = "false"
}

# Build the environment string
$envPairs = $envVars.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }
$envString = "{Variables={$($envPairs -join ',')}}"

Write-Host "Command to run:" -ForegroundColor Cyan
Write-Host "aws lambda update-function-configuration --function-name hisab-api --environment `"$envString`"" -ForegroundColor White
Write-Host ""
Write-Host "Or copy this:" -ForegroundColor Cyan
Write-Host $envString -ForegroundColor White
