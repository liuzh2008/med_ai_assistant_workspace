# 完整示例：登录模块

以下展示 login 模块从零到预览的完整过程。

## 1. 截图脚本

**文件**：`med_ai_assistant_1.0_bs_vue/cypress/e2e/help/login-screenshots.cy.js`

```javascript
describe('登录帮助截图', () => {
  const TEST_USER = '1657'
  const TEST_PASS = '123'

  beforeEach(() => {
    cy.clearLocalStorage()
    cy.viewport(1920, 1080)
  })

  it('完整登录流程', () => {
    // 步骤 1：访问登录页面
    cy.visit('/')
    cy.get('.login-container', { timeout: 10000 }).should('be.visible')
    cy.get('.login-container').screenshot('help/login/login-visit-page', { overwrite: true })

    // 步骤 2：输入用户名
    cy.contains('.el-form-item', '用户').find('input').clear().type(TEST_USER, { delay: 80 })
    cy.get('.login-container').screenshot('help/login/login-enter-username', { overwrite: true })

    // 步骤 3：打开科室下拉框 → 截图
    cy.contains('.el-form-item', '密码').click()
    cy.wait(2000)
    cy.contains('.el-form-item', '科室').find('.el-select').click()
    cy.get('.el-select-dropdown__item', { timeout: 10000 }).should('have.length.gte', 1)
    // 单独截图下拉框（body 层）
    cy.get('.el-select-dropdown:visible').screenshot('help/login/login-select-department', { overwrite: true })

    // 选择科室并补充截图
    cy.get('body').then(($body) => {
      const items = $body.find('.el-select-dropdown__item')
      const target = items.filter((i, el) => el.innerText.includes('心血管'))
      if (target.length > 0) cy.wrap(target.first()).click()
      else cy.wrap(items.first()).click()
    })
    cy.get('h2').click()
    cy.wait(500)
    cy.get('.login-container').screenshot('help/login/login-department-selected', { overwrite: true })

    // 步骤 4：输入密码
    cy.contains('.el-form-item', '密码').find('input').clear().type(TEST_PASS, { delay: 80 })
    cy.get('.login-container').screenshot('help/login/login-enter-password', { overwrite: true })

    // ... 选择专业组（略）

    // 步骤 6：表单完毕
    cy.get('.login-container').screenshot('help/login/login-form-complete', { overwrite: true })

    // 步骤 7：登录 → 免责声明
    cy.contains('button.el-button--primary', '登录').click()
    cy.contains('button', '我已阅读并同意', { timeout: 15000 }).should('be.visible')
    cy.get('.el-dialog').screenshot('help/login/login-disclaimer', { overwrite: true })
    cy.contains('button', '我已阅读并同意').click()

    // 步骤 9：患者列表主页
    cy.url({ timeout: 20000 }).should('include', '/patients')
    cy.get('.patient-list, .el-table', { timeout: 10000 }).should('be.visible')
    cy.get('.main-layout').screenshot('help/login/login-patient-list', { overwrite: true })

    // 步骤 10：顶部导航栏
    cy.wait(1000)
    cy.get('.main-layout').screenshot('help/login/login-user-menu', { overwrite: true })
  })
})
```

**关键设计决策**：
- 所有表单截图用 `.login-container`（元素级，842×348）
- 下拉框用 `.el-select-dropdown:visible`（body 层，300×114）
- 弹窗用 `.el-dialog`（非 `.el-message-box`）
- 主页用 `.main-layout`（含顶栏，1882×985）

---

## 2. 运行脚本

```powershell
cd med_ai_assistant_1.0_bs_vue
npx cypress run --browser edge --spec "cypress/e2e/help/login-screenshots.cy.js" --headless
```

输出：
```
  Screenshots:  9
  - login-visit-page.png          (842x348)
  - login-enter-username.png      (842x348)
  - login-select-department.png   (300x114)
  - login-department-selected.png (842x348)
  - login-enter-password.png      (842x348)
  - login-form-complete.png       (842x348)
  - login-disclaimer.png          (800x375)
  - login-patient-list.png        (1882x985)
  - login-user-menu.png           (1882x985)
```

---

## 3. 复制截图

```powershell
Copy-Item -Force `
  "med_ai_assistant_1.0_bs_vue\cypress\screenshots\login-screenshots.cy.js\help\login\*" `
  -Destination "docs\public\screenshots\help\login\"
```

---

## 4. Markdown 帮助文档

**文件**：`docs/help/login.md`

```markdown
# 登录系统

## 适用场景
- 首次使用本系统
- 退出后需要重新登录
- 切换科室或账号

## 操作步骤

### 1. 打开登录页面
![登录页面](/screenshots/help/login/login-visit-page.png)
在浏览器地址栏中输入系统地址，进入登录页面。左侧展示医院实景图片，右侧为登录表单。

### 2. 输入用户名
![输入用户名](/screenshots/help/login/login-enter-username.png)
在"用户"输入框中输入账号。输入完成后点击密码区域，系统自动加载科室列表。

### 3. 选择科室
![科室下拉列表](/screenshots/help/login/login-select-department.png)
点击"科室"下拉框，从列表中选择所属科室。科室为必选项。

选择科室后，下拉框显示已选科室：
![科室已选择](/screenshots/help/login/login-department-selected.png)

...（其他步骤以此类推）

## 注意事项
- 登录时必须选择科室，否则无法登录
- 专业组为可选字段
- 首次登录后建议立即修改初始密码

## 常见问题

### Q: 忘记密码怎么办？
A: 联系系统管理员重置密码。

### Q: 输入用户名后科室列表为空？
A: 先点击密码输入框触发失焦事件，系统才会加载科室列表。
```

**设计决策**：
- 操作步骤可以有补充截图（如 `login-department-selected`）
- 注意事项和常见问题是独立的顶层章节
- 操作步骤内不嵌套 `##`，只用 `###` 子标题

---

## 5. VitePress 配置

在 `docs/.vitepress/config.ts` 中：

```typescript
// nav
{ text: '帮助文档', link: '/help/login' }

// sidebar
'/help/': [
  { text: '登录系统', link: '/help/login' },
  // 后续模块追加...
]
```

---

## 6. 构建知识库

```powershell
cd docs\worker
npx tsx ../ai-knowledge/build-knowledge.ts

# 输出：
# [source] 50 个文件 200 条知识
# [help] 1 个文件 4 条知识
# 知识库构建完成，共 204 条
```

---

## 7. 预览

```powershell
cd docs
npx vitepress dev
```

访问 `http://localhost:5173/med_ai_assistant_workspace/help/login`

---

## 对比：元素截图 vs 全视口截图

| 截图 | 全视口（旧） | 元素截图（新） | 缩减 |
|------|-------------|---------------|------|
| login-visit-page | 1890×1001 | 842×348 | **76%** |
| login-select-department | 1890×1001 | 300×114 | **98%** |
| login-disclaimer | 1890×1001 | 800×375 | **84%** |
