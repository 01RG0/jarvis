@echo off
schtasks /delete /tn "JarvisPCAgent" /f >nul 2>&1
IF %ERRORLEVEL% EQU 0 (
    echo [OK] Jarvis PC Agent auto-start removed.
) ELSE (
    echo [INFO] Task was not installed.
)
pause
