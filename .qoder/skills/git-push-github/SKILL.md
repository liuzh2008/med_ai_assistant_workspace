---
name: git-push-github
description: Push Git commits to GitHub via SSH with aTrust VPN-compatible KEX algorithm. Use when the user asks to push, commit and push, or when git push fails with SSH timeout. Must be used for all git push operations in this project.
---

# Git Push to GitHub (aTrust VPN Compatible)

## Background

深信服 aTrust VPN 的 DPI 模块拦截 GitHub SSH 默认密钥交换算法 `curve25519-sha256`，导致 `git push` 超时。需使用 `diffie-hellman-group-exchange-sha256` 算法。

## Push Workflow

### Step 1: 直接推送（优先尝试）

先不检查配置，直接对有提交的仓库执行 `git push`。绝大多数情况下 SSH 配置已就绪，无需额外步骤。

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

**若全部推送成功 → 流程结束，无需后续步骤。**

### Step 2: 失败时才进入诊断（仅在 push 报错时执行）

若 `git push` 报 `Connection reset`、`Connection timed out` 或 `Could not read from remote repository`：

#### 2a. 检查 SSH 配置

读取 `~/.ssh/config`，确认包含以下配置块：

```
Host github.com
    HostName github.com
    User git
    KexAlgorithms diffie-hellman-group-exchange-sha256
```

#### 2b. 如缺失，追加配置

在 `~/.ssh/config` 末尾添加上述配置块。注意文件末尾保留一个空行。

#### 2c. 验证 SSH 连接

```powershell
ssh -T git@github.com
```

预期输出：`Hi liuzh2008! You've successfully authenticated...`

若卡在 `expecting SSH2_MSG_KEX_ECDH_REPLY` → KEX 算法被拦截（配置未生效或被覆盖）。

#### 2d. 检查 remote URL

若 `ssh -T` 成功但 `git push` 仍失败 → 确认 remote URL 为 SSH 格式（`git@github.com:liuzh2008/xxx.git`），禁止 HTTPS。

```powershell
git remote -v
```

若为 HTTPS 格式，切换为 SSH：

```powershell
git remote set-url origin git@github.com:liuzh2008/<repo>.git
```

#### 2e. 重试推送

修复后重新执行 Step 1 的推送命令。

#### 2f. 终极手段

若仍失败 → 断开 aTrust VPN 重试。

## 参考

- 详细排查文档：`med_ai_assistant_1.0_bs_backend/doc/问题修复/2026-06-13-深信服aTrust DPI拦截GitHub SSH默认密钥交换算法导致推送超时.md`
