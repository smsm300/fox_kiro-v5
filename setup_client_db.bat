@echo off
chcp 65001 >nul
title 🛠️ FOX ERP - Database Setup
color 0E

echo.
echo  ╔═══════════════════════════════════════════════════════════╗
echo  ║                                                           ║
echo  ║     🦊  FOX GROUP ERP - DATABASE SETUP  🦊                ║
echo  ║                                                           ║
echo  ╚═══════════════════════════════════════════════════════════╝
echo.

set DB_NAME=fox_db
set DB_USER=fox_admin
set DB_PASS=Ebnb@t0t@
set DB_PORT=5444

echo  [1/4] Checking PostgreSQL Connection...
python -c "import psycopg2; conn = psycopg2.connect(dbname='postgres', user='%DB_USER%', password='%DB_PASS%', host='localhost', port='%DB_PORT%'); conn.close()" 2>nul
if errorlevel 1 (
    echo  [ERROR] Cannot connect to PostgreSQL. 
    echo  Please ensure PostgreSQL is running on port %DB_PORT% and user '%DB_USER%' exists.
    pause
    exit /b 1
)
echo  [OK] Connection successful.

echo.
echo  [2/4] Recreating Database '%DB_NAME%'...
python -c "import psycopg2; from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT; conn = psycopg2.connect(dbname='postgres', user='%DB_USER%', password='%DB_PASS%', host='localhost', port='%DB_PORT%'); conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT); cur = conn.cursor(); cur.execute('DROP DATABASE IF EXISTS %DB_NAME%'); cur.execute('CREATE DATABASE %DB_NAME%'); cur.close(); conn.close()"
echo  [OK] Database %DB_NAME% created.

echo.
echo  [3/4] Running Django Migrations...
cd fox_pos_project
python manage.py migrate
echo  [OK] Tables and Schemas created.

echo.
echo  [4/4] Importing Data from Backup...
if exist "../fox_db_backup.json" (
    python manage.py loaddata ../fox_db_backup.json
    echo  [OK] Data imported successfully.
) else (
    echo  [WARNING] Backup file 'fox_db_backup.json' not found. Skipping data import.
)

echo.
echo  [EXTRA] Setting up Database Triggers and Views...
python scripts/setup_db_extras.py
echo  [OK] Database Logic setup complete.

echo.
echo  ✅ DATABASE SETUP FINISHED!
echo.
pause
