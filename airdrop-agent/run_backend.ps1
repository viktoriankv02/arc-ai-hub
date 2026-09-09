Set-Location $PSScriptRoot
if (!(Test-Path "backend\.venv")) { python -m venv backend\.venv }
& ".\backend\.venv\Scripts\python.exe" -m pip install -r ".\backend\requirements.txt"
& ".\backend\.venv\Scripts\python.exe" -m uvicorn backend.main:app --reload --port 8000
