---
name: ssh-testserver
description: SSH remote connection to project test server (100.66.1.4) and test VM (192.168.110.130). Use when user asks about server status, remote file operations, deployment checks, service diagnostics, or mentions 100.66.1.4/testserver/测试服务器/跳板机.
---

# SSH Remote Connection Skill

## Connection Targets

| Alias | Host | User | Role |
|-------|------|------|------|
| testserver | 100.66.1.4 | liuzh2008 | Test main server (Ubuntu 24.04) / Jump host |

## Key Services on 100.66.1.4

| Service | Port | Check Command |
|---------|------|---------------|
| SSH | 22 | `ss -tlnp \| grep ':22 '` |
| Backend API | 8081 | `ss -tlnp \| grep ':8081 '` |
| Execution API | 8082 | `ss -tlnp \| grep ':8082 '` |

## Server Directory Layout

```
/home/liuzh2008/medai/
├── build-files/
│   ├── backend/    ← Backend JAR builds
│   └── frontend/   ← Frontend dist builds
└── downloads/      ← Temp file transfer area
```

## Connection Rules

**CRITICAL**: Use `liuzh2008` user. The old `administrator` user was for the previous Windows server (100.66.1.3).

- Direct: `ssh liuzh2008@100.66.1.4 "<command>"`
- Alias: `ssh testserver "<command>"`
- File transfer: `scp <local> liuzh2008@100.66.1.4:/home/liuzh2008/medai/downloads/<remote>`
- Download: `scp liuzh2008@100.66.1.4:/home/liuzh2008/medai/<path> <local>`

## Common Operations

### Check Build Artifacts
```powershell
ssh testserver "ls /home/liuzh2008/medai/build-files/backend/"
ssh testserver "ls /home/liuzh2008/medai/build-files/frontend/"
```

### Check Service Status
```powershell
ssh testserver "ss -tlnp | grep ':8081'"
ssh testserver "ss -tlnp | grep ':8082'"
```

### Check Java Process
```powershell
ssh testserver "ps aux | grep java"
```

### Check Backend Logs
```powershell
ssh testserver "tail -100 /home/liuzh2008/medai/build-files/backend/logs/application.log"
```

### ProxyJump to Target (if needed)
```powershell
ssh -J liuzh2008@100.66.1.4 <user>@<target-ip> "<command>"
```

### Upload Build Files
```powershell
scp target\medai.jar liuzh2008@100.66.1.4:/home/liuzh2008/medai/build-files/backend/
scp -r dist\* liuzh2008@100.66.1.4:/home/liuzh2008/medai/build-files/frontend/
```

### Start/Restart Backend Service
```powershell
ssh testserver "cd /home/liuzh2008/medai/build-files/backend && ./start.sh"
```

## Troubleshooting

If authentication fails:
1. Verify using `liuzh2008` user (not `administrator` — that was for the old 100.66.1.3 Windows server)
2. Check SSH config: `Get-Content "$env:USERPROFILE\.ssh\config"`
3. Verify key exists: `Get-Content "$env:USERPROFILE\.ssh\id_ed25519.pub"`
4. If key auth fails, ensure password fallback: `PreferredAuthentications password,keyboard-interactive,publickey`

SSH config should contain:
```
Host testserver
    HostName 100.66.1.4
    User liuzh2008
```
