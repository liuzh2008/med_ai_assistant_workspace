---
name: submit-templates
description: 提交 Prompt 模板库到 GitHub。自动递增 manifest.json 版本号，提交更新的模板文件并推送。
---

# Prompt 模板库提交

提交 `prompt-templates/` 目录下的模板变更到 GitHub（后端仓库）。

## 前置条件

- 工作目录：`med_ai_assistant_1.0_bs_backend/`
- 后端仓库 SSH remote：`git@github.com:liuzh2008/med_ai_assistant_1.0_bs_backend.git`
- 模板清单文件：`prompt-templates/manifest.json`

## 执行流程

### 1. JSON 格式验证（强制）

提交前必须运行验证脚本，确保所有模板 JSON 文件格式正确：

```bash
cd med_ai_assistant_1.0_bs_backend/prompt-templates
node validate-templates.js
```

检查点：
- 退出码必须为 0（全部通过）
- 如有失败文件，必须先修复 JSON 语法错误再继续提交
- 常见错误：字符串内未转义的双引号（应写为 `\"`）

❗ **验证失败时禁止继续执行后续步骤。**

### 2. 解析并递增版本号

读取 `prompt-templates/manifest.json` 中的 `version` 字段，格式为 `M.m.p`（如 `1.0.2`）。

递增规则：patch（末位）为十进制，逢 9 进一。
- `1.0.2` → `1.0.3`
- `1.0.9` → `1.1.0`（patch 溢出，middle 进 1，patch 归 0）
- `1.9.9` → `2.0.0`（middle 溢出，major 进 1）

使用 Node.js 命令解析并递增：

```bash
node -e "
const fs = require('fs');
const path = 'med_ai_assistant_1.0_bs_backend/prompt-templates/manifest.json';
const m = JSON.parse(fs.readFileSync(path, 'utf8'));
const oldVer = m.version;
let [major, minor, patch] = oldVer.split('.').map(Number);
patch++;
if (patch >= 10) {
  patch = 0;
  minor++;
  if (minor >= 10) {
    minor = 0;
    major++;
  }
}
const newVer = major + '.' + minor + '.' + patch;
m.version = newVer;
m.lastUpdated = new Date().toISOString().replace(/\.\d+Z/, 'Z');
fs.writeFileSync(path, JSON.stringify(m, null, 2) + '\n', 'utf8');
console.log('版本号: ' + oldVer + ' → ' + newVer);
"
```

### 3. 确认变更文件

```bash
git -C "med_ai_assistant_1.0_bs_backend" status
```

重点关注：
- `prompt-templates/manifest.json`（版本号已更新）
- `prompt-templates/` 下的各模板 `.json` 文件

### 4. 提交并推送

```bash
# Stage 所有模板变更
git -C "med_ai_assistant_1.0_bs_backend" add prompt-templates/

# 提交（提交信息需包含版本号和变更摘要）
git -C "med_ai_assistant_1.0_bs_backend" commit -m "feat(模板): v<新版本号> - <变更摘要>"

# SSH 推送
git -C "med_ai_assistant_1.0_bs_backend" push origin main
```

## 提交信息格式

```
feat(模板): v<新版本号> - <变更摘要>
```

示例：
```
feat(模板): v1.0.3 - 新增诊疗计划模板
feat(模板): v1.0.4 - 更新诊断分析Prompt
```

## 提交前原则自检（必做）

加载技能 `principle-docs`，按其路由 read `med_ai_assistant_1.0_bs_backend/doc/原则/流程与Prompt模板优化方法.md`（模板本身还须遵守同目录《模板编写原则.md》：**模板中不得出现变量名**）。

逐条核对：
- §二 契约八要素：本次模板是否仍能回答输入结构 / 输出结构 / 措辞分层 / 动作权限 / 不确定性容器 / 证据溯源 / 失败降级 / 留痕审计；
- §五 反面清单：确认不是"看起来更准、实则更危险"的改动（删无依据条目、并容器、降召回、砍追溯段、静默降级）；
- §四 红线：零丢失、保留率 100%、断言可溯源率 100%、解析链零破坏、辅助内容不进业务数据流；
- 改动了输入开头字节（字段顺序/包装/空白）时，按 §七 工作纪律 2 做一次"改前/改后公共前缀长度"对照。

## 注意事项

- 提交前务必执行 `git status` 确认变更文件清单
- 版本号递增严格按照语义化版本 patch 递增
- 推送使用 SSH 协议（已配置 `git@github.com`）
- 如果工作目录有未提交的无关变更，只 stage `prompt-templates/` 目录
