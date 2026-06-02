---
name: generate-help-page
description: Generate help documentation pages with Cypress screenshots for the Medical AI Assistant system. Covers the full pipeline: writing element-screenshot Cypress scripts, running tests, copying screenshots, writing Markdown help pages, updating VitePress sidebar config, rebuilding AI knowledge base, and starting preview. Use when the user asks to create help pages, generate operation guides, add help documentation, or requests screenshots for documentation with terms like "帮助页面", "帮助文档", "操作指南", "生成截图".
---

# 帮助页面生成

全流程自动生成医疗AI助手系统的操作帮助页面，包含截图采集、Markdown 编写、VitePress 配置和 AI 知识库集成。

## 前置条件

- 后端 (port 8080)、执行服务器 (port 8081) 必须运行
- 前端开发服务器必须运行（`npm run serve`）
- 已安装 Cypress、Edge 浏览器

## 工作流总览

```
用户描述操作步骤 → 编写Cypress脚本 → 运行截图 → 复制到docs → 编写Markdown → 更新VitePress → 构建知识库 → 预览
```

## Phase 1：编写 Cypress 截图脚本

### 脚本路径

```
med_ai_assistant_1.0_bs_vue/cypress/e2e/help/{module}-screenshots.cy.js
```

### 脚本模板

```javascript
describe('{模块名}帮助截图', () => {
  const TEST_USER = '1657'
  const TEST_PASS = '123'

  beforeEach(() => {
    cy.clearLocalStorage()
    cy.viewport(1920, 1080)
  })

  it('完整操作流程', () => {
    // 每个步骤的标准写法：
    // 1. 执行交互
    // 2. 等待目标可见
    // 3. 元素截图

    // 登录后页面需先 realLogin()
    cy.visit('/')
    // ... 操作步骤 ...
    cy.get('.login-container').screenshot('help/{module}/{process}-{step}', { overwrite: true })
  })
})
```

### 铁律：必须使用元素级截图

```javascript
// ✗ 全视口 — 大量空白
cy.screenshot('help/login/login-visit-page')

// ✓ 元素截图 — 仅内容区域
cy.get('.login-container').screenshot('help/login/login-visit-page')
```

### CSS 选择器速查

| 页面/组件 | 选择器 |
|-----------|--------|
| 登录卡片 | `.login-container` |
| 主应用界面 | `.main-layout` |
| 弹窗/对话框 | `.el-dialog` |
| 下拉框（body 层） | `.el-select-dropdown:visible` |
| 患者列表 | `.patient-list` 或 `.el-table` |
| 患者详情标签页 | `PatientView` 内各 tab 容器 |

### 截图命名规范

```
help/{模块名}/{过程名}-{步骤名}.png
```

- 模块名：英文小写 `login`、`patient`、`ai-diagnosis`、`qc`、`drg`
- 过程名/步骤名：英文小写，连字符分隔 `enter-username`、`select-department`

### 关键规则

1. **下拉框单独截图**：Element Plus 下拉框 render 在 `body` 层，用 `.el-select-dropdown:visible` 截图
2. **对话框用 `.el-dialog`**：不要用 `.el-message-box`（不存在）
3. **登录后页面**：需先调用 `realLogin()`（见 reference.md）
4. **等待充足**：下拉框加载后 `cy.wait(2000)`、页面跳转后用 `cy.url().should('include', ...)`
5. **overwrite: true**：每次运行覆盖旧截图

---

## Phase 2：运行截图

```powershell
cd med_ai_assistant_1.0_bs_vue
npx cypress run --browser edge --spec "cypress/e2e/help/{module}-screenshots.cy.js" --headless
```

截图输出到：`cypress/screenshots/{spec文件名}/help/{module}/`

**检查**：确认每张截图的尺寸合理（登录卡片 ~842×348，不应是 ~1890×1001）。

---

## Phase 3：复制截图到 docs

```powershell
Copy-Item -Force `
  "med_ai_assistant_1.0_bs_vue\cypress\screenshots\{spec}\help\{module}\*" `
  -Destination "docs\public\screenshots\help\{module}\"
```

---

## Phase 4：编写 Markdown 帮助文档

### 文件路径

```
docs/help/{module}.md
```

### 强制四章节结构

```markdown
# 页面标题

## 适用场景
（3-5 条，简述什么情况下使用）

## 操作步骤
（按截图顺序，每个步骤配一张截图）
![截图说明](/screenshots/help/{module}/{process}-{step}.png)
步骤文字描述...

## 注意事项
（关键警示、限制条件）

## 常见问题
### Q: 问题描述？
A: 解答。
```

**硬性要求**：
- 必须包含这四个 `##` 标题——`build-knowledge.ts` 按此提取 AI 知识
- 图片路径以 `/screenshots/` 开头
- 正文完整描述操作，不能仅依赖图片

---

## Phase 5：更新 VitePress 配置

在 `docs/.vitepress/config.ts` 的 sidebar 中添加新模块：

```typescript
{
  text: '{模块中文名}',
  link: '/help/{module}'
}
```

如果是新分类，同步更新 nav。

---

## Phase 6：构建 AI 知识库

```powershell
cd docs\worker
npx tsx ../ai-knowledge/build-knowledge.ts
```

验证输出中 `[help]` 行显示了正确的文件数和条目数。

---

## Phase 7：启动预览

```powershell
cd docs
npx vitepress dev
```

通过 `http://localhost:5173/med_ai_assistant_workspace/help/{module}` 访问。

---

## 其他资源

- 完整技术参考（选择器详情、命名规范、项目路径）：[reference.md](reference.md)
- 登录模块完整示例：[examples.md](examples.md)
- 方案文档：`med_ai_assistant_1.0_bs_backend/doc/Cypress/帮助页面/`
