---
name: git-push-github
description: Push Git commits to GitHub via SSH with aTrust VPN-compatible KEX algorithm. Use when the user asks to push, commit and push, or when git push fails with SSH timeout. Must be used for all git push operations in this project.
---

# Git Push to GitHub (aTrust VPN Compatible)

## Background

**2026-11-04 修订（重要）**：GitHub 已不再提供 `diffie-hellman-group-exchange-sha256`
（当前 offer：`mlkem768x25519-sha256` / `sntrup761x25519-sha512` / `curve25519-sha256` / `ecdh-*`）。
旧配置把 KEX 固定成 group-exchange 会直接报
`no matching key exchange method found`，**任何仓库都推不上去**。

实测当前网络（本机 + aTrust）下 `curve25519-sha256` **可正常认证**（aTrust 未再拦截）。
故配置改回 curve25519；若将来又被 DPI 拦截，优先试 `sntrup761x25519-sha512`（GitHub 提供，DPI 特征不同）。

历史背景：2026-09 深信服 aTrust VPN 的 DPI 曾拦截 `curve25519-sha256`，当时用
`diffie-hellman-group-exchange-sha256` 绕开；该算法现已被 GitHub 移除。

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

读取 `~/.ssh/config`，确认 github.com 块使用 GitHub 当前支持的算法（**不要再写 group-exchange**）：

```
Host github.com
    HostName github.com
    User git
    KexAlgorithms curve25519-sha256
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
