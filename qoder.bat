@echo off
cd /d "D:\MedAiAssistant 1.0 BS"

echo ============================================
echo  Qoder CLI Startup Mode
echo ============================================
echo  1. Local Mode (current)
echo     qodercli -w "D:\MedAiAssistant 1.0 BS"
echo  2. Remote Control Server
echo     qodercli remote-control
echo ============================================
set /p choice="Enter your choice (1 or 2): "

if "%choice%"=="1" (
    echo Starting local mode...
    "%USERPROFILE%\AppData\Roaming\npm\qodercli.cmd" -w "D:\MedAiAssistant 1.0 BS" %*
) else if "%choice%"=="2" (
    echo Starting remote control server...
    "%USERPROFILE%\AppData\Roaming\npm\qodercli.cmd" remote-control
) else (
    echo Invalid choice, starting local mode by default...
    "%USERPROFILE%\AppData\Roaming\npm\qodercli.cmd" -w "D:\MedAiAssistant 1.0 BS" %*
)
