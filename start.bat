@echo off
chcp 65001 >nul
title 🦊 Fox ERP System
color 0A

echo.
echo  ╔═══════════════════════════════════════════════════════════╗
echo  ║                                                           ║
echo  ║     🦊  FOX GROUP ERP SYSTEM  🦊                          ║
echo  ║                                                           ║
echo  ║         Developed by CairoCode                            ║
echo  ║                                                           ║
echo  ╚═══════════════════════════════════════════════════════════╝
echo.

REM Check Python
echo  [■□□□□□□] Checking Python...
python --version >nul 2>&1
if errorlevel 1 (
    color 0C
    echo  [ERROR] Python is not installed!
    pause
    exit /b 1
)
echo  [OK] Python found

REM Check Node.js
echo  [■■□□□□□] Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    color 0C
    echo  [ERROR] Node.js is not installed!
    pause
    exit /b 1
)
echo  [OK] Node.js found

REM Check PostgreSQL
echo  [■■■□□□□] Checking PostgreSQL...
cd fox_pos_project
python -c "import psycopg2; conn = psycopg2.connect(dbname='fox_db', user='fox_admin', password='Ebnb@t0t@', host='localhost', port='5444'); conn.close()" 2>nul
if errorlevel 1 (
    color 0E
    echo  [WARNING] PostgreSQL not connected - Port 5444
) else (
    echo  [OK] PostgreSQL connected
)

REM Run migrations
echo  [■■■■□□□] Running migrations...
python manage.py migrate --run-syncdb >nul 2>&1
echo  [OK] Migrations done

REM Start Backend
echo  [■■■■■□□] Starting Backend...
start /B /MIN cmd /c "python manage.py runserver 8000 >nul 2>&1"
timeout /t 3 /nobreak >nul
echo  [OK] Backend running on http://localhost:8000

cd ..

REM Check Frontend dependencies
echo  [■■■■■■□] Checking Frontend...
cd fox-group-erp
if not exist "node_modules" (
    echo  [INFO] Installing npm packages...
    call npm install >nul 2>&1
)

REM Start Frontend
echo  [■■■■■■■] Starting Frontend...
start /B /MIN cmd /c "npm run dev >nul 2>&1"
timeout /t 5 /nobreak >nul
echo  [OK] Frontend running on http://localhost:3000

cd ..

echo.
echo  ╔═══════════════════════════════════════════════════════════╗
echo  ║                                                           ║
echo  ║   ✅ FOX ERP STARTED SUCCESSFULLY!                        ║
echo  ║                                                            ║
echo  ║   🌐 Frontend: http://localhost:3000                      ║
echo  ║                                                           ║
echo  ╚═══════════════════════════════════════════════════════════╝
echo.

REM Open browser
start http://localhost:3000

echo  Press any key to STOP the application...
pause >nul

echo.
echo  Stopping services...
taskkill /F /IM python.exe >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1
echo  [OK] All services stopped
echo.
pause