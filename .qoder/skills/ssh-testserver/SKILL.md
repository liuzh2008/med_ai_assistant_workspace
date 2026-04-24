---
name: ssh-testserver
description: SSH remote connection to project execution server (100.66.1.3) and test VM (192.168.110.130). Use when user asks about server status, remote file operations, deployment checks, service diagnostics, or mentions 100.66.1.3/testserver/测试服务器/执行服务器/跳板机.
---

# SSH Remote Connection Skill

## Connection Targets

| Alias | Host | User | Role |
|-------|------|------|------|
| testserver | 100.66.1.3 | administrator | Execution server / Jump host / Oracle host |
| testvm | 192.168.110.130 | root | Test VM (openEuler, via ProxyJump) |

## Key Services on 100.66.1.3

| Service | Port | Check Command |
|---------|------|---------------|
| SSH | 22 | `netstat -an \| findstr ':22 '` |
| Oracle DB | 1521 | `netstat -an \| findstr ':1521 '` |
| Execution API | 8082 | `netstat -an \| findstr ':8082 '` |
| QClaw Gateway | 28789 | `netstat -an \| findstr ':28789 '` |

## Server Directory Layout

```
C:\medai\
├── build-files\
│   ├── backend\    ← Backend JAR builds
│   └── frontend\   ← Frontend dist builds
└── downloads\      ← Temp file transfer area
```

## Connection Rules

**CRITICAL**: Always use `administrator` user. Default OS user (e.g., 47044) will fail authentication.

- Direct: `ssh administrator@100.66.1.3 "<command>"`
- Alias: `ssh testserver "<command>"`
- File transfer: `scp <local> administrator@100.66.1.3:C:/medai/downloads/<remote>`
- Download: `scp administrator@100.66.1.3:C:/medai/<path> <local>`

## Common Operations

### Check Build Artifacts
```powershell
ssh testserver "dir C:\medai\build-files\backend /b"
ssh testserver "dir C:\medai\build-files\frontend /b"
```

### Check Service Status
```powershell
ssh testserver "netstat -an | findstr ':8082'"
ssh testserver "netstat -an | findstr ':1521'"
```

### ProxyJump to Test VM
```powershell
ssh -J administrator@100.66.1.3 root@192.168.110.130 "<command>"
```

### Check Test VM Backend Service
```powershell
ssh -J administrator@100.66.1.3 root@192.168.110.130 "systemctl status med-ai-backend"
```

### Upload Build Files
```powershell
scp target\medai.jar administrator@100.66.1.3:C:/medai/build-files/backend/
scp dist\* administrator@100.66.1.3:C:/medai/build-files/frontend/
```

## Troubleshooting

If authentication fails:
1. Verify using `administrator` user (not default OS user)
2. Check SSH config: `Get-Content "$env:USERPROFILE\.ssh\config"`
3. Verify key exists: `Get-Content "$env:USERPROFILE\.ssh\id_ed25519.pub"`

SSH config should contain:
```
Host testserver
    HostName 100.66.1.3
    User administrator
```
