@echo off
setlocal

cd /d "%~dp0"
set CSC_IDENTITY_AUTO_DISCOVERY=false

echo ========================================
echo BLTN-Analysis Log - Windows Installer
echo ========================================
echo.

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo npm.cmd was not found. Please install Node.js first.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing dependencies...
  call npm.cmd install
  if errorlevel 1 goto :fail
)

echo Running syntax check...
call npm.cmd run syntax
if errorlevel 1 goto :fail

echo Running smoke check...
call npm.cmd run check
if errorlevel 1 goto :fail

echo Building installer...
call npm.cmd run dist -- --publish never --config.directories.output=out/release-build
if errorlevel 1 goto :fail

echo Preparing the three release files and cleaning previous builds...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\prepare-release.ps1
if errorlevel 1 goto :fail

echo.
echo Build complete. Installer and update metadata are in the dist folder.
echo Upload all three files to one published GitHub Release matching the package version.
pause
exit /b 0

:fail
echo.
echo Build failed. Check the error output above.
pause
exit /b 1
