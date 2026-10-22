@echo off
setlocal
title Personal Expense Analysis and Prediction System - Install
set "ROOT=%~dp0"
cd /d "%ROOT%"

echo ============================================
echo   Personal Expense Analysis and Prediction System - Installation
echo ============================================
echo.

rem ---- 1. Prerequisites ----
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found. Install the LTS version from https://nodejs.org and run install.bat again.
  goto :fail
)
where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm was not found. Reinstall Node.js from https://nodejs.org.
  goto :fail
)
node -e "process.exit(Number(process.versions.node.split('.')[0])>=18?0:1)"
if errorlevel 1 (
  echo [ERROR] Node.js 18 or newer is required. Your version:
  node -v
  goto :fail
)
for /f "delims=" %%v in ('node -v') do echo Node.js %%v detected.
for /f "delims=" %%v in ('npm -v') do echo npm %%v detected.
echo.

rem ---- 2. Backend ----
echo [1/4] Installing backend dependencies...
pushd "%ROOT%backend"
call npm install --no-audit --no-fund
if errorlevel 1 (
  popd
  echo [ERROR] Backend dependency installation failed.
  echo         better-sqlite3 normally installs a prebuilt binary. If it tried to compile,
  echo         check your internet connection or install Node.js LTS.
  goto :fail
)

rem ---- 3. Environment file and database ----
echo.
echo [2/4] Preparing configuration and database...
if not exist ".env" (
  copy /y ".env.example" ".env" >nul
  echo Created backend\.env from .env.example
) else (
  echo backend\.env already exists - left unchanged.
)
if not exist "database" mkdir "database"
call node database\init.js
if errorlevel 1 (
  popd
  echo [ERROR] Database initialisation failed.
  goto :fail
)
popd

rem ---- 4. Frontend ----
echo.
echo [3/4] Installing frontend dependencies...
pushd "%ROOT%frontend"
call npm install --no-audit --no-fund
if errorlevel 1 (
  popd
  echo [ERROR] Frontend dependency installation failed.
  goto :fail
)
popd

rem ---- 5. Optional demo data ----
echo.
echo [4/4] Demo data
echo The seed adds about 190 sample expenses over the last 3-4 months. It is skipped
echo automatically if the database already contains expenses (nothing is overwritten).
choice /c YN /t 20 /d Y /m "Load demo data now"
if errorlevel 2 (
  echo Demo data skipped. You can load it later with: cd backend ^&^& npm run seed
) else (
  pushd "%ROOT%backend"
  call node database\seed.js
  popd
)

echo.
echo ============================================
echo   Installation complete.
echo   Start the app with run.bat
echo ============================================
pause
exit /b 0

:fail
echo.
echo Installation did not finish. Fix the problem above and run install.bat again.
pause
exit /b 1
