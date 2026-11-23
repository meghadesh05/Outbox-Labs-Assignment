@echo off
echo ====================================================
echo Starting ReachInbox Email Scheduler Services
echo ====================================================

call "%~dp0start-redis.bat"
timeout /t 2 /nobreak >nul

echo Starting Express API Server + BullMQ Worker...
start "ReachInbox Backend API & Worker" cmd /k "npm run dev --prefix backend"

echo Starting Vite Frontend...
start "ReachInbox Vite Frontend" cmd /k "npm run dev --prefix frontend"

echo ====================================================
echo Backend running on: http://localhost:5000
echo Frontend running on: http://localhost:5173
echo Bull Board monitor: http://localhost:5000/admin/queues
echo ====================================================
