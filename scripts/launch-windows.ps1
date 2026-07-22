$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Write-Host 'Node.js 20 or newer is required. Install it from https://nodejs.org/'; exit 1 }
if ([int](node -p "process.versions.node.split('.')[0]") -lt 20) { Write-Host 'Node.js 20 or newer is required.'; exit 1 }
node scripts/launch-local-app.js --force-restart
