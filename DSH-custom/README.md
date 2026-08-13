# DeepSeek Harness 定制档案（防丢失·可重建）

本目录保存本项目对 **DeepSeek Harness**（官方仓库 https://github.com/deepseek-ai/deepseek-harness）的所有定制改动，
用于在项目文件丢失后快速、完整地重建定制版 DSH。

## 目录结构

| 路径 | 内容 |
|---|---|
| `patches/` | 按顺序应用的 git 补丁（每个定制改动一个补丁） |
| `CHANGELOG.md` | 定制变更日志（日期、内容、对应补丁） |
| `README.md` | 本重建手册 |

## 关键事实

- **官方仓库**：https://github.com/deepseek-ai/deepseek-harness
- **基线 commit**：`47f943859b`（v0.1.0-rc.5 发布后，2026-08 时点的 master）
- **环境要求**：Node.js ≥ 22、pnpm 11
- **GUI 端口**：3080，监听 0.0.0.0（局域网可用 `http://192.168.x.x:3080` 访问）

## 从零重建步骤

**方式 A：从官方仓库 + 补丁重建**（官方代码丢失也不受影响，推荐）

```powershell
# 1. 克隆官方仓库
git clone https://github.com/deepseek-ai/deepseek-harness.git
cd deepseek-harness

# 2. 切到基线版本
git checkout 47f943859b

# 3. 配置提交身份（本仓库默认无 user 配置）
git config user.name "Administrator"
git config user.email "admin@example.com"

# 4. 按顺序应用全部定制补丁（本目录 patches/ 下的文件，按编号升序）
git am "D:\MedAiAssistant 1.0 BS\DSH-custom\patches\0001-fix-client-insecure-context-randomuuid.patch"
# 若基线之后官方有新版 master，也可直接对最新 master 执行 git am；
# 出现冲突时手动解决后 git am --continue。

# 5. 安装依赖并构建（lib + web 全部产物）
pnpm install
pnpm build

# 6. 启动 GUI
pnpm dsh web
```

**方式 B：从 GitHub fork 直接克隆**（定制已推送到 fork 的 `custom/medai` 分支）

```powershell
git clone git@github.com:liuzh2008/deepseek-harness.git
cd deepseek-harness
git checkout custom/medai
pnpm install
pnpm build
pnpm dsh web
```

启动后浏览器访问 http://127.0.0.1:3080/（本机）或 http://<局域网IP>:3080/。

## 日常维护约定

1. **每次修改 DSH 源码后**（在工作副本 `custom/medai` 分支上）：
   - 按逻辑提交 git commit（lefthook 钩子会自动跑 lint）；
   - 重新导出补丁：`git format-patch 47f943859b --stdout > "D:\MedAiAssistant 1.0 BS\DSH-custom\patches\NNNN-<主题>.patch"`（导出新增部分，保留历史补丁）；
   - 在 `CHANGELOG.md` 追加一条记录；
   - 将本目录提交进主项目仓库并推送（见下）。
2. **每次新增/修改 DSH 技能后**：技能源文件在 `.qoder/skills/`（随主项目仓库提交推送即可，无需额外操作）。
3. **官方升级时**：`git fetch origin` 后将 `custom/medai` rebase 到新 master，重新导出补丁并更新本 README 的基线 commit。

## 工作副本位置与分支

- 当前工作副本：`C:\Users\Administrator\Documents\Qoder\2026-08-13\chat-1\deepseek-harness`
- 定制分支：`custom/medai`（基于官方 `master`，含全部定制提交）
- GitHub fork 备份（2026-08-13 建立，已推送 custom/medai）：
  - fork：https://github.com/liuzh2008/deepseek-harness
  - SSH：`git@github.com:liuzh2008/deepseek-harness.git`（工作副本内 remote 名为 `backup`）
  - 推送命令：`git push backup custom/medai`
- 主项目仓库（本档案随其备份）：`git@github.com:liuzh2008/med_ai_assistant_workspace.git`

## 技能链接重建

DSH 从 `.dsh/skills/` 加载技能，该目录是到 `.qoder/skills/` 的本地符号链接（不进入 git）。
在新机器上重建链接（管理员 PowerShell，主项目根目录执行）：

```powershell
New-Item -ItemType Directory -Force .dsh | Out-Null
Get-ChildItem .qoder\skills -Directory | ForEach-Object {
  $dest = Join-Path ".dsh\skills" $_.Name
  if (-not (Test-Path $dest)) { New-Item -ItemType Junction -Path $dest -Target $_.FullName | Out-Null }
}
```
