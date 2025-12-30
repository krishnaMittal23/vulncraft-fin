@echo off
REM VulnCraft OWASP Integration Startup Script
REM This script starts all required services for OWASP integration testing

echo.
echo 🛡️ VulnCraft OWASP Integration Startup
echo ====================================
echo.

REM Check if Docker is running
echo 📦 Checking Docker status...
docker version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not running or not installed!
    echo Please start Docker Desktop and try again.
    pause
    exit /b 1
)
echo ✅ Docker is running

REM Navigate to services directory and start containers
echo.
echo 🚀 Starting Docker services...
cd /d "%~dp0\..\services"
docker-compose down >nul 2>&1
docker-compose up -d

if %errorlevel% neq 0 (
    echo ❌ Failed to start Docker services!
    pause
    exit /b 1
)

echo ✅ Docker services started

REM Wait for services to be ready
echo.
echo ⏳ Waiting for services to initialize...
timeout /t 10 /nobreak >nul

REM Check if ZAP is responding
echo.
echo 🔍 Testing OWASP ZAP connection...
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:8080/JSON/core/view/version/' -TimeoutSec 5; Write-Host '✅ OWASP ZAP is responding' } catch { Write-Host '❌ OWASP ZAP is not responding yet' }"

REM Install Python dependencies if needed
echo.
echo 🐍 Checking Python dependencies...
if exist requirements.txt (
    pip install -r requirements.txt >nul 2>&1
    if %errorlevel% equ 0 (
        echo ✅ Python dependencies installed
    ) else (
        echo ⚠️ Some Python dependencies may not have installed correctly
    )
)

REM Start Django development server
echo.
echo 🌐 Starting Django development server...
start "Django Server" cmd /k "python manage.py runserver 8000"
timeout /t 3 /nobreak >nul

REM Navigate to backend and start Node.js server
echo.
echo ⚙️ Starting Node.js backend server...
cd /d "%~dp0\..\backend"
if exist package.json (
    start "Node.js Backend" cmd /k "npm run dev"
    timeout /t 3 /nobreak >nul
    echo ✅ Node.js backend starting...
) else (
    echo ⚠️ Backend package.json not found, skipping Node.js server
)

REM Navigate to frontend and start React development server
echo.
echo 🎨 Starting React frontend development server...
cd /d "%~dp0\..\frontend"
if exist package.json (
    start "React Frontend" cmd /k "npm run dev"
    timeout /t 3 /nobreak >nul
    echo ✅ React frontend starting...
) else (
    echo ⚠️ Frontend package.json not found, skipping React server
)

echo.
echo 🎉 All services are starting up!
echo ================================
echo.
echo 📋 Service URLs:
echo    - Django Backend:    http://localhost:8000
echo    - Node.js Backend:   http://localhost:3000  
echo    - React Frontend:    http://localhost:5173
echo    - OWASP ZAP:         http://localhost:8080
echo.
echo 🧪 To test the integration:
echo    cd scripts
echo    python test_owasp_integration.py
echo.
echo 📚 Available OWASP Node Types:
echo    - owasp-vulnerabilities (Comprehensive OWASP assessment)
echo    - owasp-zap (Full ZAP scan with active scanning)
echo    - owasp-baseline (Fast passive scan)
echo    - owasp-dependency-check (CVE dependency analysis)
echo.
echo ⏳ Please wait a few minutes for all services to fully initialize...
echo Press any key to continue...
pause >nul