@echo off
cd /d "%~dp0"
start "" cmd /k "npm run dev -- -p 3006"
timeout /t 3 >nul
start "" "http://localhost:3006"
