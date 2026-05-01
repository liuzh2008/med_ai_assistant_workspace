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

### 1. 解析并递增版本号

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

### 2. 确认变更文件

```bash
git -C "med_ai_assistant_1.0_bs_backend" status
```

重点关注：
- `prompt-templates/manifest.json`（版本号已更新）
- `prompt-templates/` 下的各模板 `.json` 文件

### 3. 提交并推送

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

## 注意事项

- 提交前务必执行 `git status` 确认变更文件清单
- 版本号递增严格按照语义化版本 patch 递增
- 推送使用 SSH 协议（已配置 `git@github.com`）
- 如果工作目录有未提交的无关变更，只 stage `prompt-templates/` 目录
