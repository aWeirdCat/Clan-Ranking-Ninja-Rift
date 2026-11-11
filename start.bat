@echo off
title Ninja Rift Tracker Launcher
color 0b

echo ========================================================
echo        CATOLOGIST'S NINJA RIFT TRACKER LAUNCHER
echo ========================================================
echo.

cd /d "C:\Users\Bad1337\Documents\GitHub\Clan-Ranking-Ninja-Rift"

echo [1/2] Starting Node.js Server on port 3000...
start "Ninja Rift Server (Port 3000)" cmd /k "title Ninja Rift Server && color 0a && node server.js"

echo Waiting 3 seconds for server to initialize...
timeout /t 3 /nobreak >nul

echo.
echo [2/2] Starting Public Online Tunnel (localtunnel)...
start "Ninja Rift Public Tunnel" cmd /k "title Ninja Rift Public Tunnel && color 0e && echo Starting public online link... && npx localtunnel --port 3000"

echo.
echo ========================================================
echo All processes launched!
echo - Terminal 1: Node.js server (http://localhost:3000)
echo - Terminal 2: Public online link (Share this with friends)
echo ========================================================
echo.
pause
