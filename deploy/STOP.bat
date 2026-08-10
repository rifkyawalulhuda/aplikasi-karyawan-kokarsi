@echo off
cd /d "%~dp0.."
powershell -ExecutionPolicy Bypass -File ".\deploy\start.ps1" -Stop -KeepPostgres
pause