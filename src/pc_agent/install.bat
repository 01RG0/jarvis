@echo off
setlocal

REM JARVIS PC Agent — Windows startup registration
REM Run once as the target user (no admin needed for Task Scheduler /RL LIMITED)

set JARVIS_DIR=%~dp0
set MAIN_PY=%JARVIS_DIR%main.py

echo Installing JARVIS PC Agent...

REM Install Python deps
python -m pip install -r "%JARVIS_DIR%requirements.txt" --quiet

REM Install Playwright browser
python -m playwright install chromium --quiet

REM Register Windows Task Scheduler task (runs at logon, limited rights)
schtasks /create ^
  /tn "JARVIS PC Agent" ^
  /tr "pythonw \"%MAIN_PY%\"" ^
  /sc onlogon ^
  /rl limited ^
  /f

if %errorlevel% equ 0 (
    echo JARVIS PC Agent registered to run at logon.
) else (
    echo Failed to register task. Try running as administrator.
)

echo Done. Log out and back in, or run: pythonw "%MAIN_PY%"
pause
