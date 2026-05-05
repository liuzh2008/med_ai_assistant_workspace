# Qoder push config to 100.66.1.3
$ErrorActionPreference = "Continue"
$remoteHost = "100.66.1.3"
$pubKey = Get-Content "C:\Users\47044\.ssh\id_ed25519.pub"

Write-Host "Step 1: Check SSH key" -ForegroundColor Cyan
$result = ssh -o BatchMode=yes -o ConnectTimeout=5 $remoteHost "echo ok" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "SSH key OK" -ForegroundColor Green
} else {
    Write-Host "Need password to deploy key" -ForegroundColor Yellow
    ssh $remoteHost "powershell -Command if (-not (Test-Path \$env:USERPROFILE\.ssh)) { New-Item -ItemType Directory -Path \$env:USERPROFILE\.ssh -Force }; Add-Content -Path \$env:USERPROFILE\.ssh\authorized_keys -Value '$pubKey'"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Key deployed" -ForegroundColor Green
    } else {
        Write-Host "Key deploy failed" -ForegroundColor Red
        pause; exit 1
    }
}

Write-Host "Step 2: Push Qoder config" -ForegroundColor Cyan

$rq = "/C:/Users/administrator/.qoder"
$lq = "C:\Users\47044\.qoder"

Write-Host "Create remote dirs..." -ForegroundColor Gray
ssh $remoteHost "powershell -Command New-Item -ItemType Directory -Path C:\Users\administrator\.qoder\cache -Force; New-Item -ItemType Directory -Path C:\Users\administrator\.qoder\skills -Force; New-Item -ItemType Directory -Path C:\Users\administrator\.qoder\agents -Force; New-Item -ItemType Directory -Path C:\Users\administrator\.qoder\commands -Force; New-Item -ItemType Directory -Path C:\Users\administrator\AppData\Roaming\Qoder\User\globalStorage -Force; New-Item -ItemType Directory -Path C:\Users\administrator\AppData\Roaming\Qoder\SharedClientCache -Force" 2>&1 | Out-Null
Write-Host "Remote dirs ready" -ForegroundColor Green

Write-Host "Send .qoder\cache ..." -ForegroundColor Gray
ssh $remoteHost "powershell -Command Remove-Item -Path C:\Users\administrator\.qoder\cache -Recurse -Force -ErrorAction SilentlyContinue" 2>&1 | Out-Null
scp -r -q "$lq\cache" "${remoteHost}:${rq}/" 2>&1 | Out-Null
Write-Host "cache done" -ForegroundColor Green

foreach ($dir in @("skills","agents","commands")) {
    $ld = "$lq\$dir"
    if (Test-Path $ld -PathType Container) {
        Write-Host "Send .qoder\$dir ..." -ForegroundColor Gray
        ssh $remoteHost "powershell -Command Remove-Item -Path C:\Users\administrator\.qoder\$dir -Recurse -Force -ErrorAction SilentlyContinue" 2>&1 | Out-Null
        scp -r -q "$ld\*" "${remoteHost}:${rq}/${dir}/" 2>&1 | Out-Null
        Write-Host "$dir done" -ForegroundColor Green
    }
}

Write-Host "Send AppData configs..." -ForegroundColor Gray
$files = @(
    "User\globalStorage\state.vscdb",
    "User\globalStorage\state.vscdb.backup",
    "User\globalStorage\storage.json",
    "User\settings.json",
    "SharedClientCache\mcp.json"
)

foreach ($f in $files) {
    $lf = "C:\Users\47044\AppData\Roaming\Qoder\$f"
    if (Test-Path $lf) {
        $rd = [System.IO.Path]::GetDirectoryName($f.Replace('\','/'))
        ssh $remoteHost "powershell -Command New-Item -ItemType Directory -Path C:\Users\administrator\AppData\Roaming\Qoder\$rd -Force | Out-Null" 2>&1 | Out-Null
        scp -q "$lf" "${remoteHost}:/C:/Users/administrator/AppData/Roaming/Qoder/$($f -replace '\\','/')" 2>&1 | Out-Null
        Write-Host "   $f" -ForegroundColor Green
    }
}

Write-Host "`nAll done!" -ForegroundColor Green
Write-Host "Restart Qoder on 100.66.1.3 to load new config." -ForegroundColor Yellow
pause
