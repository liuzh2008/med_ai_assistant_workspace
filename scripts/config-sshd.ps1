# Configure sshd for key authentication
$cfgPath = "C:\ProgramData\ssh\sshd_config"
$authPath = "C:\ProgramData\ssh\administrators_authorized_keys"
$pubKey = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPFQHsRFkLkKMNFLMxDImC5oKAvriqBoT7iNk3UIMHnT win-to-test-vm"

# 1. Update sshd_config
$cfg = Get-Content $cfgPath -Raw
$cfg = $cfg -replace '(?m)^#\s*(PubkeyAuthentication\s+).*', 'PubkeyAuthentication yes'
$cfg = $cfg -replace '(?m)^#\s*(PasswordAuthentication\s+).*', 'PasswordAuthentication yes'
Set-Content -Path $cfgPath -Value $cfg -Force
Write-Host "[OK] sshd_config updated"

# 2. Write authorized_keys
Set-Content -Path $authPath -Value $pubKey -Force
Write-Host "[OK] authorized_keys written"

# 3. Set permissions
icacls $authPath /inheritance:r /grant "SYSTEM:(F)" /grant "BUILTIN\Administrators:(F)" 2>&1 | Out-Null
Write-Host "[OK] Permissions set"

# 4. Firewall
$fw = Get-NetFirewallRule -DisplayName "OpenSSH-Server-In-TCP" -ErrorAction SilentlyContinue
if (-not $fw) {
    New-NetFirewallRule -DisplayName "OpenSSH-Server-In-TCP" -Direction Inbound -Protocol TCP -LocalPort 22 -Action Allow -Profile Any
    Write-Host "[OK] Firewall rule added"
} else {
    Write-Host "[OK] Firewall rule exists"
}

# 5. Restart sshd
Restart-Service sshd
Write-Host "[OK] sshd restarted"
Write-Host "Done! ssh 47044@100.66.1.1 from 100.66.1.3"
