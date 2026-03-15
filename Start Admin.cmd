@echo off
setlocal

cd /d "%~dp0"

start "Bag & Pack Admin Server" /d "%~dp0" cmd /k npm.cmd run admin

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$deadline=(Get-Date).AddSeconds(20); " ^
  "while((Get-Date) -lt $deadline){ " ^
  "  try { $r=Invoke-WebRequest -Uri 'http://localhost:3000' -UseBasicParsing -TimeoutSec 2; if($r.StatusCode -ge 200){ Start-Process 'http://localhost:3000'; exit 0 } } catch { Start-Sleep -Milliseconds 700 } " ^
  "} " ^
  "Start-Process 'http://localhost:3000'"

endlocal
