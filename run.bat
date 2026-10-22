@echo off
setlocal
title Personal Expense Analysis and Prediction System - Launcher
set "ROOT=%~dp0"
cd /d "%ROOT%"

echo =========================================================
echo   Personal Expense Analysis and Prediction System
echo =========================================================
echo.

rem ---- Prerequisites ----
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found. Install it from https://nodejs.org, then run install.bat.
  goto :fail
)
if not exist "%ROOT%backend\node_modules\express" (
  echo [ERROR] Backend dependencies are missing. Run install.bat first.
  goto :fail
)
if not exist "%ROOT%backend\.env" copy /y "%ROOT%backend\.env.example" "%ROOT%backend\.env" >nul

rem ---- Port checks ----
netstat -ano | findstr /R /C:":5000 .*LISTENING" >nul
if not errorlevel 1 (
  echo [ERROR] Port 5000 is already in use. If the server is already running, use stop.bat first.
  goto :fail
)

rem ---- Start backend server (serves both API and Vanilla Bootstrap frontend) ----
echo Starting Personal Expense Analysis and Prediction System on http://localhost:5000...
start "Personal Expense Server" cmd /k "cd /d "%ROOT%backend" && npm run dev"

rem ---- Wait until the server answers (up to 30 seconds) ----
echo Waiting for the server to become ready...
powershell -NoProfile -Command "$ok=$false; for($i=0;$i -lt 30;$i++){ try{ Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:5000/api/health' -TimeoutSec 2 | Out-Null; $ok=$true; break }catch{ Start-Sleep -Seconds 1 } }; if($ok){exit 0}else{exit 1}"
if errorlevel 1 (
  echo [ERROR] The server did not respond within 30 seconds. Check the "Personal Expense Server" window for errors.
  goto :fail
)

echo.
echo =========================================================
echo   Application Ready!
echo   Web Interface : http://localhost:5000
echo   REST API      : http://localhost:5000/api
echo   Health Status : http://localhost:5000/api/health
echo =========================================================
echo.
echo Opening your browser to http://localhost:5000.
echo To stop the application at any time, run stop.bat.
echo.

start "" "http://localhost:5000"
exit /b 0

:fail
echo.
pause
exit /b 1
