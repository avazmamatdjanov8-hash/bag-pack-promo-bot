@echo off
setlocal

cd /d "%~dp0"
start "Bag & Pack Bot" /d "%~dp0" cmd /k npm.cmd start

endlocal
