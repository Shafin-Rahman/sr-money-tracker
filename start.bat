@echo off
echo ================================
echo   SR Money Tracker - Launcher
echo ================================
echo.

:: Start Backend
echo [1/2] Starting Backend Server...
start "SR Money Backend" cmd /c "cd /d %~dp0backend && npm run dev"

:: Wait for backend to start
timeout /t 3 /nobreak >nul

:: Start Frontend
echo [2/2] Starting Frontend...
start "SR Money Frontend" cmd /c "cd /d %~dp0frontend && npx serve ."

echo.
echo Backend:  http://localhost:3001
echo Frontend: http://localhost:3000
echo.
echo Close this window to stop both servers.
pause
