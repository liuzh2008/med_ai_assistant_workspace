<#
.SYNOPSIS
    Project-level log retention policy for the MedAI dev environment.

.DESCRIPTION
    Applies size-based rotation to every "console redirect" log that bypasses
    logback (backend startup stdout, verify scripts, frontend dev server) and
    removes stale logback archives plus legacy hand-made backups.

    Background: logback-spring.xml already rotates application.log, but files
    produced by shell redirection (">> logs\dev-start.log") are plain OS files
    that logback never sees. Before this policy existed they grew without any
    bound (dev-start.log reached 11.6 GB, backend-main-restart.log 5.3 GB).

    Run manually:
        powershell -NoProfile -ExecutionPolicy Bypass -File scripts\rotate-dev-logs.ps1
        powershell -NoProfile -ExecutionPolicy Bypass -File scripts\rotate-dev-logs.ps1 -DryRun
    Scheduled task (installed by scripts\install-log-rotate-task.ps1):
        MedAI-DevLogRotate, every 2 hours.

    ASCII-only on purpose (Windows PowerShell 5.1 + zh-CN ANSI code page).

.PARAMETER DryRun
    Report only, do not move or delete anything.

.PARAMETER Quiet
    Suppress normal progress lines.

.OUTPUTS
    PSCustomObject[] describing every rotate/delete/skip action.
#>
[CmdletBinding()]
param(
    [switch]$DryRun,
    [switch]$Quiet
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root 'med_ai_assistant_1.0_bs_backend'
$vue = Join-Path $root 'med_ai_assistant_1.0_bs_vue'
$backendLogs = Join-Path $backend 'logs'
$rotateScript = Join-Path $PSScriptRoot 'log-rotate.ps1'

if (-not (Test-Path -LiteralPath $rotateScript)) {
    throw "log-rotate.ps1 not found next to this script: $rotateScript"
}

function Write-Info {
    param([string]$Message)
    if (-not $Quiet) { Write-Host $Message }
}

function Remove-Stale {
    param(
        [string]$Directory,
        [string]$Filter,
        [string]$NameRegex,
        [double]$MaxAgeDays,
        [string]$Reason
    )
    if (-not (Test-Path -LiteralPath $Directory)) { return @() }
    $now = Get-Date
    $removed = New-Object System.Collections.ArrayList
    $items = @(Get-ChildItem -LiteralPath $Directory -Filter $Filter -File -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match $NameRegex -and ($now - $_.LastWriteTime).TotalDays -gt $MaxAgeDays } |
        Sort-Object LastWriteTime)
    foreach ($item in $items) {
        $mb = [math]::Round($item.Length / 1MB, 2)
        if ($DryRun) {
            Write-Info ('[dry-run] would delete stale log {0} ({1} MB, {2})' -f $item.FullName, $mb, $Reason)
            [void]$removed.Add([pscustomobject]@{
                Action = 'WouldDelete'; File = $item.FullName; SizeMB = $mb; Archive = ''; Reason = $Reason
            })
        }
        else {
            try {
                Remove-Item -LiteralPath $item.FullName -Force -ErrorAction Stop
                Write-Info ('deleted stale log {0} ({1} MB, {2})' -f $item.FullName, $mb, $Reason)
                [void]$removed.Add([pscustomobject]@{
                    Action = 'Delete'; File = $item.FullName; SizeMB = $mb; Archive = ''; Reason = $Reason
                })
            }
            catch {
                Write-Warning ('failed to delete {0}: {1}' -f $item.FullName, $_.Exception.Message)
            }
        }
    }
    return $removed
}

function Remove-ByRetention {
    param(
        [string]$Directory,
        [string]$NameRegex,
        [int]$KeepNewest,
        [double]$MaxAgeDays,
        [int]$TotalCapMB,
        [string]$Reason
    )
    if (-not (Test-Path -LiteralPath $Directory)) { return @() }
    $now = Get-Date
    $removed = New-Object System.Collections.ArrayList
    $items = @(Get-ChildItem -LiteralPath $Directory -File -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match $NameRegex } |
        Sort-Object LastWriteTime -Descending)

    $keep = New-Object System.Collections.ArrayList
    for ($i = 0; $i -lt $items.Count; $i++) {
        $item = $items[$i]
        $tooOld = (($now - $item.LastWriteTime).TotalDays -gt $MaxAgeDays)
        if ($i -ge $KeepNewest -or $tooOld) {
            $mb = [math]::Round($item.Length / 1MB, 2)
            if ($DryRun) {
                Write-Info ('[dry-run] would delete run log {0} ({1} MB, {2})' -f $item.FullName, $mb, $Reason)
                [void]$removed.Add([pscustomobject]@{
                    Action = 'WouldDelete'; File = $item.FullName; SizeMB = $mb; Archive = ''; Reason = $Reason
                })
            }
            else {
                try {
                    Remove-Item -LiteralPath $item.FullName -Force -ErrorAction Stop
                    Write-Info ('deleted run log {0} ({1} MB, {2})' -f $item.FullName, $mb, $Reason)
                    [void]$removed.Add([pscustomobject]@{
                        Action = 'Delete'; File = $item.FullName; SizeMB = $mb; Archive = ''; Reason = $Reason
                    })
                }
                catch {
                    Write-Warning ('failed to delete {0}: {1}' -f $item.FullName, $_.Exception.Message)
                }
            }
        }
        else {
            [void]$keep.Add($item)
        }
    }

    if ($TotalCapMB -gt 0) {
        $total = 0
        foreach ($k in $keep) { $total += $k.Length }
        $capBytes = $TotalCapMB * 1MB
        for ($i = $keep.Count - 1; $i -ge 0; $i--) {
            if ($total -le $capBytes) { break }
            $old = $keep[$i]
            $mb = [math]::Round($old.Length / 1MB, 2)
            if ($DryRun) {
                Write-Info ('[dry-run] would delete run log over cap {0} ({1} MB)' -f $old.FullName, $mb)
                [void]$removed.Add([pscustomobject]@{
                    Action = 'WouldDelete'; File = $old.FullName; SizeMB = $mb; Archive = ''; Reason = $Reason + '-cap'
                })
            }
            else {
                try {
                    Remove-Item -LiteralPath $old.FullName -Force -ErrorAction Stop
                    Write-Info ('deleted run log over cap {0} ({1} MB)' -f $old.FullName, $mb)
                    [void]$removed.Add([pscustomobject]@{
                        Action = 'Delete'; File = $old.FullName; SizeMB = $mb; Archive = ''; Reason = $Reason + '-cap'
                    })
                    $total -= $old.Length
                }
                catch {
                    Write-Warning ('failed to delete {0}: {1}' -f $old.FullName, $_.Exception.Message)
                }
            }
        }
    }
    return $removed
}

$summary = New-Object System.Collections.ArrayList

# ---------------------------------------------------------------------------
# Files written by console redirection (logback cannot rotate these).
# MaxSizeMB / Keep are tuned so a single runaway dev session cannot exceed
# ~200 MB and total disk use stays well under 1 GB.
# ---------------------------------------------------------------------------
$rules = @(
    # Backend dev server stdout/stderr (current launcher writes timestamped files,
    # the plain names below cover old launchers and legacy sessions).
    @{ Path = (Join-Path $backendLogs 'dev-start.log');           MaxSizeMB = 200; Keep = 3; Cap = 600 },
    @{ Path = (Join-Path $backendLogs 'dev-start.err.log');       MaxSizeMB = 50;  Keep = 2; Cap = 100 },
    @{ Path = (Join-Path $backendLogs 'dev-start2.log');          MaxSizeMB = 50;  Keep = 1; Cap = 100 },
    @{ Path = (Join-Path $backendLogs 'dev-start3.log');          MaxSizeMB = 50;  Keep = 1; Cap = 100 },
    @{ Path = (Join-Path $backendLogs 'dev-start4.log');          MaxSizeMB = 50;  Keep = 1; Cap = 100 },
    @{ Path = (Join-Path $backendLogs 'dev-start5.log');          MaxSizeMB = 50;  Keep = 1; Cap = 100 },
    @{ Path = (Join-Path $backendLogs 'dev-start6.log');          MaxSizeMB = 50;  Keep = 1; Cap = 100 },

    # Ad-hoc restart redirect at the backend root (created by old manual commands).
    @{ Path = (Join-Path $backend 'backend-main-restart.log');    MaxSizeMB = 200; Keep = 2; Cap = 500 },
    @{ Path = (Join-Path $backend 'backend-main-restart.log.err');MaxSizeMB = 50;  Keep = 2; Cap = 100 },

    # Verify script output (test-scripts / manual runs).
    @{ Path = (Join-Path $backend 'medai-main-8081-verify.log');  MaxSizeMB = 100; Keep = 2; Cap = 300 },
    @{ Path = (Join-Path $backend 'medai-main-8081-verify.err');  MaxSizeMB = 50;  Keep = 2; Cap = 100 },

    # Frontend dev server redirect.
    @{ Path = (Join-Path $vue 'dev-server-restart.log');          MaxSizeMB = 50;  Keep = 2; Cap = 150 },
    @{ Path = (Join-Path $vue 'dev-server-restart.log.err');      MaxSizeMB = 50;  Keep = 2; Cap = 100 }
)

foreach ($rule in $rules) {
    Write-Info ('--- rotate: {0} (max {1} MB, keep {2})' -f $rule.Path, $rule.MaxSizeMB, $rule.Keep)
    $result = & $rotateScript -Path $rule.Path -MaxSizeMB $rule.MaxSizeMB -Keep $rule.Keep `
        -TotalCapMB $rule.Cap -DryRun:$DryRun -Quiet:$Quiet
    foreach ($r in $result) { [void]$summary.Add($r) }
}

# ---------------------------------------------------------------------------
# logback-owned archives: safety net in case the app has not started for a
# long time (logback only cleans maxHistory during rollover / on start).
# ---------------------------------------------------------------------------
Write-Info '--- sweep stale logback archives'
foreach ($r in (Remove-Stale -Directory $backendLogs -Filter 'application.*.log' `
        -NameRegex '^application\.\d{4}-\d{2}-\d{2}\.\d+\.log$' -MaxAgeDays 30 -Reason 'application >30d')) {
    [void]$summary.Add($r)
}
foreach ($r in (Remove-Stale -Directory $backendLogs -Filter 'database-diagnostic.*.log' `
        -NameRegex '^database-diagnostic\.\d{4}-\d{2}-\d{2}\.\d+\.log$' -MaxAgeDays 7 -Reason 'diagnostic >7d')) {
    [void]$summary.Add($r)
}
foreach ($r in (Remove-Stale -Directory $backendLogs -Filter 'prompt-generation.*.log' `
        -NameRegex '^prompt-generation\.\d{4}-\d{2}-\d{2}\.\d+\.log$' -MaxAgeDays 7 -Reason 'prompt-gen >7d')) {
    [void]$summary.Add($r)
}

# ---------------------------------------------------------------------------
# Per-run launcher logs (dev-start.<timestamp>.log written by the current
# launcher). Each start creates a new file, so retention is by count/age/size
# instead of rotation. Files still held by a running JVM are skipped safely.
# ---------------------------------------------------------------------------
Write-Info '--- sweep per-run backend launcher logs'
foreach ($r in (Remove-ByRetention -Directory $backendLogs -NameRegex '^dev-start\.\d{8}-\d{6}\.log$' `
        -KeepNewest 10 -MaxAgeDays 7 -TotalCapMB 1000 -Reason 'run-log')) {
    [void]$summary.Add($r)
}
foreach ($r in (Remove-ByRetention -Directory $backendLogs -NameRegex '^dev-start\.\d{8}-\d{6}\.err\.log$' `
        -KeepNewest 10 -MaxAgeDays 7 -TotalCapMB 100 -Reason 'run-err')) {
    [void]$summary.Add($r)
}

# ---------------------------------------------------------------------------
# Legacy hand-made backups (dev-start.log.bak*, now replaced by rotation).
# ---------------------------------------------------------------------------
if (Test-Path -LiteralPath $backendLogs) {
    $legacy = @(Get-ChildItem -LiteralPath $backendLogs -File -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match '^dev-start\.log\.bak' } |
        Sort-Object LastWriteTime)
    foreach ($item in $legacy) {
        $mb = [math]::Round($item.Length / 1MB, 2)
        if ($DryRun) {
            Write-Info ('[dry-run] would delete legacy backup {0} ({1} MB)' -f $item.FullName, $mb)
            [void]$summary.Add([pscustomobject]@{
                Action = 'WouldDelete'; File = $item.FullName; SizeMB = $mb; Archive = ''; Reason = 'legacy-backup'
            })
        }
        else {
            try {
                Remove-Item -LiteralPath $item.FullName -Force -ErrorAction Stop
                Write-Info ('deleted legacy backup {0} ({1} MB)' -f $item.FullName, $mb)
                [void]$summary.Add([pscustomobject]@{
                    Action = 'Delete'; File = $item.FullName; SizeMB = $mb; Archive = ''; Reason = 'legacy-backup'
                })
            }
            catch {
                Write-Warning ('failed to delete {0}: {1}' -f $item.FullName, $_.Exception.Message)
            }
        }
    }
}

if (-not $DryRun -and -not $Quiet) {
    $deleted = @($summary | Where-Object { $_.Action -eq 'Delete' })
    $freedMB = 0
    foreach ($d in $deleted) { $freedMB += $d.SizeMB }
    Write-Info ('done: {0} file(s) rotated/skipped, {1} deleted, ~{2} MB reclaimed' -f
        @($summary | Where-Object { $_.Action -in @('Rotate', 'Skip') }).Count,
        $deleted.Count, [math]::Round($freedMB, 2))
}

# ---------------------------------------------------------------------------
# Alert trail for files that are over their cap but cannot be rotated.
# A running dev server holds its stdout log open, and cmd.exe opens redirect
# targets without FILE_SHARE_DELETE, so Move-Item fails with "file in use".
# That is exactly how dev-start.log once reached 11.6 GB unnoticed: every
# scheduled run skipped it silently. Record the skips so the growth is visible
# (scheduled runs use -Quiet, so console output alone would be lost).
# ---------------------------------------------------------------------------
$skipped = @($summary | Where-Object { $_.Action -eq 'Skip' })
if ($skipped.Count -gt 0 -and -not $DryRun -and (Test-Path -LiteralPath $backendLogs)) {
    $alertPath = Join-Path $backendLogs '.logrotate-alerts.log'
    if (Test-Path -LiteralPath $alertPath) {
        $alertItem = Get-Item -LiteralPath $alertPath -ErrorAction SilentlyContinue
        # Self-limit the alert trail so it can never become the next big file.
        if ($null -ne $alertItem -and $alertItem.Length -gt 256KB) {
            Remove-Item -LiteralPath $alertPath -Force -ErrorAction SilentlyContinue
        }
    }
    $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    foreach ($s in $skipped) {
        $line = '{0} SKIP {1} ({2} MB) - {3}' -f $stamp, $s.File, $s.SizeMB, $s.Reason
        Add-Content -LiteralPath $alertPath -Value $line -Encoding UTF8 -ErrorAction SilentlyContinue
    }
    if (-not $Quiet) {
        Write-Warning ('{0} log file(s) over cap but locked by a running process; see {1}' -f $skipped.Count, $alertPath)
    }
}

return $summary
