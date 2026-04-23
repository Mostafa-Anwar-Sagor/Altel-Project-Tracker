# Start-ProTracker.ps1
# =====================
# Starts the Django backend and React frontend
# in separate terminals. Run this once to start everything.

$root     = "c:\Users\sagor\ALTEL\project_tracker"
$python   = "$root\venv\Scripts\python.exe"
$backend  = "$root\backend"
$frontend = "$root\frontend"

Write-Host "`n=== ProTracker Startup ===" -ForegroundColor Cyan

# 1. Django backend
Write-Host "Starting Django backend on :8000 ..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command",
  "Set-Location '$backend'; & '$python' manage.py runserver 8000"

Start-Sleep -Seconds 2

# 2. React frontend
Write-Host "Starting React frontend on :5173 ..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command",
  "Set-Location '$frontend'; npm run dev"

Write-Host "`nAll services started!" -ForegroundColor Cyan
Write-Host "  Frontend : http://localhost:5173" -ForegroundColor White
Write-Host "  Backend  : http://localhost:8000`n" -ForegroundColor White
