@echo off
echo Starting Redis Server on port 6379...
if exist "..\tools\redis\redis-server.exe" (
    start "Redis Server" "..\tools\redis\redis-server.exe" "..\tools\redis\redis.windows.conf"
) else (
    redis-server
)
