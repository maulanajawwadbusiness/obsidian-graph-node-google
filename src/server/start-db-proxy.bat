@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\db-proxy.ps1"
if errorlevel 1 (
  echo.
  echo [start-db-proxy] command failed with exit code %errorlevel%
  pause
)
