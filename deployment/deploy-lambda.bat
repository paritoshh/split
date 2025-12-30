@echo off
REM ===========================================
REM DEPLOY LAMBDA - Windows Batch File
REM ===========================================
REM Double-click this file to deploy Lambda
REM ===========================================

echo ========================================
echo   HISAB - Lambda Deployment
echo ========================================
echo.

REM Change to project directory
cd /d "%~dp0.."

REM Run PowerShell script
powershell -ExecutionPolicy Bypass -File "%~dp0build-lambda-docker.ps1"

REM Keep window open if there was an error
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Deployment failed! Check the error above.
    pause
)

