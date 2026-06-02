# 技术参考

## 项目关键路径

| 用途 | 绝对路径（相对于项目根目录） |
|------|---------------------------|
| Cypress 截图脚本 | `med_ai_assistant_1.0_bs_vue/cypress/e2e/help/{module}-screenshots.cy.js` |
| 截图输出 | `med_ai_assistant_1.0_bs_vue/cypress/screenshots/{spec}/help/{module}/` |
| Docs 截图 | `docs/public/screenshots/help/{module}/` |
| 帮助 Markdown | `docs/help/{module}.md` |
| VitePress 配置 | `docs/.vitepress/config.ts` |
| AI 知识库构建 | `docs/ai-knowledge/build-knowledge.ts` |
| 知识库输出 | `docs/ai-knowledge/knowledge.json` |
| 方案文档 | `med_ai_assistant_1.0_bs_backend/doc/Cypress/帮助页面/` |

## CSS 选择器参考

### 页面级容器

| 页面 | 选择器 | 说明 |
|------|--------|------|
| 登录页 | `.login-container` | 登录卡片容器（含左侧图片 + 右侧表单） |
| 主页面（登录后） | `.main-layout` | 包含 `TopMenu` + `<main class="content">` + `<router-view>` |
| 患者列表 | `.main-layout` 或 `.patient-list` | 视需要决定是否包含顶栏 |

### Element Plus 组件

| 组件 | 选择器 | 注意事项 |
|------|--------|---------|
| 下拉框（select） | `.el-select-dropdown:visible` | 渲染在 `body` 层，必须单独截图 |
| 下拉框选项 | `.el-select-dropdown__item` | 用于判断选项数量 |
| 对话框 | `.el-dialog` | 免责声明等弹窗使用此 class |
| 消息框 | `.el-message-box` | ⚠️ 本项目不使用此类，用 `.el-dialog` |
| 表单元素 | `.el-form-item` → `label文本` → `input` | `cy.contains('.el-form-item', '用户').find('input')` |

### 常见页面组件

| 区域 | 选择器 | 用途 |
|------|--------|------|
| 患者表格 | `.patient-list, .el-table` | 登录后主界面患者列表 |
| 导航菜单 | 菜单项文本匹配 | `cy.contains('病人管理')`、`cy.contains('AI辅助')` |
| 登录按钮 | `button.el-button--primary` 含文本 `登录` | |

## 截图命名规范

```
help/{module}/{process}-{step}.png
```

**示例**：
```
help/login/login-visit-page.png            # 登录-访问页面
help/login/login-enter-username.png        # 登录-输入用户名
help/login/login-select-department.png     # 登录-选择科室（下拉框）
help/login/login-department-selected.png   # 登录-科室已选
help/login/login-enter-password.png        # 登录-输入密码
help/login/login-form-complete.png         # 登录-表单完毕
help/login/login-disclaimer.png            # 登录-免责声明
help/login/login-patient-list.png          # 登录-患者列表
help/login/login-user-menu.png             # 登录-用户菜单
```

**规则**：
- 全部英文小写，连字符分隔
- 动词在前：`select-department` 非 `department-select`
- 状态补充用过去分词：`department-selected`

## realLogin() 用法

需要登录态的页面，在脚本开头调用自定义命令：

```javascript
// 文件：cypress/support/e2e.js 中已注册
cy.realLogin('1657', '123')
// 等价于：访问登录页 → 输入账号 → 点密码触发科室加载 → 选科室 → 输密码 → 登录 → 同意免责
```

或使用 `login-utils.js` 中的 `loginViaApi()`，通过 API 直接获取 token（更快）。

## Markdown 四章节模板

```markdown
# {页面标题}

## 适用场景
- 场景1
- 场景2
- 场景3

## 操作步骤

### 1. {步骤名}
![截图说明](/screenshots/help/{module}/{process}-{step}.png)
操作描述...

### 2. {步骤名}
...

## 注意事项
- 注意点1
- 注意点2

## 常见问题

### Q: 问题？
A: 解答。

### Q: 问题？
A: 解答。
```

**要求**：
- `##` 标题必须恰好四个（适用场景/操作步骤/注意事项/常见问题）
- `###` 子标题用于操作步骤内的编号
- 图片 alt 文本用中文
- 常见问题用 `### Q:` / `A:` 格式

## VitePress 配置更新

### sidebar 模式

在 `docs/.vitepress/config.ts` 的 `sidebar` 中：

```typescript
'/help/': [
  { text: '登录系统', link: '/help/login' },
  { text: '患者管理', link: '/help/patient' },
  { text: 'AI诊断', link: '/help/ai-diagnosis' },
  { text: 'EMR病历质控', link: '/help/qc' },
  { text: 'DRG分析', link: '/help/drg' },
  // 新增模块在此追加
]
```

### nav 模式

```typescript
{ text: '帮助文档', link: '/help/login' }
```

## build-knowledge.ts 工作原理

1. 扫描 `docs/ai-knowledge/source/` 下所有 `.md` 文件
2. 扫描 `docs/help/` 下所有 `.md` 文件
3. 提取每个文件的 `##` 二级标题章节
4. help 目录的文件会过滤 `![](...)` 图片行
5. 输出为 `knowledge.json`（每条约 204 条）

**知识条目结构**：
```json
{
  "title": "适用场景",
  "content": "- 场景1\r\n- 场景2",
  "source": "help/login",
  "type": "help"
}
```

## 常见问题排查

| 问题 | 原因 | 解决 |
|------|------|------|
| 截图大量空白 | 用了 `cy.screenshot()` | 改用 `cy.get(selector).screenshot()` |
| `.el-message-box` 报错 | 本项目不使用此类 | 改用 `.el-dialog` |
| 下拉框截不到 | 下拉框在 body 层 | `.el-select-dropdown:visible` 单独截图 |
| 截图尺寸不是 1920 | Cypress iframe 内部边距 | 1890×1001 已满足要求，元素截图直接消除此问题 |
| 知识库条目数未变 | build-knowledge 未运行 | `cd docs/worker && npx tsx ../ai-knowledge/build-knowledge.ts` |
