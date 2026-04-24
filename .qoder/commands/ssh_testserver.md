---
description: SSH连接到100.66.1.3（执行服务器/跳板机），执行远程命令或文件操作
---

# SSH 到 100.66.1.3（执行服务器/跳板机）

## 连接信息

| 项目 | 值 |
|------|-----|
| IP | 100.66.1.3 |
| 用户 | administrator |
| SSH 别名 | testserver（已在 ~/.ssh/config 中配置） |
| 认证方式 | 公钥免密（ED25519 / RSA） |
| 公钥存放位置 | `C:\ProgramData\ssh\administrators_authorized_keys` |
| OS | Windows（OpenSSH_for_Windows_8.6） |

## 关键服务端口

| 服务 | 端口 |
|------|------|
| SSH | 22 |
| Oracle 数据库 | 1521 |
| 执行服务器 API | 8082 |
| QClaw Gateway | 28789 |

## 常用操作

### 1. 连接服务器

```powershell
# 方式一：使用别名
ssh testserver

# 方式二：直接指定
ssh administrator@100.66.1.3
```

### 2. 查看构建产物

```powershell
# 查看所有构建文件
ssh administrator@100.66.1.3 "dir C:\medai\build-files /s /b"

# 仅查看后端
ssh administrator@100.66.1.3 "dir C:\medai\build-files\backend /b"

# 仅查看前端
ssh administrator@100.66.1.3 "dir C:\medai\build-files\frontend /b"
```

### 3. 检查服务状态

```powershell
# 检查端口监听
ssh administrator@100.66.1.3 "netstat -an | findstr ':8082 '"

# 检查 Oracle
ssh administrator@100.66.1.3 "netstat -an | findstr ':1521 '"
```

### 4. ProxyJump 到测试虚拟机

```powershell
# 通过 100.66.1.3 跳转到测试虚拟机
ssh -J administrator@100.66.1.3 root@192.168.110.130
```

### 5. 文件传输（SCP）

```powershell
# 上传文件到服务器
scp localfile administrator@100.66.1.3:C:/medai/downloads/

# 从服务器下载文件
scp administrator@100.66.1.3:C:/medai/build-files/backend/medai.jar .
```

## 目录结构

```
C:\medai\
├── build-files\
│   ├── backend\    ← 后端 JAR 构建产物
│   └── frontend\   ← 前端 dist 构建产物
└── downloads\      ← 临时下载目录
```

## 免密配置说明

公钥已在 2026-03-03 配置完成：
- **开发机公钥** 已写入 `C:\ProgramData\ssh\administrators_authorized_keys`
- **sshd_config** 已启用 `PubkeyAuthentication yes`
- **icacls 权限** 已设置为仅 SYSTEM + Administrators

如需更新公钥：
1. 获取本地公钥：`Get-Content "$env:USERPROFILE\.ssh\id_ed25519.pub"`
2. SSH 到 100.66.1.3，追加公钥到 `C:\ProgramData\ssh\administrators_authorized_keys`
3. 重启 sshd：`Restart-Service sshd`
