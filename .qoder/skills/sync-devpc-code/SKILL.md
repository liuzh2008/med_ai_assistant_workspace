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
#    推荐: fetch 后 merge --ff-only 到主仓库 gitlink 指针 sha(保持分支,不 detached)
$bSha = ((git ls-files --stage med_ai_assistant_1.0_bs_backend) -split '\s+')[1]
$vSha = ((git ls-files --stage med_ai_assistant_1.0_bs_vue) -split '\s+')[1]
git -C "$repo\med_ai_assistant_1.0_bs_backend" fetch origin
git -C "$repo\med_ai_assistant_1.0_bs_backend" merge --ff-only $bSha
git -C "$repo\med_ai_assistant_1.0_bs_vue" fetch origin
git -C "$repo\med_ai_assistant_1.0_bs_vue" merge --ff-only $vSha

# 4. 验证(必须含 ls-remote 实时核对,见上方 CRITICAL 坑 2)
git ls-remote origin master; git rev-parse HEAD
git -C "$repo\med_ai_assistant_1.0_bs_backend" ls-remote origin main
git -C "$repo\med_ai_assistant_1.0_bs_vue" ls-remote origin master
git status --short --branch                 # master...origin/master 无 ahead/behind
git -C "$repo\med_ai_assistant_1.0_bs_backend" log -1 --oneline
git -C "$repo\med_ai_assistant_1.0_bs_vue" log -1 --oneline
```

### 记忆库文件 stash pop 冲突的归并方法(2026-09-17 两次实战)

`记忆库/*.md` 是**按日期追加**的文件,双方的"改动"几乎总是各自追加条目,不是真冲突。归并原则: **两边条目全保留,按日期插到正确位置**(不要简单地 ours+theirs 顺次拼接,会出现日期倒错)。

可复用的远端脚本套路(纯 ASCII,锚点只用日期数字,不要带中文/尾随空格):
1. `[regex]::Split($text, '(?<=\n)')` 切行 —— **保留原始行尾**(该仓库 core.autocrlf 使工作区混有 LF/CRLF,`ReadAllLines`+`Join` 会把整文件行尾改掉,产生巨大 diff)
2. 定位 `<<<<<<<` / `=======`(用 `.TrimEnd() -eq '======='` 精确匹配) / `>>>>>>>` 三行,取出 ours / theirs 段
3. `theirs` 段内按 `'^### YYYY-MM-DD'` 再切条目;`ours` 段内用日期锚点找插入点(如 `'^## 2026-09-12'`),把 theirs 条目插到该日期应处的位置
4. 写回: `[IO.File]::WriteAllText($p, $s, (New-Object Text.UTF8Encoding($hasBom)))` —— **先用 ReadAllBytes 检测原文件是否带 BOM**,带则保留
5. **写回后立即自检**: `([regex]::Matches($text,'(?m)^<<<<<<<|^=======$|^>>>>>>>')).Count` 必须为 0,再 `git add`
6. **stash 在 `git stash drop` 之前始终是安全网** —— 任何一步失败都可用 `git checkout -- <file>` + `git stash pop` 重来

锚点坑: `### 2026-09-11（nblink ...）` 日期后**紧跟全角括号、没有空格** → 用 `'^### 2026-09-11 '`(带尾随空格)匹配会失败,锚点正则一律不要带尾随空格。

### 子模块目标 sha 选择
- **推荐(2026-09-17 实测有效)**: 严格对齐主仓库 gitlink 指针 —— `git ls-files --stage` 中 160000 模式条目记录的 sha。主仓库 pull 完成后该指针就是"上游认可的子模块版本",`merge --ff-only <该 sha>` 后主仓库 status **完全干净**(不再显示子模块 `(new commits)`);本次实测该 sha 恰好等于子模块 `origin/main`/`origin/master` 最新
- **备选(与本机 100.66.1.3 工作区一致)**: 子模块各自远程最新 —— `git -C <sub> rev-parse origin/main`(backend)/`origin/master`(vue)。这有时会比 gitlink 新 1 个提交,此时主仓库 status 显示子模块 `(new commits)` 属预期差异,不是错误
- 注意: 子模块也要按 CRITICAL 坑 2 用 `ls-remote` 实时核对 —— 本次就出现"子模块 fetch 后 origin/main 仍停在旧 sha,`merge --ff-only` 报 Already up to date,而 gitlink 已指向更新的 sha"的情况,再 fetch 一次才补上

## CRITICAL 坑 2: devpc 的 `git fetch` 会拿到陈旧引用(2026-09-17 实测,最坑)

第一次 `git fetch origin` 后 `origin/master = 1ed0339`,**但 `git ls-remote origin master` 实时查询返回 `8626370`** —— 即 fetch 拿回的是旧 ref,落后 10 个提交却显示"已同步(0/0)"。再次 fetch 才出现 `1ed0339..8626370 master -> origin/master`。

**铁律: 同步是否真正完成,必须用实时查询核对,不能只看本地 `origin/master`:**
```powershell
git ls-remote origin master          # 实时远程 sha(唯一可信判据)
git rev-parse HEAD                   # 本地 sha
git fetch origin                     # 若两者不等,再 fetch 一次通常会补上
git -C <sub> ls-remote origin main   # 子模块同样要实时核对
```
判定"同步完成"= `git ls-remote origin master` 的 sha == 本地 HEAD **且** 各子模块 `ls-remote` 的 sha == 主仓库 gitlink 指针 sha。只跑 `git status --short --branch` 看 `behind N` 是不够的(它基于可能陈旧的 remote-tracking ref)。

## Known State(2026-09-17 同步后基线)

- 主仓库 HEAD `8626370`(feat(可观测) S5 缓存命中观测落地 + 测试服务器容器限容收口,0.9.298,回归测试后的稳定点)
- 子模块 backend `25a5b206`、vue `1e5787e0`(与主仓库 gitlink 指针**完全一致**,主仓库工作区子模块干净)
- 本轮同步分两段: 先 `43254c0 → 1ed0339`(54 提交),再 `1ed0339 → 8626370`(10 提交,因首次 fetch 旧引用而漏掉)
- 远端本地未提交改动(同步时保留,勿动): `doc/更新日志/2026-08-21.md`、`记忆库/会话记忆.md`+`环境与配置.md`+`踩坑与教训.md`、专利申请 docx/md ×2(未跟踪)
- 残留历史 stash(非同步产物,勿动): `stash@{0}`(诊断编码词典)、`stash@{1}`(v0.7.024 Duplicate row)

## Troubleshooting

- `Connection closed by 100.66.1.1 port 22`: 用户名不对,改用 `devpc` 别名(用户 47044)
- git fetch/pull 走 GitHub SSH 超时: 远端 `~/.ssh/config` 的 github.com 条目已配 `KexAlgorithms diffie-hellman-group-exchange-sha256`(aTrust 兼容),无需改动
- `git submodule update` 失败(No url found in .gitmodules): 项目无 `.gitmodules`,这是预期,按上文手动 checkout
- stash pop 冲突: 保留冲突标记人工处理;stash 未 drop 前数据安全(可用 `git stash list` 找回)
- **`git stash drop stash@{0}` 在 PowerShell 里报 `error: unknown switch 'e'`(exit 129)**: `@{0}` 被 PowerShell 当成**哈希表字面量**解析,git 只收到半截参数。必须写 `git stash drop 'stash@{0}'`(单引号);`git stash list` 不受影响是因为它没有 `@{}` 参数
- **PowerShell 函数的 `Write-Output` 会污染返回值**: `$r = MyFunc` 拿到的是"函数内所有 Write-Output 文本 + 真实 return"构成的数组,导致 `if ($r -eq 0)` 恒假(表现为"脚本明明跑成功却走失败分支")。函数内诊断输出一律用 `Write-Host`,或只 return 一个对象
- **scp 上传的 .ps1 里出现中文会乱码**: PowerShell 5.1 按 ANSI 解码无 BOM UTF-8 脚本。脚本内需要中文路径时用 `[char]0xXXXX` 拼装(如 `[char]0x8BB0+[char]0x5FC6+[char]0x5E93` = 记忆库),或把中文写进数据文件再读
- **远端 stdout 的中文必然乱码**(commit message、文件列表): 需要看中文内容时,让远端脚本把结果写成 UTF-8 文件 → `scp` 拉回本机 → 用 `read` 工具查看,不要试图在 ssh stdout 里读中文
