Set-Location $PSScriptRoot
if (!(Test-Path "frontend\node_modules")) { npm install --prefix frontend }
npm run --prefix frontend dev
