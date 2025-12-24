📦 ملفات الـ Backup المتاحة:
| الملف | الحجم | النوع | |-------|-------|-------| | fox_db_backup.dump | 157 KB | PostgreSQL native (أفضل) | | fox_db_backup.json | 65 KB | Django JSON |

📋 خطوات نقل الـ Database للجهاز التاني:
على الجهاز الجديد:
1️⃣ تثبيت PostgreSQL 18 (نفس الإصدار)

2️⃣ إنشاء قاعدة البيانات:

# افتح psql أو pgAdmin وأنشئ:
CREATE USER fox_admin WITH PASSWORD 'Ebnb@t0t@';
CREATE DATABASE fox_db OWNER fox_admin;
CREATE SCHEMA fox_system AUTHORIZATION fox_admin;
3️⃣ استعادة البيانات:

"C:\Program Files\PostgreSQL\18\bin\pg_restore.exe" -h localhost -p 5444 -U fox_admin -d fox_db fox_db_backup.dump
4️⃣ شغل التطبيق:

start.bat