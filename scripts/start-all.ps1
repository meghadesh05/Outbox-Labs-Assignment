Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "Starting ReachInbox Email Scheduler Services" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

# Start Redis if installed in tools
$redisExe = "$PSScriptRoot\..\tools\redis\redis-server.exe"
$redisConf = "$PSScriptRoot\..\tools\redis\redis.windows.conf"
if (Test-Path $redisExe) {
    Write-Host "Launching background Redis server on port 6379..." -ForegroundColor Yellow
    Start-Process -FilePath $redisExe -ArgumentList "`"$redisConf`"" -WindowStyle Minimized
} else {
    Write-Host "Assuming Redis is running as a system service or container on port 6379." -ForegroundColor Gray
}

Start-Sleep -Seconds 2

# Start Backend API & Worker
Write-Host "Launching Backend API + BullMQ Worker on http://localhost:5000..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run dev --prefix backend"

# Start Frontend
Write-Host "Launching Vite Frontend on http://localhost:5173..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run dev --prefix frontend"

Write-Host "`nAll services initiated successfully!" -ForegroundColor Cyan
Write-Host "• Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "• Backend API: http://localhost:5000" -ForegroundColor White
Write-Host "• Bull Board: http://localhost:5000/admin/queues" -ForegroundColor White
