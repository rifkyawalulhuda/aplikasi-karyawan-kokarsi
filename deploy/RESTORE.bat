@echo off
cd /d "%~dp0.."
powershell -ExecutionPolicy Bypass -File ".\deploy\restore.ps1"
pause