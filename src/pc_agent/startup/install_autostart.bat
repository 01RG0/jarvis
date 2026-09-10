@echo off
REM Installs Jarvis PC Agent as a Windows startup task.
REM Run this once as Administrator (or double-click, then allow UAC).

SET SCRIPT_DIR=%~dp0
SET VBS_PATH=%SCRIPT_DIR%jarvis_autostart.vbs

REM Check if schtasks is available (always is on Windows 7+)
schtasks /query /tn "JarvisPCAgent" >nul 2>&1
IF %ERRORLEVEL% EQU 0 (
    echo Existing task found. Removing...
    schtasks /delete /tn "JarvisPCAgent" /f >nul 2>&1
)

REM Create task: run at user logon, in background
schtasks /create /tn "JarvisPCAgent" ^
    /tr "wscript.exe \"%VBS_PATH%\"" ^
    /sc ONLOGON ^
    /rl HIGHEST ^
    /f >nul 2>&1

IF %ERRORLEVEL% EQU 0 (
    echo.
    echo [OK] Jarvis PC Agent will auto-start on every Windows login.
    echo      Logs: src\pc_agent\logs\pc_agent.log
    echo.
    echo Starting now...
    wscript.exe "%VBS_PATH%"
    echo Done.
) ELSE (
    echo [FAIL] Could not create scheduled task. Try running as Administrator.
)
pause
