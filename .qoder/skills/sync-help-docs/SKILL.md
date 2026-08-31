---
description: 提交 git 前自动检查前端页面修改是否包含按钮及功能变更，并自动同步 AIMedTeach 按钮级帮助系统（med-teach-frontend/src/help/entries/）的帮助条目。目标前端需已实现按钮帮助（主系统 MedAI 前端 med_ai_assistant_1.0_bs_vue 当前未实现，变更来自该前端时跳过并说明）。通过 /sync-help-docs 斜杠命令、git-commit 流程自动触发，或用户说"同步帮助文档""更新按钮帮助""提交前检查帮助"时触发。
---

# 按钮帮助文档同步（Sync Help Docs）

## 工作流来源

完整流程定义在 `.qoder/commands/sync_help_docs.md`，**这是唯一的事实来源（Single Source of Truth）**。执行时**必须严格遵循**该文件中的步骤、变更映射表和检查点。

> ⚠️ **禁止在本 SKILL.md 中复制命令文件的工作流内容**。任何流程变更都应直接修改 `.qoder/commands/sync_help_docs.md`，本技能文件仅作为注册 `/sync-help-docs` 的包装入口。

## 调用方式

| 方式 | 触发条件 |
|------|---------|
| 斜杠命令 | 用户输入 `/sync-help-docs` |
| 自然语言 | 用户说"同步帮助文档"、"更新按钮帮助"、"提交前检查帮助"、"按钮帮助没更新"等 |
| 工作流集成 | git-commit 流程中自动执行（提交前检查前端按钮/功能变更并同步帮助条目） |

## 执行概要

技能被调用后，必须按以下流程执行。完整步骤见 `.qoder/commands/sync_help_docs.md`：

### 第 0 步：前置检查（目标前端是否已实现按钮帮助）
目标前端仓库存在 `src/help/` 才适用本技能。**两个前端均已实现**：AIMedTeach 前端（`med-teach-frontend`，Vite+TS 版）与主系统 MedAI 前端（`med_ai_assistant_1.0_bs_vue`，vue-cli+JS 版，帮助项并入现有右键菜单）。两前端变更均需正常同步；若未来新增前端无 `src/help/`，对其变更跳过同步并说明。

### 第 1 步：定位前端变更范围
在对应前端仓库执行 `git status` / `git diff --name-only HEAD`，筛选 `.vue`、`api/*.ts`、`stores/*.ts`、`src/help/**` 变更文件。

### 第 2 步：判定是否含按钮/功能修改
逐一检查 diff：el-button/button 新增、删除、修改（文本、data-help-key、属性）、绑定事件变更、disabled/loading/v-if 可用性逻辑变更、点击行为（接口/跳转/弹窗/状态机）变更。
→ 无按钮/功能修改则结束（报告"无需同步"）。

### 第 3 步：同步帮助条目
按变更类型映射（新增按钮 / 文本变更 / 按钮删除 / 行为变更 / data-help-key 变更）修改 `AiMedTeach/med-teach-frontend/src/help/entries/` 对应文件，key 规范与五段格式沿用帮助系统既有约定。

### 第 4 步：验证
`npx tsc --noEmit` + `npx vitest run`（含 registry 单测）全绿；**不自动执行 git commit**。

## 质量门禁

| 检查项 | 要求 |
|--------|------|
| 内容真实性 | 帮助内容必须读源码撰写，不得臆测按钮行为 |
| key 精确匹配 | 页面级键「路由名::按钮文本」与渲染文本精确一致（去空白、emoji 照抄） |
| 动态/纯图标按钮 | 必须 `data-help-key` 且注册表存在对应键 |
| 模板字符串安全 | 条目内容禁止反引号 `` ` `` 与 `${` 序列 |
| 验证 | tsc 零错误、vitest 全绿 |
| 不自动提交 | 只修改帮助文档文件，不执行 git add / commit / push |
