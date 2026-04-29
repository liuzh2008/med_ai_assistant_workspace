# OpenSSH Server Setup Script
$ErrorActionPreference = "Continue"
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  OpenSSH Server Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Step 1: Install OpenSSH Server
Write-Host "`n[1/6] Installing OpenSSH Server..." -ForegroundColor Yellow
$cap = Get-WindowsCapability -Online -ErrorAction SilentlyContinue | Where-Object { $_.Name -like 'OpenSSH.Server*' }
if ($cap -and $cap.State -eq 'Installed') {
    Write-Host "  -> Already installed" -ForegroundColor Green
} else {
    Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
    Write-Host "  -> Installed" -ForegroundColor Green
}

# Step 2: Configure sshd_config
Write-Host "`n[2/6] Configuring sshd_config..." -ForegroundColor Yellow
$cfgPath = "$env:ProgramData\ssh\sshd_config"
if (-not (Test-Path $cfgPath)) {
    Write-Host "  -> sshd_config not found, creating..." -ForegroundColor Gray
    New-Item -Path $cfgPath -ItemType File -Force | Out-Null
}

$cfg = Get-Content $cfgPath -Raw -ErrorAction SilentlyContinue
if (-not $cfg) { $cfg = "" }

if ($cfg -notmatch 'PubkeyAuthentication yes') {
    $cfg = $cfg -replace '(?m)^#?\s*PubkeyAuthentication.*', 'PubkeyAuthentication yes'
    if ($cfg -notmatch 'PubkeyAuthentication') {
        $cfg = $cfg + "`nPubkeyAuthentication yes"
    }
}

if ($cfg -notmatch 'PasswordAuthentication yes') {
    $cfg = $cfg -replace '(?m)^#?\s*PasswordAuthentication.*', 'PasswordAuthentication yes'
    if ($cfg -notmatch 'PasswordAuthentication') {
        $cfg = $cfg + "`nPasswordAuthentication yes"
    }
}

if ($cfg -notmatch 'Subsystem\s+sftp') {
    $cfg = $cfg + "`nSubsystem sftp sftp-server.exe"
}

Set-Content -Path $cfgPath -Value $cfg
Write-Host "  -> sshd_config configured" -ForegroundColor Green

# Step 3: Write authorized_keys
Write-Host "`n[3/6] Writing authorized_keys..." -ForegroundColor Yellow
$pubKey = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPFQHsRFkLkKMNFLMxDImC5oKAvriqBoT7iNk3UIMHnT win-to-test-vm"
$authFile = "$env:ProgramData\ssh\administrators_authorized_keys"
Set-Content -Path $authFile -Value $pubKey -Force
Write-Host "  -> Key written" -ForegroundColor Green

# Step 4: Set permissions
Write-Host "`n[4/6] Setting permissions..." -ForegroundColor Yellow
icacls $authFile /inheritance:r /grant "SYSTEM:(F)" /grant "BUILTIN\Administrators:(F)" 2>&1 | Out-Null
Write-Host "  -> Permissions set (SYSTEM + Administrators)" -ForegroundColor Green

# Step 5: Firewall
Write-Host "`n[5/6] Configuring firewall..." -ForegroundColor Yellow
$fw = Get-NetFirewallRule -DisplayName "OpenSSH-Server-In-TCP" -ErrorAction SilentlyContinue
if (-not $fw) {
    New-NetFirewallRule -DisplayName "OpenSSH-Server-In-TCP" -Direction Inbound -Protocol TCP -LocalPort 22 -Action Allow -Profile Any
    Write-Host "  -> Firewall rule added" -ForegroundColor Green
} else {
    Write-Host "  -> Firewall rule exists" -ForegroundColor Green
}

# Step 6: Start service
Write-Host "`n[6/6] Starting sshd..." -ForegroundColor Yellow
Set-Service sshd -StartupType Automatic -ErrorAction SilentlyContinue
Start-Service sshd -ErrorAction SilentlyContinue
$svc = Get-Service sshd -ErrorAction SilentlyContinue
if ($svc) {
    Write-Host "  -> sshd Status: $($svc.Status), StartType: $($svc.StartType)" -ForegroundColor Green
} else {
    Write-Host "  -> sshd service not found - may need reboot" -ForegroundColor Red
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Setup Complete!" -ForegroundColor Cyan
Write-Host "  Connect from 100.66.1.3: ssh 47044@100.66.1.1" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
