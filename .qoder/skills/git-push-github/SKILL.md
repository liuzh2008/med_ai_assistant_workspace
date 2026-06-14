---
name: git-push-github
description: Push Git commits to GitHub via SSH with aTrust VPN-compatible KEX algorithm. Use when the user asks to push, commit and push, or when git push fails with SSH timeout. Must be used for all git push operations in this project.
---

# Git Push to GitHub (aTrust VPN Compatible)

## Background

深信服 aTrust VPN 的 DPI 模块拦截 GitHub SSH 默认密钥交换算法 `curve25519-sha256`，导致 `git push` 超时。需使用 `diffie-hellman-group-exchange-sha256` 算法。

## Push Workflow

### Step 1: 验证 SSH 配置

```powershell
powershell -Command "
if (-not (Test-Path '$env:USERPROFILE\.ssh\config')) {
    Write-Output 'SSH config not found'
} else {
    $config = Get-Content '$env:USERPROFILE\.ssh\config' -Raw
    if ($config -match 'Host github.com' -and $config -match 'KexAlgorithms diffie-hellman-group-exchange-sha256') {
        Write-Output 'SSH config OK'
    } else {
        Write-Output 'SSH config MISSING github.com KexAlgorithms'
    }
}
"
```

### Step 2: 如缺失，追加配置

在 `~/.ssh/config` 末尾添加：

```
Host github.com
    HostName github.com
    User git
    KexAlgorithms diffie-hellman-group-exchange-sha256
```

### Step 3: 验证 SSH 连接

```powershell
ssh -T git@github.com
```

预期输出：`Hi liuzh2008! You've successfully authenticated...`

### Step 4: 多仓库推送

本项目有三个独立仓库，按顺序推送：

```powershell
# 1. 后端
cd "$env:WORKSPACE_ROOT\med_ai_assistant_1.0_bs_backend"
git push

# 2. 前端
cd "$env:WORKSPACE_ROOT\med_ai_assistant_1.0_bs_vue"
git push

# 3. 根仓库
cd "$env:WORKSPACE_ROOT"
git push
```

直推有提交的仓库即可，无需全部。

## 推送失败诊断

若 `git push` 报 `Connection reset` 或 `Connection timed out`：

1. 运行 `ssh -vT git@github.com` 获取详细输出
2. 若卡在 `expecting SSH2_MSG_KEX_ECDH_REPLY` → KEX 算法被拦截，检查 Step 1-2
3. 若 `ssh -T` 成功但 `git push` 失败 → 检查 remote URL 是否为 SSH 格式（`git@github.com:...`），禁止 HTTPS
4. 若仍失败 → 断开 aTrust VPN 重试

## 参考

- 详细排查文档：`med_ai_assistant_1.0_bs_backend/doc/问题修复/2026-06-13-深信服aTrust DPI拦截GitHub SSH默认密钥交换算法导致推送超时.md`
