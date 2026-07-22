@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js 20 or newer is required. Install it from https://nodejs.org/ & pause & exit /b 1)
for /f %%v in ('node -p "process.versions.node.split('.')[0]"') do set NODE_MAJOR=%%v
if %NODE_MAJOR% LSS 20 (echo Node.js 20 or newer is required. & pause & exit /b 1)
node scripts\launch-local-app.js --force-restart
