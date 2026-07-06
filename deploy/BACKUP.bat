@echo off
cd /d "%~dp0.."
powershell -ExecutionPolicy Bypass -File ".\deploy\backup.ps1"
pause