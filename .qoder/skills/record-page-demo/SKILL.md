---
name: record-page-demo
description: 录制医疗AI助手系统任意页面的操作演示视频。三阶段：编写 Cypress E2E 测试 → ffmpeg crop 裁剪去除 GUI 面板 → ffmpeg drawtext 叠加步骤文字标注。当用户需要录制页面演示视频、生成操作录屏、制作功能流程演示时使用，不限登录页面。
---

# 录屏页面演示

## 概述

为医疗 AI 助手系统的**任意页面/功能**录制带步骤文字标注的演示视频。

**三阶段流程**：编写 Cypress 测试 → ffmpeg 裁剪 → ffmpeg 标注

| 阶段 | 工具 | 操作 | 输出 |
|------|------|------|------|
| 编写测试 | Cypress | 根据目标页面编写 E2E 测试脚本 | `xxx-record.cy.js` |
| 录制+裁剪 | `cypress run` + ffmpeg `crop` | 无头录制后裁剪 GUI 面板 | 纯净应用界面视频 |
| 标注 | ffmpeg `drawtext` | 叠加步骤文字和时间线 | 最终演示视频 |

## 前置条件

- 前端 dev server 运行中（`localhost:8080`）
- 后端 API 服务运行中（`localhost:8081`）
- ffmpeg 已安装（`npm install --save-dev @ffmpeg-installer/ffmpeg`）
- Cypress 已配置（`cypress.config.js` 中 `video: true`）

## 通用工作流

### 1. 编写目标页面的 Cypress 测试

根据用户指定的页面/功能，编写一个**仅含正常操作流程**的 Cypress 测试文件，放到 `cypress/e2e/` 下。

**关键原则**：
- 只模拟一条成功的"快乐路径"，不要测试边界条件或错误场景
- 如果需要登录态，在测试开头调用 `realLogin()`（从 `support/login-utils.js` 导入）
- **导入光标指示器** `import '../support/cursor-indicator'`，使录屏视频中显示红色光标圆点和点击涟漪动画
- 在操作之间加适度 `cy.wait()` 让画面可阅读，同时用于推算后续标注时间线
- 文件名建议：`{功能名}-record.cy.js`（如 `drg-analysis-record.cy.js`）

**模板**：

```javascript
// 如需登录，先登录
import { realLogin } from '../support/login-utils'
// 导入光标指示器，使视频中显示鼠标位置和点击效果
import '../support/cursor-indicator'

describe('{功能名称}演示', () => {
  beforeEach(() => {
    cy.clearLocalStorage()
  })

  it('正常操作流程', () => {
    // 如需登录，先登录
    // import { realLogin } from '../support/login-utils'
    // realLogin()

    cy.visit('/{页面路径}')
    cy.wait(1000)

    // 步骤 2: ...
    // cy.wait(500)

    // 步骤 3: ...
    // cy.wait(500)

    // 验证最终状态
    cy.get('{关键元素}', { timeout: 10000 }).should('be.visible')
  })
})
```

### 2. 运行录屏

```powershell
cd med_ai_assistant_1.0_bs_vue
npx cypress run --spec cypress/e2e/{文件名}-record.cy.js --browser edge
```

输出：`cypress/videos/{文件名}-record.cy.js.mp4`

### 3. 确定裁剪参数

> **重要**：`cropdetect` 在此场景无效。Cypress GUI 全画面都是内容，必须手动确定裁剪坐标。

**方法**：
1. 从原始视频截一帧：`ffmpeg -i 视频.mp4 -ss 3 -vframes 1 frame.png`
2. 肉眼观察截帧：Cypress 左侧代码面板宽度约占总宽 **36%**，顶部 URL 栏约 **50–55px**
3. 用 `ffmpeg -i 视频.mp4` 查看实际分辨率，代入计算：

```
crop=宽:高:x起点:y起点
crop=iw*0.64:ih-55:iw*0.36:55
```

**固定参考值**（基于 1280×720 viewport 的 Cypress 录制，实测分辨率 ~1250×624）：

| 参数 | 推荐值 | 说明 |
|------|--------|------|
| x 起点 | 450 | 跳过左侧代码面板 |
| y 起点 | 55 | 跳过顶部 URL 栏 |
| 宽度 | 780 | 应用界面区域 |
| 高度 | 560 | 应用界面区域 |

```powershell
$ffmpeg = "node_modules\@ffmpeg-installer\win32-x64\ffmpeg.exe"
& $ffmpeg -i "{原始视频}" -vf "crop=780:560:450:55" -c:a copy -y "{输出视频}"
```

### 4. 确定步骤文字时间线

根据测试代码中的 `cy.wait()` 推算各步骤时间窗口。各步骤之间保持 **1 秒重叠过渡**。

格式：`{序号} {操作描述}`，时间格式 `between(t,起始秒,结束秒)`

### 5. 叠加文字标注

使用 `drawtext` 滤镜链，字体用系统微软雅黑 `C\:/Windows/Fonts/msyh.ttc`：

```powershell
$font   = "C\:/Windows/Fonts/msyh.ttc"
$input  = "{裁剪后视频}"
$output = "{最终视频}"

$filter = @"
drawtext=fontfile='$font':text='① 步骤一描述':fontsize=22:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=8:x=(w-text_w)/2:y=h-th-30:enable='between(t,0.5,2.5)',
drawtext=fontfile='$font':text='② 步骤二描述':fontsize=22:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=8:x=(w-text_w)/2:y=h-th-30:enable='between(t,1.5,4.5)',
...
"@

& $ffmpeg -i $input -vf $filter -c:a copy -y $output
```

### drawtext 参数说明

| 参数 | 值 | 含义 |
|------|-----|------|
| `fontfile` | `C\:/Windows/Fonts/msyh.ttc` | 微软雅黑，支持中文 |
| `fontsize` | 22 | 字号 |
| `fontcolor` | white | 白色文字 |
| `box` | 1 | 开启半透明背景框 |
| `boxcolor` | black@0.55 | 55% 不透明度黑色背景 |
| `boxborderw` | 8 | 背景框内边距 |
| `x` | (w-text_w)/2 | 水平居中 |
| `y` | h-th-30 | 距底部 30px |
| `enable` | between(t,a,b) | 仅在 a~b 秒间显示 |

---

## 完整示例：登录页面

各阶段文件位于 `med_ai_assistant_1.0_bs_vue\cypress\videos\`。

### 测试文件

`cypress/e2e/login-record.cy.js`（已就绪），流程：输入用户名 → blur 触发科室加载 → 输入密码 → 选科室 → 登录 → 同意免责 → 跳转病人列表。

### 裁剪

```powershell
& $ffmpeg -i "cypress\videos\login-record.cy.js.mp4" -vf "crop=780:560:450:55" -c:a copy -y "cypress\videos\login-app-only.mp4"
```

### 步骤时间线

| 步骤 | 文字 | 时间窗口 |
|------|------|----------|
| ① | 打开登录页面 | 0.5s – 2.5s |
| ② | 输入用户名：1657 | 1.5s – 4.5s |
| ③ | 点击密码框，触发科室加载 | 3.5s – 6.5s |
| ④ | 输入密码 | 5.5s – 7.5s |
| ⑤ | 选择科室：心血管一病区 | 7.0s – 9.5s |
| ⑥ | 点击登录按钮 | 9.0s – 10.5s |
| ⑦ | 同意免责声明 → 进入病人列表 | 10.0s – 12.5s |

### 一键脚本

```powershell
.\qoder\skills\record-page-demo\scripts\record-page.ps1
```

产物：
- `login-record.cy.js.mp4` — 原始录屏
- `login-app-only.mp4` — 裁剪后
- `login-annotated.mp4` — 最终版（带步骤文字）

---

## 踩坑记录

1. **cropdetect 失效**：Cypress GUI 全画面有内容，无法自动检测左右分界，必须截帧肉眼观察
2. **headless 模式仍捕获 GUI**：`cypress run --browser edge` 视频包含完整 Test Runner 界面
3. **ffmpeg 字体路径**：Windows 路径用正斜杠 `C\:/Windows/Fonts/msyh.ttc`
4. **PowerShell 引号转义**：drawtext 的 `enable` 参数用 here-string (`@"..."@`) 包裹
5. **时间线对齐**：基于 `cy.wait()` 估算。如需精确，可在测试中插入 `cy.log('STEP_N')` 标记后逐帧校准

## 相关文档

详细方法：`med_ai_assistant_1.0_bs_backend\doc\其他\Cypress登录录屏与视频标注方法.md`
