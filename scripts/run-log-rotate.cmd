@echo off
rem Scheduled-task wrapper for rotate-dev-logs.ps1.
rem
rem Why this exists: Task Scheduler starts the process detached, so the script
rem output is otherwise discarded. rotate-dev-logs.ps1 runs with -Quiet, which
rem means a silent failure (or a rotation that keeps getting skipped) leaves no
rem trace at all. Redirect both streams into a bounded task log so each run can
rem be audited after the fact.
rem
rem ASCII-only on purpose: cmd.exe parses .cmd as the OEM/ANSI code page on a
rem zh-CN host, so non-ASCII text here would corrupt the command line.
rem
rem Line endings must be CRLF: cmd.exe mis-parses rem/if blocks in LF-only
rem files and then tries to execute the comment text as commands.
setlocal
set "HERE=%~dp0"
set "LOGDIR=%HERE%logs"
set "LOG=%LOGDIR%\log-rotate-task.log"

if not exist "%LOGDIR%" mkdir "%LOGDIR%"

rem Keep the task log itself bounded (5 MB) - it must never become the next
rem multi-GB file this policy is meant to prevent.
if exist "%LOG%" for %%A in ("%LOG%") do if %%~zA GTR 5242880 del /f /q "%LOG%"

rem Start/exit markers: -Quiet prints nothing on success, so without these the
rem log cannot tell "ran fine" from "never ran". The timestamp comes from
rem PowerShell because %DATE% on a zh-CN host is e.g. "weekday 2026/10/19", so
rem no fixed substring of it is a usable date.
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HH:mm:ss"') do set "TS=%%i"
echo [%TS%] rotate start >> "%LOG%"
powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%HERE%rotate-dev-logs.ps1" -Quiet >> "%LOG%" 2>&1
set "RC=%ERRORLEVEL%"
echo [%TS%] rotate exit=%RC% >> "%LOG%"
exit /b %RC%
