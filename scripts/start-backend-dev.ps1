<#
.SYNOPSIS
    Start the MedAI backend dev server detached, with bounded log files.

.DESCRIPTION
    Replaces the old pattern where the caller redirected the launcher with
    ">> logs\dev-start.log 2>&1". That append-only redirect had no rotation and
    produced multi-GB files.

    This launcher:
      1. runs rotate-dev-logs.ps1 (size rotation + retention),
      2. refuses to start if the target port already listens,
      3. starts "mvn spring-boot:run" in a detached cmd.exe whose stdout/stderr
         go to per-run files  logs\dev-start.<timestamp>.log / .err.log,
      4. waits until the port listens (or the launcher exits) and prints the PID
         plus log paths.

    Because the files carry a timestamp and the parent shell returns immediately,
    every start begins with a fresh, bounded log file. Scheduled rotation
    (MedAI-DevLogRotate) then archives/frees them.

    ASCII-only on purpose (Windows PowerShell 5.1 + zh-CN ANSI code page).

.PARAMETER Port
    Backend port. Default 8081.

.PARAMETER Profile
    Spring profile. Default dev.

.PARAMETER WaitSeconds
    How long to wait for the port to listen. Default 180.

.PARAMETER NoWait
    Start and exit without waiting for readiness.

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts\start-backend-dev.ps1
#>
[CmdletBinding()]
param(
    [int]$Port = 8081,
    [string]$Profile = 'dev',
    [int]$WaitSeconds = 180,
    [switch]$NoWait
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root 'med_ai_assistant_1.0_bs_backend'
$backendLogs = Join-Path $backend 'logs'

if (-not (Test-Path -LiteralPath (Join-Path $backend 'pom.xml'))) {
    throw "Backend project not found: $backend"
}
New-Item -ItemType Directory -Path $backendLogs -Force | Out-Null

# 1) Bound existing logs first, so a previous runaway file is archived/deleted
#    before a new run starts.
$rotate = Join-Path $PSScriptRoot 'rotate-dev-logs.ps1'
if (Test-Path -LiteralPath $rotate) {
    & $rotate -Quiet | Out-Null
}

# 2) Do not start a second instance on the same port.
$existing = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
if ($existing.Count -gt 0) {
    Write-Host ("Port {0} is already listening (PID {1}); nothing to do." -f $Port, $existing[0].OwningProcess)
    exit 2
}

# 3) Pick a Maven entry point that exists on this host.
$mvn = Get-Command mvn -ErrorAction SilentlyContinue
if ($null -ne $mvn) {
    $mvnExe = $mvn.Source
}
elseif (Test-Path -LiteralPath (Join-Path $backend 'mvnw.cmd')) {
    $mvnExe = Join-Path $backend 'mvnw.cmd'
}
else {
    throw 'Neither mvn nor mvnw.cmd is available on PATH.'
}

# 4) Per-run log file names (never reuse a name, never append).
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$outLog = Join-Path $backendLogs ("dev-start.{0}.log" -f $stamp)
$errLog = Join-Path $backendLogs ("dev-start.{0}.err.log" -f $stamp)

$mvnArgs = "spring-boot:run -Dspring-boot.run.profiles=$Profile -Dspring-boot.run.arguments=--server.port=$Port"
$cmdLine = '/c "' + $mvnExe + '" ' + $mvnArgs

Write-Host "Backend     : $backend"
Write-Host "Maven       : $mvnExe"
Write-Host "Port        : $Port (profile: $Profile)"
Write-Host "stdout log  : $outLog"
Write-Host "stderr log  : $errLog"

$proc = Start-Process -FilePath 'cmd.exe' -ArgumentList $cmdLine -WorkingDirectory $backend `
    -RedirectStandardOutput $outLog -RedirectStandardError $errLog `
    -WindowStyle Hidden -PassThru

Write-Host ("Launcher PID: {0}" -f $proc.Id)

if ($NoWait) {
    exit 0
}

# 5) Poll until the port listens (java child owns the socket, not cmd.exe).
$deadline = (Get-Date).AddSeconds($WaitSeconds)
while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 2
    $listening = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
    if ($listening.Count -gt 0) {
        Write-Host ("READY: port {0} listening (PID {1})." -f $Port, $listening[0].OwningProcess)
        exit 0
    }
    if ($proc.HasExited) {
        Write-Host ("ERROR: launcher exited with code {0} before port {1} was ready. See {2}" -f $proc.ExitCode, $Port, $errLog)
        exit 1
    }
}

Write-Host ("TIMEOUT: port {0} not listening after {1}s. The process may still be compiling/starting; see {2}" -f $Port, $WaitSeconds, $outLog)
exit 3
