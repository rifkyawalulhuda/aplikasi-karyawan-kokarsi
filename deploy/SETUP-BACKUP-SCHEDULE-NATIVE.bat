@echo off
echo ============================================================
echo  Setup Jadwal Backup Otomatis - Kokarsi PT. Sankyu (Native)
echo ============================================================
echo.
echo Script ini akan mendaftarkan backup otomatis ke Windows Task Scheduler.
echo Backup akan berjalan setiap hari jam 02:00 WIB.
echo.

:: Cek apakah dijalankan sebagai Administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo GAGAL: Script ini harus dijalankan sebagai Administrator!
    echo.
    echo Caranya:
    echo   1. Klik kanan pada file SETUP-BACKUP-SCHEDULE-NATIVE.bat
    echo   2. Pilih "Run as administrator"
    echo.
    pause
    exit /b 1
)

echo Untuk custom jam atau folder backup, jalankan manual:
echo   .\deploy\setup-backup-schedule.ps1 -Mode native -Hour 3 -BackupDir "C:\Backup\kokarsi"
echo.
pause

cd /d "%~dp0.."
powershell -ExecutionPolicy Bypass -File ".\deploy\setup-backup-schedule.ps1" -Mode native -BackupDir "C:\Backup\kokarsi"
pause


cd /d "%~dp0.."
powershell -ExecutionPolicy Bypass -File ".\deploy\setup-backup-schedule.ps1" -Mode native -BackupDir "C:\Backup\kokarsi"
pause
