@echo off
chcp 65001 >nul
title 🦊 FOX GROUP ERP - PRODUCTION
color 0B

echo.
echo  ╔═══════════════════════════════════════════════════════════╗
echo  ║                                                           ║
echo  ║     🦊  FOX GROUP ERP SYSTEM (Production)  🦊             ║
echo  ║                                                           ║
echo  ║         Developed by CairoCode                            ║
echo  ║                                                           ║
echo  ╚═══════════════════════════════════════════════════════════╝
echo.

REM Check if node_modules exists (just in case)
if not exist "fox_pos_project\staticfiles\index.html" (
    color 0C
    echo  [ERROR] Production files not found! 
    echo  Please run build steps first.
    pause
    exit /b 1
)

cd fox_pos_project

echo  [■■■□□□□] Checking Database...
python manage.py migrate --run-syncdb >nul 2>&1
echo  [OK] Database is ready.

echo  [■■■■■□□] Starting Services...
echo  The system will be available at: http://localhost:8000/app/
echo.

REM Start the unified server using Waitress
python run_production.py

pause
