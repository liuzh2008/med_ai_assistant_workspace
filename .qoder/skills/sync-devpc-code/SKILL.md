---
name: sync-devpc-code
description: SSH to devpc (100.66.1.1, Windows LiuUltra) and sync project code with GitHub origin. Use when user asks to sync code on 100.66.1.1 / devpc / LiuUltra, or says 在100.66.1.1上同步代码 / 同步devpc / 把代码同步到100.66.1.1.
whenToUse: 用户要求在 100.66.1.1（devpc / LiuUltra，Windows 开发机）上同步 med_ai_assistant_workspace 代码时使用。包含 SSH 连接要点、cmd 引号坑、scp+ps1 执行姿势、stash/pull/pop 同步流程与子模块手动 checkout。
---

# Sync Code on devpc (100.66.1.1)

## Connection

- 别名: `ssh devpc`(**必须用别名**;裸连 `ssh 100.66.1.1` 不带用户名会在 `service_accept` 后立刻被断开)
- 主机: 100.66.1.1 | 用户: `47044` | 密钥: `~/.ssh/id_ed25519`
- 系统: Windows 11 (主机名 LiuUltra, liuultra\47044), OpenSSH_for_Windows_9.5, **默认 shell = cmd.exe**(分号不拆命令,`echo a; whoami` 会原样输出;多命令用 `&`)

`~/.ssh/config` 已有条目:
```
Host devpc
    HostName 100.66.1.1
    User 47044
    IdentityFile ~/.ssh/id_ed25519
    PreferredAuthentications publickey,password,keyboard-interactive
```

连通性验证:
```powershell
ssh -o BatchMode=yes devpc "ver & whoami & hostname"
# 期望: liuultra\47044 / LiuUltra
```

## Target Repository

- 路径: `D:\MedAiAssistant 1.0\MedAiAssistant 1.0 BS`(两层含空格路径)
- **注意区分**: `D:\MedAiAssistant 1.0` 下另有发布目录(MedAssisantRebuild_WPF.exe + DLL);`D:\MedAiAssistant` 是同样的 WPF 发布副本;`D:\MedAiAssistantProject` 是资料目录(非 git)。源码仓库只有 `D:\MedAiAssistant 1.0\MedAiAssistant 1.0 BS`
- 主仓库 remote: `origin = git@github.com:liuzh2008/med_ai_assistant_workspace.git`(分支 master);另有 `gitee = git@gitee.com:chengdu-qingzhou_0/med_ai_assistant_workspace.git`
- 子模块(**无 .gitmodules,裸 gitlink**): `med_ai_assistant_1.0_bs_backend`(分支 main)、`med_ai_assistant_1.0_bs_vue`(分支 master);remote 同为 github liuzh2008 / gitee chengdu-qingzhou_0

## CRITICAL 坑: 引号在 ssh 多层传递中被吞

本机 PowerShell → ssh → 远端 cmd 的引号传递会丢失,导致:
- `ssh devpc 'git -C "D:\MedAiAssistant 1.0\..." status'` → git 收到 `-C D:\MedAiAssistant`,报 `git: '1.0\MedAiAssistant' is not a git command`
- `ssh devpc 'dir "D:\MedAiAssistant 1.0" /b'` → 实际列出 `D:\MedAiAssistant`(WPF 发布目录),**误判目标目录不存在**

**正确姿势(必须遵守): 远端命令写 .ps1 脚本 → scp → powershell 执行**
1. 本机用 write 工具写脚本,**内容纯 ASCII**(PowerShell 5.1 按 ANSI 解码无 BOM UTF-8,脚本里出现中文会乱码;路径含空格用变量 + `-LiteralPath`)
2. 上传: `scp -o BatchMode=yes <local.ps1> devpc:<name>.ps1`(落到 `C:\Users\47044`)
3. 执行: `ssh -o BatchMode=yes devpc 'powershell -NoProfile -ExecutionPolicy Bypass -File "%USERPROFILE%\<name>.ps1"'`
4. 用完清理: `ssh -o BatchMode=yes devpc 'del /q "%USERPROFILE%\<name>.ps1"'`

## Sync Procedure(与 GitHub origin 同步,保留本地未提交改动)

```powershell
$repo = 'D:\MedAiAssistant 1.0\MedAiAssistant 1.0 BS'
Set-Location -LiteralPath $repo

# 1. 预检:落后多少、本地有无改动
git fetch origin
git log --oneline HEAD..origin/master      # 落后提交
git status --short --branch

# 2. 同步主仓库(本地有未提交改动时必须先 stash)
git stash push -m "sync-auto-stash"
git pull --ff-only origin master
git stash pop                              # 自动合并;冲突则人工处理

# 3. 子模块同步(git submodule update 会报 "No url found ... in .gitmodules",须手动)
git -C "$repo\med_ai_assistant_1.0_bs_backend" fetch origin
git -C "$repo\med_ai_assistant_1.0_bs_backend" checkout <target-sha>
git -C "$repo\med_ai_assistant_1.0_bs_vue" fetch origin
git -C "$repo\med_ai_assistant_1.0_bs_vue" checkout <target-sha>

# 4. 验证
git status --short --branch                 # master...origin/master 无 ahead/behind 即同步
git -C "$repo\med_ai_assistant_1.0_bs_backend" log -1 --oneline
git -C "$repo\med_ai_assistant_1.0_bs_vue" log -1 --oneline
```

### 子模块目标 sha 选择
- **默认(与本机 100.66.1.3 一致)**: 子模块各自远程最新——`git -C <sub> rev-parse origin/main`(backend)/`origin/master`(vue)。注意: 这通常比主仓库 gitlink 指针新 1 个提交,同步后主仓库 status 显示子模块 `(new commits)` 属正常
- **严格匹配主仓库指针**: checkout 到 `git ls-files --stage` 中 160000 模式条目记录的 sha(此时主仓库 status 完全干净)

## Known State(2026-08-21 同步后基线)

- 主仓库 HEAD `209b687`(fix DSH 助手打开慢,版本 0.9.269);backend `5d6fb627`;vue `ed3e7cf2`;gitlink 指针 `68ab2e5f`/`9be12336`(未跟进,待下次主仓库提交)
- 远端本地未提交改动(同步时保留,勿动): `doc/更新日志/2026-08-21.md`、`记忆库/踩坑与教训.md`(已修改)、专利申请 docx/md(未跟踪)

## Troubleshooting

- `Connection closed by 100.66.1.1 port 22`: 用户名不对,改用 `devpc` 别名(用户 47044)
- git fetch/pull 走 GitHub SSH 超时: 远端 `~/.ssh/config` 的 github.com 条目已配 `KexAlgorithms diffie-hellman-group-exchange-sha256`(aTrust 兼容),无需改动
- `git submodule update` 失败(No url found in .gitmodules): 项目无 `.gitmodules`,这是预期,按上文手动 checkout
- stash pop 冲突: 保留冲突标记人工处理;stash 未 drop 前数据安全(可用 `git stash list` 找回)
