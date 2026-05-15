---
name: cypress-e2e-test
description: Cypress E2E 前端测试。使用真实 API 场景测试登录页面和需要登录态的其他功能页面。涵盖测试结构、前置条件、自定义命令和运行方式。
---

# Cypress E2E 前端测试

## 概述

本技能定义本项目 Vue 前端项目的 Cypress E2E 测试方法。所有测试**直接打真实后端 API**，禁止使用 `cy.intercept` mock 数据。

## 核心原则

- **真实场景测试**：所有请求打到真实后端 API，禁止 mock
- **登录前置**：除登录页面测试外，其它页面均需要先进行正确登录后才能测试
- **测试隔离**：每个 `beforeEach` 执行 `cy.clearLocalStorage()` + `cy.clearCookies()`，从干净状态开始

## 测试架构

```
med_ai_assistant_1.0_bs_vue/
├── cypress.config.js           # Cypress 配置
├── cypress/
│   ├── e2e/                    # 测试用例
│   │   ├── login.cy.js         # 登录页 E2E 测试
│   │   ├── login-record.cy.js  # 登录录屏演示
│   │   ├── ai-diagnosis.cy.js  # AI 诊断测试
│   │   ├── todo.cy.js          # 待办事项测试
│   │   └── treatment-plan-todo.cy.js  # 诊疗计划测试
│   ├── fixtures/               # 固定数据
│   ├── screenshots/            # 失败截图（自动生成）
│   ├── videos/                 # 测试录制视频（自动生成）
│   └── support/
│       ├── e2e.js              # 全局支持
│       └── commands.js         # 自定义命令
```

## 配置文件 (`cypress.config.js`)

| 配置项 | 值 | 说明 |
|--------|-----|------|
| `baseUrl` | `http://localhost:8080` | 前端开发服务器地址 |
| `specPattern` | `cypress/e2e/**/*.cy.{js,jsx}` | 测试文件匹配模式 |
| `viewportWidth/Height` | 1280×720 | 视口尺寸 |
| `video` | `true` | 开启测试录屏 |
| `screenshotOnRunFailure` | `true` | 失败自动截图 |
| `defaultCommandTimeout` | `10000` | 默认命令超时 10s |
| `responseTimeout` | `30000` | API 响应超时 30s |
| `env.testUsername` | `1657` | 测试账号用户名 |
| `env.testPassword` | `123` | 测试账号密码 |

## 全局异常处理 (`support/e2e.js`)

```javascript
// 忽略与功能无关的常见异常
Cypress.on('uncaught:exception', (err) => {
  if (err.message.includes('ResizeObserver loop')) return false
  if (err.message.includes('Non-Error promise rejection')) return false
  if (err.message.includes('ChunkLoadError')) return false
  return true
})
```

## 自定义命令 (`support/commands.js`)

| 命令 | 参数 | 功能 |
|------|------|------|
| `cy.login()` | `(username?, password?, department?)` | 通过 UI 完整登录 |
| `cy.waitForApi()` | `(alias, timeout?)` | 等待 API 请求 |
| `cy.mockLogin()` | `(options?)` | 直接设置 localStorage 模拟登录态 |
| `cy.navigateTo()` | `(path, waitForSelector?)` | 导航+等待元素 |

### cy.login() 内部流程

```javascript
Cypress.Commands.add('login', (username, password, department) => {
  cy.visit('/login')
  cy.get('.login-container').should('be.visible')
  // 填写用户名
  cy.get('.el-form-item').contains('label', '用户')
    .parent().find('.el-input__inner').clear().type(user)
  // 填写密码
  cy.get('.el-form-item').contains('label', '密码')
    .parent().find('.el-input__inner').clear().type(pass)
  // 选择科室
  cy.get('.el-form-item').contains('label', '科室')
    .parent().find('.el-select').click()
  cy.get('.el-select-dropdown__item').should('have.length.gte', 1)
  // 选择指定科室或第一个
  if (department) {
    cy.get('.el-select-dropdown__item').contains(department).click()
  } else {
    cy.get('.el-select-dropdown__item').first().click()
  }
  // 点击登录
  cy.get('button.el-button--primary').contains('登录').click()
  // 处理免责声明弹窗
  cy.contains('button', '我已阅读并同意', { timeout: 5000 }).click()
  // 等待跳转
  cy.url().should('not.include', '/login', { timeout: 15000 })
})
```

### cy.mockLogin() 直接设登录态

```javascript
Cypress.Commands.add('mockLogin', (options = {}) => {
  const userInfo = {
    userid: options.userid || Cypress.env('testUsername') || 'test_user',
    username: options.username || '测试用户',
    departmentId: options.departmentId || 'dept_001',
    departmentName: options.departmentName || '测试科室',
    specialtyGroup: options.specialtyGroup || ''
  }
  localStorage.setItem('userInfo', JSON.stringify(userInfo))
})
```

## 测试用例编写指南

### 1. 登录页面测试 (`login.cy.js`)

**不设任何登录态**，直接测试登录页面的完整功能。

```javascript
describe('登录页面（真实API）', () => {
  const TEST_USER = '1657'
  const TEST_PASS = '123'

  beforeEach(() => {
    cy.clearLocalStorage()
  })

  // 应验证的场景
  it('应正确加载登录页面', () => { /* 验证 h2标题、表单元素、登录按钮 */ })
  it('应支持用户名输入', () => { /* cy.contains().find('input').clear().type().should('have.value') */ })
  it('应支持密码输入', () => { /* 同上 */ })
  it('输入真实用户名后应自动加载科室列表', () => {
    // 输入用户名→触发 blur(点击密码标签)→点击科室select→验证有选项
  })
  it('登录成功后应跳转到病人列表页面', () => {
    // 填用户名→触发 blur→填密码→选科室→点登录→点免责弹窗→验证 url 包含 /patients
  })
  it('未选择科室时应提示错误', () => {
    // 不选科室→点登录→验证 .el-message--error 含"请选择科室"
  })
  it('登录失败时应显示错误信息', () => {
    // 输错误密码→选科室→点登录→验证 .el-message--error 可见
  })
  it('点击退出按钮应清除登录状态', () => {
    // 设 localStorage→访 /login→点退出→验证 localStorage 已清空
  })
  it('选择科室后应加载专业组列表', () => {
    // 选科室后→点专业组下拉→验证有选项(或有 proper 兼容处理)
  })
})
```

### 2. 需要登录态的功能页面测试

所有非登录页面的测试，**都必须先登录**，有两种方式：

#### 方式一：通过 UI 完整登录（推荐，端到端验证）

```javascript
describe('病人列表页面', () => {
  beforeEach(() => {
    cy.login() // 完整登录流程：填凭据→选科室→点登录→同意免责
    // 登录后默认跳转到 /patients
  })

  it('应显示病人列表', () => {
    cy.get('.patient-list, .el-table', { timeout: 10000 }).should('be.visible')
  })
})
```

#### 方式二：mockLogin 绕过 UI（适合不关心登录细节的测试）

```javascript
describe('待办事项功能', () => {
  beforeEach(() => {
    cy.mockLogin({ userid: '1657', departmentName: '心血管一病区' })
    cy.visit('/todo-items')
  })

  it('应加载待办列表', () => {
    cy.get('.todo-layout', { timeout: 10000 }).should('be.visible')
  })
})
```

## 通用交互模式

### el-select 下拉框选择

```javascript
// 打开下拉
cy.contains('.el-form-item', '科室').find('.el-select').click()
cy.wait(500) // 等待下拉动画

// 等待选项加载
cy.get('.el-select-dropdown__item', { timeout: 10000 }).should('have.length.gte', 1)

// 按文本选择（优先）
cy.get('body').then($body => {
  const items = $body.find('.el-select-dropdown__item')
  const target = items.filter((i, el) => el.innerText.includes('心血管'))
  if (target.length > 0) {
    cy.wrap(target.first()).click()
  } else {
    cy.wrap(items.first()).click()
  }
})
```

### 可选项兼容处理（如专业组可选字段）

```javascript
cy.contains('.el-form-item', '专业组')
  .find('.el-select')
  .then($sel => {
    const selectWrapper = $sel[0].closest('.el-select')
    if (!selectWrapper.classList.contains('is-disabled')) {
      cy.wrap($sel).click()
      // 检查是否有可见选项
      cy.get('.el-select-dropdown').then($dropdowns => {
        const visible = $dropdowns.filter((i, el) =>
          window.getComputedStyle(el).display !== 'none')
        if (visible.length > 0) {
          cy.get('.el-select-dropdown__item').first().click({ force: true })
        }
      })
    }
  })
```

### 免责声明弹窗处理

```javascript
// 首次登录必弹，直接点同意
cy.contains('button', '我已阅读并同意', { timeout: 10000 }).click()
```

### 错误消息验证

```javascript
// Element Plus 错误提示
cy.get('.el-message--error', { timeout: 5000 })
  .should('be.visible')
  .and('contain', '请选择科室')
```

## 运行方式

### 环境准备

1. 确保前端开发服务器运行：`npm run serve`（默认 `localhost:8080`）
2. 确保后端 API 服务可用
3. 确认本机安装了支持的浏览器（Edge / Electron）

### 运行命令

```powershell
# 项目工作目录
cd med_ai_assistant_1.0_bs_vue

# 无头运行全部测试
npx cypress run

# 无头运行指定测试文件
npx cypress run --spec cypress/e2e/login.cy.js

# 指定浏览器运行（默认 Electron，可选 edge）
npx cypress run --browser edge

# 交互模式（可视化界面）
npx cypress open
```

### 脚本快捷方式

```json
// package.json 已预定义
"test:e2e": "cypress run"
"test:e2e:open": "cypress open"
```

```powershell
npm run test:e2e         # 全量无头运行
npm run test:e2e:open    # 交互模式
```

### 浏览器适配

- 因本机无 Chrome，使用 `--browser edge` 指定 Edge 浏览器运行
- 可用浏览器列表通过 `npx cypress run --browser edge` 自动检测

## 测试结果

执行后 Cypress 会生成：

| 产物 | 路径 | 用途 |
|------|------|------|
| 视频 | `cypress/videos/` | 每次运行的完整录屏 |
| 截图 | `cypress/screenshots/` | 失败时的页面截图 |
| 控制台输出 | 终端 | 测试通过/失败汇总 |

## 注意事项

- **禁止 mock**：不拦截 API 请求，所有数据来自真实后端
- **登录前置**：非登录页测试必须在 `beforeEach` 中 `cy.login()` 或 `cy.mockLogin()`
- **el-select 特殊性**：Element Plus 的下拉选项渲染在 `<body>` 下，不能用常规 `cy.get()` 定位
- **等待策略**：真实 API 需要 `cy.wait(ms)` 和可配置的 `timeout` 断言配合，不能用 cy.intercept mock 数据
- **测试隔离**：`beforeEach` 必须清理 localStorage 和 cookies
- **类型支持**：若需 IntelliSense，安装 `@types/cypress` 并配置 tsconfig
- **长时间测试**：使用 `{ timeout: 20000 }` 覆盖 API 响应慢的场景
