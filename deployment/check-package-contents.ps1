# Check what's actually in the Lambda deployment package

Write-Host "=== Checking Lambda Package Contents ===" -ForegroundColor Cyan
Write-Host ""

$zipFile = "lambda_deployment.zip"

if (-not (Test-Path $zipFile)) {
    Write-Host "❌ Package file not found: $zipFile" -ForegroundColor Red
    Write-Host "Run build script first: .\deployment\build-lambda-docker.ps1" -ForegroundColor Yellow
    exit 1
}

Write-Host "Checking package: $zipFile" -ForegroundColor Yellow
Write-Host ""

# Extract and check for bcrypt
$tempDir = "temp-package-check"
if (Test-Path $tempDir) {
    Remove-Item -Recurse -Force $tempDir
}
New-Item -ItemType Directory -Path $tempDir | Out-Null

# Extract zip
Expand-Archive -Path $zipFile -DestinationPath $tempDir -Force

Write-Host "=== Looking for bcrypt ===" -ForegroundColor Cyan

# Check for bcrypt directory
$bcryptDirs = Get-ChildItem -Path $tempDir -Filter "*bcrypt*" -Directory -Recurse -ErrorAction SilentlyContinue
if ($bcryptDirs) {
    Write-Host "✅ Found bcrypt directories:" -ForegroundColor Green
    foreach ($dir in $bcryptDirs) {
        Write-Host "   $($dir.FullName.Replace((Get-Location).Path + '\' + $tempDir + '\', ''))" -ForegroundColor Cyan
    }
} else {
    Write-Host "❌ No bcrypt directory found!" -ForegroundColor Red
}

# Check for bcrypt files
$bcryptFiles = Get-ChildItem -Path $tempDir -Filter "*bcrypt*" -File -Recurse -ErrorAction SilentlyContinue
if ($bcryptFiles) {
    Write-Host ""
    Write-Host "✅ Found bcrypt files:" -ForegroundColor Green
    foreach ($file in $bcryptFiles | Select-Object -First 5) {
        Write-Host "   $($file.FullName.Replace((Get-Location).Path + '\' + $tempDir + '\', ''))" -ForegroundColor Cyan
    }
    if ($bcryptFiles.Count -gt 5) {
        Write-Host "   ... and $($bcryptFiles.Count - 5) more" -ForegroundColor Gray
    }
} else {
    Write-Host "❌ No bcrypt files found!" -ForegroundColor Red
}

# Check for passlib
Write-Host ""
Write-Host "=== Looking for passlib ===" -ForegroundColor Cyan
$passlibDirs = Get-ChildItem -Path $tempDir -Filter "*passlib*" -Directory -Recurse -ErrorAction SilentlyContinue
if ($passlibDirs) {
    Write-Host "✅ Found passlib:" -ForegroundColor Green
    foreach ($dir in $passlibDirs) {
        Write-Host "   $($dir.FullName.Replace((Get-Location).Path + '\' + $tempDir + '\', ''))" -ForegroundColor Cyan
    }
} else {
    Write-Host "❌ No passlib found!" -ForegroundColor Red
}

# Cleanup
Remove-Item -Recurse -Force $tempDir

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
if ($bcryptDirs -or $bcryptFiles) {
    Write-Host "✅ bcrypt appears to be in the package" -ForegroundColor Green
    Write-Host "If Lambda still fails, the issue might be with how passlib finds bcrypt" -ForegroundColor Yellow
} else {
    Write-Host "❌ bcrypt is NOT in the package!" -ForegroundColor Red
    Write-Host "The Docker build is not including bcrypt properly." -ForegroundColor Yellow
}

