<#
.SYNOPSIS
    Run the Gitee download speed test inside a remote server's Docker container (default: main server med-ai-main).

.DESCRIPTION
    Remote entry for scripts/gitee-speed-test.sh:
      1) scp the bash script to the target server /tmp
      2) docker cp it into the target container (or run on host with -HostMode)
      3) docker exec it and stream the report back
      4) optionally save the report under doc\性能测试\ (or a custom path)

    The bash script measures, from inside the container:
      - network baseline: DNS / TCP connect / TLS / TTFB to gitee.com
      - public bandwidth sampling: timed download of a big public repo archive (no disk write)
      - private repo archive + single file: needs GITEE_ACCESS_TOKEN
        (main server container has no token; by default we borrow it from med-ai-execution-server)

.NOTES
    Keep this file ASCII-only. Windows PowerShell 5.1 decodes BOM-less script files
    using the ANSI code page, and any non-ASCII text breaks parsing.
#>
[CmdletBinding()]
param(
    [string]$Target = "testserver",
    [string]$Container = "med-ai-main",
    [string]$Owner = "chengdu-qingzhou_0",
    [string]$Repo = "med_ai_assistant_1.0_bs_backend",
    [string]$Ref = "main",
    [string]$Modes = "baseline,archive,single",
    [int]$Rounds = 2,
    [int]$SampleSeconds = 15,
    [int]$MaxTime = 600,
    [string]$TokenFromContainer = "med-ai-execution-server",
    [string]$OutFile = "",
    [switch]$NoToken,
    [switch]$Report,
    [switch]$Json,
    [switch]$HostMode
)

$ErrorActionPreference = "Stop"

if ($HostMode) { $Container = "" }
if ($NoToken) { $TokenFromContainer = "" }

# 1. locate local bash script
$scriptPath = Join-Path $PSScriptRoot "gitee-speed-test.sh"
if (-not (Test-Path $scriptPath)) {
    throw "Test script not found: $scriptPath"
}
$remoteScript = "/tmp/gitee-speed-test.sh"

# 2. argument line (ASCII, no spaces -> safe across ssh layers)
$argLine = "--owner $Owner --repo $Repo --ref $Ref --modes $Modes --rounds $Rounds --sample-seconds $SampleSeconds --max-time $MaxTime"
if ($Json) { $argLine += " --json" }

# 3. upload
Write-Host "==> uploading gitee-speed-test.sh to ${Target}:$remoteScript" -ForegroundColor Cyan
& scp -o BatchMode=yes $scriptPath "${Target}:$remoteScript"
if ($LASTEXITCODE -ne 0) { throw "scp failed (exit $LASTEXITCODE)" }

# 4. build remote command (single-quoted pieces, so PowerShell does not expand $)
$remote = "sed -i 's/\r`$//' $remoteScript; chmod +x $remoteScript; "

if ([string]::IsNullOrEmpty($Container)) {
    $remote += "bash $remoteScript $argLine"
    $where = "$Target (host)"
}
else {
    $remote += "docker cp $remoteScript ${Container}:$remoteScript && "
    if ([string]::IsNullOrEmpty($TokenFromContainer)) {
        $remote += "docker exec $Container bash $remoteScript $argLine"
    }
    else {
        # borrow token from another container, inject via docker exec -e (never in URL/logs)
        $remote = "TOKEN=`$(docker exec $TokenFromContainer printenv GITEE_ACCESS_TOKEN 2>/dev/null || true); " + $remote
        $remote += "docker exec -e GITEE_ACCESS_TOKEN=`"`$TOKEN`" $Container bash $remoteScript $argLine"
    }
    $where = "$Target (container $Container)"
}

Write-Host "==> running speed test on $where" -ForegroundColor Cyan
Write-Host "    modes=$Modes rounds=$Rounds sample=${SampleSeconds}s" -ForegroundColor DarkGray
Write-Host ""

# 5. execute (force UTF-8 so Chinese output survives)
$oldEnc = [Console]::OutputEncoding
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
try {
    $output = & ssh -o BatchMode=yes $Target $remote 2>&1
    $exit = $LASTEXITCODE
}
finally {
    [Console]::OutputEncoding = $oldEnc
}

$text = ($output | Out-String)
Write-Host $text.TrimEnd()

if ($exit -ne 0) {
    Write-Host "==> finished with exit code $exit (some items failed)" -ForegroundColor Yellow
}
else {
    Write-Host "==> done" -ForegroundColor Green
}

# 6. optional report
$savePath = $OutFile
if ([string]::IsNullOrEmpty($savePath) -and $Report) {
    $root = Split-Path $PSScriptRoot -Parent
    $dir = Join-Path $root ("doc\" + [char]0x6027 + [char]0x80FD + [char]0x6D4B + [char]0x8BD5)
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $savePath = Join-Path $dir "gitee-speed-$stamp.md"
}
if (-not [string]::IsNullOrEmpty($savePath)) {
    $header = "# Gitee download speed test - $where`r`n`r`n- time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`r`n- repo: $Owner/$Repo@$Ref`r`n`r`n" + '```text' + "`r`n"
    $footer = "`r`n" + '```'
    [IO.File]::WriteAllText($savePath, $header + $text.TrimEnd() + $footer, [Text.UTF8Encoding]::new($false))
    Write-Host "==> report saved: $savePath" -ForegroundColor Green
}

exit $exit
