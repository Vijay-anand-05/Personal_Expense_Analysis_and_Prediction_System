@echo off
setlocal
title Personal Expense Analysis and Prediction System - Stop
set "ROOT=%~dp0"

echo ============================================
echo   Personal Expense Analysis and Prediction System - Stopping servers
echo ============================================
echo.
echo Looks for whatever is listening on ports 5000 (backend) and 5173 (frontend) and
echo stops it ONLY if it was started by this project's run.bat. Other Node.js
echo processes are left alone.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%scripts\stop-servers.ps1" -Root "%ROOT:~0,-1%"
set "RC=%errorlevel%"

echo.
if "%RC%"=="0" (
  echo Done.
) else (
  echo Finished with warnings - see the messages above.
)
pause
exit /b %RC%
