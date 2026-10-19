<#
.SYNOPSIS
    Install (or remove) the MedAI-DevLogRotate scheduled task.

.DESCRIPTION
    The rotation policy script only runs when invoked. Long-running dev sessions
    never restart the backend, so a timer is needed to archive/clean logs that
    were closed by an earlier run and to sweep stale logback archives.

    Task: MedAI-DevLogRotate, runs rotate-dev-logs.ps1 -Quiet every 2 hours
    under the current user (S4U, no password, works while logged off).

    Usage:
        powershell -NoProfile -ExecutionPolicy Bypass -File scripts\install-log-rotate-task.ps1
        powershell -NoProfile -ExecutionPolicy Bypass -File scripts\install-log-rotate-task.ps1 -Remove

    ASCII-only on purpose (Windows PowerShell 5.1 + zh-CN ANSI code page).
#>
[CmdletBinding()]
param(
    [switch]$Remove,
    [int]$IntervalHours = 2,
    [string]$TaskName = 'MedAI-DevLogRotate'
)

$ErrorActionPreference = 'Stop'

if ($Remove) {
    $existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($null -eq $existing) {
        Write-Host "Task $TaskName is not installed."
        exit 0
    }
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "Removed task $TaskName."
    exit 0
}

$rotateScript = Join-Path $PSScriptRoot 'rotate-dev-logs.ps1'
if (-not (Test-Path -LiteralPath $rotateScript)) {
    throw "rotate-dev-logs.ps1 not found: $rotateScript"
}

$wrapper = Join-Path $PSScriptRoot 'run-log-rotate.cmd'
if (-not (Test-Path -LiteralPath $wrapper)) {
    throw "run-log-rotate.cmd not found: $wrapper"
}

# Run through the wrapper so stdout/stderr land in scripts\logs\log-rotate-task.log
# (Task Scheduler would otherwise discard them and -Quiet hides every failure).
$action = New-ScheduledTaskAction -Execute (Join-Path $env:SystemRoot 'System32\cmd.exe') `
    -Argument ('/c "' + $wrapper + '"')
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) `
    -RepetitionInterval (New-TimeSpan -Hours $IntervalHours) `
    -RepetitionDuration (New-TimeSpan -Days 3650)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -MultipleInstances IgnoreNew

$user = '{0}\{1}' -f $env:USERDOMAIN, $env:USERNAME
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType S4U -RunLevel Limited
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings `
    -Principal $principal `
    -Description 'Rotate MedAI dev console-redirect logs and sweep stale logback archives (every 2 hours).' `
    -Force | Out-Null

$task = Get-ScheduledTask -TaskName $TaskName
Write-Host ("Installed task '{0}' (state: {1}, every {2}h as {3})." -f $TaskName, $task.State, $IntervalHours, $user)
Write-Host 'Verify with: Get-ScheduledTask -TaskName MedAI-DevLogRotate | Format-List'
