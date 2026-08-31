---
description:提交 git 前自动检查前端页面修改是否包含按钮及功能变更，同步更新 AIMedTeach 按钮级帮助系统帮助条目。
---

# 按钮帮助文档同步检查（Sync Help Docs）

请按以下步骤执行，每步完成后核对检查点。**本技能只修改文件，不执行 git add / commit / push**。

## 前置检查：目标前端是否已实现按钮帮助系统

按钮帮助系统 = 目标前端仓库存在 `src/help/`（含 `registry.js/ts` 与 `entries/`）。

| 目标前端 | 当前状态 |
|---------|---------|
| `AiMedTeach/med-teach-frontend`（AIMedTeach 前端） | ✅ 已实现（2026-08-29，版本 0.1.11+，Vite+TS 版） |
| `med_ai_assistant_1.0_bs_vue`（主系统 MedAI 前端） | ✅ 已实现（2026-08-31，vue-cli+JS 版，帮助并入现有右键菜单） |

- **目标前端未实现按钮帮助**：跳过同步，输出结论「该前端未实现按钮帮助系统，无需同步（如需实现可另行评估）」。
- **目标前端已实现**：继续第 1 步。

检查点：已确认目标前端是否有 `src/help/`，未实现则结束。

> 两前端实现差异：AIMedTeach 用独立右键菜单（HelpContextMenu）；主系统 MedAI 前端复用 App.vue 现有全局右键菜单（ContextMenu），按钮右键时菜单置顶追加「帮助」项，解析逻辑与 key 规范一致。

## 第1步：定位前端变更范围

在目标前端仓库执行：
```
git status
git diff --name-only HEAD
```

筛选与按钮/功能相关的变更文件：
- **AIMedTeach 前端**：`AiMedTeach/med-teach-frontend/src/views/**`、`src/components/**` 下的 `.vue` 文件（Vite+TS，`src/api/*.ts`、`src/stores/*.ts` 影响按钮行为）
- **主系统 MedAI 前端**：`med_ai_assistant_1.0_bs_vue/src/views/**`、`src/components/**` 下的 `.vue` 文件（vue-cli+JS，`src/api/*.js`、`src/store/**` 影响按钮行为）
- 帮助系统自身：`src/help/**`（entries 条目、registry、组件）

检查点：已列出目标前端全部变更文件并分类（视图 / api / stores / help / 无关文件）。

## 第2步：判定是否含按钮/功能修改

读取变更文件的 diff（`git diff HEAD -- <文件>` 或直接读取文件对比），**满足任一条件即判定为需要同步**：

| # | 变更类型 | 判定特征 |
|---|---------|---------|
| 1 | 按钮新增/删除 | el-button / button 标签数量变化 |
| 2 | 按钮文本变更 | 按钮可见文本变化（含 emoji、空格） |
| 3 | 按钮属性变更 | data-help-key、icon、size、type 等变化 |
| 4 | 绑定事件变更 | @click 目标方法变化、新增/移除事件绑定 |
| 5 | 可用性逻辑变更 | disabled / loading / v-if / v-show 条件变化 |
| 6 | 点击行为变更 | 接口调用、路由跳转、弹窗、状态机流转变化 |
| 7 | 方法变更 | 被按钮引用的 handler 重命名、删除、语义变化 |

**无按钮/功能修改**（纯样式、文案非按钮、后端无关文件）→ 输出结论「无需同步」，结束。

检查点：明确给出判定结论（需同步 / 无需同步）及依据（变更类型编号）。

## 第3步：同步帮助条目（src/help/entries/）

帮助系统位置：`AiMedTeach/med-teach-frontend/src/help/entries/`（按页面分组：auth-case / plan-create / plan-view / clinical / misc / discussion / index.ts）。

### 变更类型 → 同步动作映射

| 变更 | 同步动作 |
|------|---------|
| 新增按钮 | 读源码理解行为 → 在对应分组文件注册条目（见下方 key 规范与五段格式）；若为动态文本/纯图标按钮，同时在 Vue 文件加 `data-help-key` |
| 按钮文本变更 | 更新条目 key（「路由名::新文本」）与内容中的按钮名；检查是否有 data-help-key 引用旧键，同步更新 |
| 按钮删除 | 移除对应 `registerHelp` 条目（确认该 key 无其他按钮引用）；清理失效的 data-help-key |
| 行为变更（接口/跳转/禁用条件/弹窗/状态机） | 更新对应条目内容：触发条件（disabled/loading/mock-real 差异）、点击后的结果（接口、跳转、SSE）、注意事项 |
| data-help-key 变更 | 同步注册表键（新键必须注册；旧键若无人引用可移除） |
| src/help 自身变更 | 复核一致性：页面级键的按钮文本与渲染文本精确匹配；全局键未被重复注册覆盖 |

### key 规范（沿用帮助系统既有约定）

1. **全局键**：同文本按钮跨页面语义一致（如 查询/重置/删除/查看/上一页/提问）→ 只注册一次，key = 按钮文本
2. **页面级键**：同文本语义因页面不同 → key = 「路由名::按钮文本」，路由名取 `router/index.ts` 中 route.name
3. **同路由多步骤区分**：同一路由下多个同名按钮语义不同 → 三级键「路由名::步骤::按钮文本」
4. **动态文本按钮**（文本随状态变化，如「提交（N/M）」「继续作答/进入」「选择此模型/已选择」）→ **必须**在按钮上加 `data-help-key="固定键"`，注册表键用固定语义
5. **纯图标按钮**（无文本，如全屏、删除候选、添加 +）→ **必须**加 `data-help-key`，注册对应键
6. **跨路由渲染组件**（同一组件在多个路由名下渲染，如 DiscussionCreate 草稿态）→ 全部按钮加 data-help-key，指向主路由语义键
7. 按钮文本带 emoji/箭头/空格 → key 照抄渲染文本（`🔄 刷新列表`、`审核通过，进入讲课 →`）

### 条目五段格式（内容尽量详细）

```
## {按钮名}

### 功能说明
按钮做什么（一句概览 + 适用场景）

### 触发条件
何时可用/何时禁用（disabled 绑定、loading 态、mock/real 数据源差异）

### 点击后的结果
接口调用、SSE 流式、路由跳转、弹窗、状态流转

### 注意事项
确认弹窗、防重复点击、不可逆操作、数据回退等

### 常见问题
1~3 条常见疑问及处理
```

### 模板字符串安全

条目内容写在 TS 模板字符串中（`registerHelp('key', `...`)`），**内容禁止出现反引号 `` ` `` 与 `${` 序列**。

检查点：全部变更按钮均已按映射同步，key 规范正确，条目五段齐全。

## 第4步：验证

在 `AiMedTeach/med-teach-frontend` 目录执行：
```
npx tsc --noEmit          # 零错误
npx vitest run            # 全绿（含 src/help/__tests__/registry.test.ts）
```

可选覆盖扫描：比对全部 el-button 静态文本与注册键（全局键或「路由名::文本」后缀），确认无未覆盖按钮；扫描全部 `data-help-key` 值，确认注册表均有对应键。

检查点：
- tsc 零错误
- vitest 全绿
- 无未覆盖按钮 / 无悬空 data-help-key

## 质量门禁

| 检查项 | 要求 |
|--------|------|
| 内容真实性 | 帮助内容必须读源码撰写，不得臆测行为 |
| key 精确匹配 | 页面级键的按钮文本与渲染文本精确一致 |
| 动态/纯图标按钮 | 必须 data-help-key 且注册表存在对应键 |
| 模板字符串安全 | 内容无反引号、无 `${` |
| 验证 | tsc + vitest 全绿 |
| 不自动提交 | 只修改文件，不执行 git add / commit / push |
