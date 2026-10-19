<#
.SYNOPSIS
    Size-based log rotation with retention.

.DESCRIPTION
    Rotates an active log file to "<name>.<yyyyMMdd-HHmmss><ext>" when its size
    exceeds MaxSizeMB, recreates an empty file at the original path, then keeps
    only the newest Keep archives (oldest are deleted). An optional total cap
    (active file + archives) is enforced by deleting oldest archives first.

    Windows cannot rename a file while another process holds it open without
    FILE_SHARE_DELETE. Such files are reported as "Skipped" and the run
    continues; the next run (or next service start) will rotate them.

    The script is ASCII-only on purpose: Windows PowerShell 5.1 parses
    BOM-less UTF-8 scripts with the ANSI code page, so non-ASCII text would
    break parsing on a zh-CN host.

.PARAMETER Path
    One or more explicit file paths. Wildcards are allowed. Matches that are
    already rotation archives (matching our timestamp pattern) are ignored.

.PARAMETER MaxSizeMB
    Rotate a file when its size is greater than this value. Default: 100.

.PARAMETER Keep
    Number of rotation archives to keep per active file. Default: 5.
    Use 0 to delete every archive.

.PARAMETER TotalCapMB
    Optional cap for (active file + its archives). Oldest archives are removed
    first. Use 0 to disable. Default: 0.

.PARAMETER DryRun
    Print planned actions without touching the file system.

.PARAMETER Quiet
    Suppress informational lines. Warnings and the returned objects are kept.

.OUTPUTS
    PSCustomObject[] with Action (Rotate|Skip|Delete|WouldRotate|WouldDelete),
    File, SizeMB, Archive, Reason.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string[]]$Path,

    [int]$MaxSizeMB = 100,

    [int]$Keep = 5,

    [int]$TotalCapMB = 0,

    [switch]$DryRun,

    [switch]$Quiet
)

$ErrorActionPreference = 'Stop'

function Write-Info {
    param([string]$Message)
    if (-not $Quiet) { Write-Host $Message }
}

# Returns the archive regex for an active log file:
#   name.<yyyyMMdd-HHmmss>[-n]<ext>
function Get-ArchiveRegex {
    param([string]$ActivePath)
    $name = [IO.Path]::GetFileNameWithoutExtension($ActivePath)
    $ext = [IO.Path]::GetExtension($ActivePath)
    return '^' + [regex]::Escape($name) + '\.\d{8}-\d{6}(-\d+)?' + [regex]::Escape($ext) + '$'
}

function Get-Archives {
    param(
        [string]$Directory,
        [string]$ActivePath
    )
    $regex = Get-ArchiveRegex -ActivePath $ActivePath
    $items = @(Get-ChildItem -LiteralPath $Directory -File -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match $regex } |
        Sort-Object LastWriteTime -Descending)
    return $items
}

$summary = New-Object System.Collections.ArrayList

foreach ($pattern in $Path) {
    # Resolve-Path returns nothing for a missing file; skip quietly because the
    # policy script lists candidate log paths that may not exist yet.
    $resolved = @(Resolve-Path -Path $pattern -ErrorAction SilentlyContinue)
    foreach ($resolvedItem in $resolved) {
        $active = $resolvedItem.Path
        $file = Get-Item -LiteralPath $active -ErrorAction SilentlyContinue
        if ($null -eq $file -or $file.PSIsContainer) { continue }

        # Never treat one of our own archives as an active file.
        $selfRegex = Get-ArchiveRegex -ActivePath $active
        if ($file.Name -match $selfRegex) { continue }

        $dir = $file.DirectoryName
        $name = [IO.Path]::GetFileNameWithoutExtension($file.Name)
        $ext = $file.Extension
        $sizeMB = [math]::Round($file.Length / 1MB, 2)

        if ($file.Length -gt ($MaxSizeMB * 1MB)) {
            $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
            $archive = Join-Path $dir ($name + '.' + $stamp + $ext)
            $suffix = 1
            while (Test-Path -LiteralPath $archive) {
                $archive = Join-Path $dir ($name + '.' + $stamp + '-' + $suffix + $ext)
                $suffix++
            }

            if ($DryRun) {
                Write-Info ('[dry-run] would rotate {0} ({1} MB) -> {2}' -f $active, $sizeMB, $archive)
                [void]$summary.Add([pscustomobject]@{
                    Action = 'WouldRotate'; File = $active; SizeMB = $sizeMB; Archive = $archive; Reason = ''
                })
            }
            else {
                try {
                    Move-Item -LiteralPath $active -Destination $archive -ErrorAction Stop
                    # Recreate an empty active file so following appends keep working
                    # even if the writer already re-opened the path (best effort).
                    New-Item -ItemType File -Path $active -Force | Out-Null
                    Write-Info ('rotated {0} ({1} MB) -> {2}' -f $active, $sizeMB, $archive)
                    [void]$summary.Add([pscustomobject]@{
                        Action = 'Rotate'; File = $active; SizeMB = $sizeMB; Archive = $archive; Reason = ''
                    })
                }
                catch {
                    Write-Warning ('skipped (file in use): {0} - {1}' -f $active, $_.Exception.Message)
                    [void]$summary.Add([pscustomobject]@{
                        Action = 'Skip'; File = $active; SizeMB = $sizeMB; Archive = ''; Reason = $_.Exception.Message
                    })
                }
            }
        }

        # Retention: keep only the newest $Keep archives.
        $archives = @(Get-Archives -Directory $dir -ActivePath $active)
        if ($Keep -lt 0) { $Keep = 0 }
        if ($archives.Count -gt $Keep) {
            $stale = @($archives | Select-Object -Skip $Keep)
            foreach ($old in $stale) {
                $oldMB = [math]::Round($old.Length / 1MB, 2)
                if ($DryRun) {
                    Write-Info ('[dry-run] would delete old archive {0} ({1} MB)' -f $old.FullName, $oldMB)
                    [void]$summary.Add([pscustomobject]@{
                        Action = 'WouldDelete'; File = $old.FullName; SizeMB = $oldMB; Archive = ''; Reason = 'retention'
                    })
                }
                else {
                    try {
                        Remove-Item -LiteralPath $old.FullName -Force -ErrorAction Stop
                        Write-Info ('deleted old archive {0} ({1} MB)' -f $old.FullName, $oldMB)
                        [void]$summary.Add([pscustomobject]@{
                            Action = 'Delete'; File = $old.FullName; SizeMB = $oldMB; Archive = ''; Reason = 'retention'
                        })
                    }
                    catch {
                        Write-Warning ('failed to delete {0}: {1}' -f $old.FullName, $_.Exception.Message)
                    }
                }
            }
        }

        # Optional total size cap (active + remaining archives).
        if ($TotalCapMB -gt 0) {
            $archives = @(Get-Archives -Directory $dir -ActivePath $active)
            $activeLen = 0
            if (Test-Path -LiteralPath $active) { $activeLen = (Get-Item -LiteralPath $active).Length }
            $total = $activeLen
            foreach ($a in $archives) { $total += $a.Length }
            $capBytes = $TotalCapMB * 1MB
            # Archives are already sorted newest-first; remove from the end.
            for ($i = $archives.Count - 1; $i -ge 0; $i--) {
                if ($total -le $capBytes) { break }
                $old = $archives[$i]
                $oldMB = [math]::Round($old.Length / 1MB, 2)
                if ($DryRun) {
                    Write-Info ('[dry-run] would delete archive over cap {0} ({1} MB)' -f $old.FullName, $oldMB)
                    [void]$summary.Add([pscustomobject]@{
                        Action = 'WouldDelete'; File = $old.FullName; SizeMB = $oldMB; Archive = ''; Reason = 'total-cap'
                    })
                }
                else {
                    try {
                        Remove-Item -LiteralPath $old.FullName -Force -ErrorAction Stop
                        Write-Info ('deleted archive over cap {0} ({1} MB)' -f $old.FullName, $oldMB)
                        [void]$summary.Add([pscustomobject]@{
                            Action = 'Delete'; File = $old.FullName; SizeMB = $oldMB; Archive = ''; Reason = 'total-cap'
                        })
                    }
                    catch {
                        Write-Warning ('failed to delete {0}: {1}' -f $old.FullName, $_.Exception.Message)
                    }
                    $total -= $old.Length
                }
            }
        }
    }
}

return $summary
