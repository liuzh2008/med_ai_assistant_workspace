---
name: git-commit
description: GitHub 提交并推送，自动更新版本号、生成更新日志、清理临时文件，并按分仓库策略执行三仓库提交。通过 /git-commit 斜杠命令触发。
---

# Git 提交与推送（Git Commit）

## 工作流来源

完整的 7 步 Git 提交流程定义在 `.qoder/commands/git_commit.md`，**这是唯一的事实来源（Single Source of Truth）**。执行提交时，**必须严格遵循**该文件中定义的步骤、检查点和注意事项。

> ⚠️ **禁止在本 SKILL.md 中复制命令文件的工作流内容**。任何流程变更都应直接修改 `.qoder/commands/git_commit.md`，本技能文件仅作为注册 `/git-commit` 斜杠命令的包装入口。

## 调用方式

| 方式 | 触发条件 |
|------|---------|
| 斜杠命令 | 用户输入 `/git-commit` |
| 自然语言 | 用户说"提交代码"、"推送"、"commit & push"等 |

## 执行概要

技能被调用后，必须按以下流程执行。完整步骤见 `.qoder/commands/git_commit.md`：

### 第 0 步：全仓库扫描
在三个仓库（后端、前端、根仓库）分别执行 `git status` 和 `git diff --name-only HEAD`，汇总变更文件清单。

### 第 1 步：接口文档更新
如果后端接口有变更，在 `med_ai_assistant_1.0_bs_backend/doc/接口` 下更新对应文档。

### 第 2 步：清理临时文件与代码注释
删除临时生成的 diff 文件，清除调试语句，补充 JSDoc/Javadoc 注释。

### 第 3 步：更新版本号
在项目根目录执行 `bump-version.ps1`，禁止手动编辑版本号。

### 第 4 步：生成更新日志
按三仓库要求生成当日更新日志（同天追加不覆盖）。

### 第 5 步：更新根目录更新小结
按时间倒序添加到 `更新小结.md` 最前面。

### 第 6 步：Git 提交与推送
按顺序分仓库提交：后端 → 前端 → 根仓库，逐仓 `git add` → `git status` 验证 → `git commit`，最后 SSH 推送三个仓库。

### 第 7 步：提交后验证
确认三个仓库工作区干净，最新提交记录正确。

## 质量门禁

| 检查项 | 要求 |
|--------|------|
| 版本号 | 通过 `bump-version.ps1` 自动更新，禁止手动编辑 |
| 提交流程 | 后端 → 前端 → 根仓库，逐仓 add → status → commit |
| .qoder 规则 | 只提交 repowiki/、skills/、rules/，禁止提交 agents/、plans/ |
| 临时文件 | 删除所有 diff 临时文件 |
| 更新日志 | 前后端分仓库生成，同天追加不覆盖 |