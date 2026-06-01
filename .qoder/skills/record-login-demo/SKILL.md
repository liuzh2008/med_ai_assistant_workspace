---
name: record-login-demo
description: 录制医疗AI助手系统正常登录流程演示视频。三阶段：Cypress E2E 录屏 → ffmpeg crop 裁剪去除 GUI 面板 → ffmpeg drawtext 叠加步骤文字标注。当用户需要录制登录演示视频、生成登录操作录屏、制作登录流程演示时使用。
---

# 录屏登录演示

## 概述

录制医疗 AI 助手系统的完整登录流程演示视频，最终输出带步骤文字标注的纯净应用界面视频。

**三阶段流程**：Cypress 录制 → ffmpeg 裁剪 → ffmpeg 标注

| 阶段 | 工具 | 输入 | 输出 |
|------|------|------|------|
| 录制 | Cypress `cypress run` | `login-record.cy.js` | 原始视频（含 GUI 面板） |
| 裁剪 | ffmpeg `crop` | 原始视频 | 纯净应用界面视频 |
| 标注 | ffmpeg `drawtext` | 裁剪后视频 | 带步骤文字说明的最终视频 |

## 前置条件

- 前端 dev server 运行中（`localhost:8080`）
- 后端 API 服务运行中（`localhost:8081`）
- ffmpeg 已安装（通过 `npm install --save-dev @ffmpeg-installer/ffmpeg`）
- Cypress 已配置（`cypress.config.js` 中 `video: true`）

## 一键录屏（推荐）

执行自动化脚本完成全部三个阶段：

```powershell
cd med_ai_assistant_1.0_bs_vue
.\qoder\skills\record-login-demo\scripts\record-login.ps1
```

脚本自动执行：Cypress 无头录屏 → ffmpeg 裁剪 → ffmpeg 叠加文字 → 输出最终视频。

产物位于 `med_ai_assistant_1.0_bs_vue\cypress\videos\`：
- `login-record.cy.js.mp4` — 原始录屏
- `login-app-only.mp4` — 裁剪后（仅应用界面）
- `login-annotated.mp4` — **最终版**（带步骤文字）

---

## 手动分步执行

### 阶段一：Cypress 录制

测试文件 `cypress/e2e/login-record.cy.js` 已就绪，包含完整登录流程（输入用户名 → 触发科室加载 → 输入密码 → 选择科室 → 登录 → 同意免责声明 → 跳转病人列表）。

```powershell
cd med_ai_assistant_1.0_bs_vue
npx cypress run --spec cypress/e2e/login-record.cy.js --browser edge
```

输出：`cypress/videos/login-record.cy.js.mp4`（~10 秒，1250×624）

### 阶段二：ffmpeg 裁剪

> **注意**：`cropdetect` 在此场景无效。Cypress GUI 全画面都是内容（代码面板+应用），无纯色黑边，`cropdetect` 返回全帧 `crop=1250:624:0:0`。必须手动确定裁剪坐标。

**裁剪参数**（基于截帧肉眼观察确定）：

| 参数 | 值 | 说明 |
|------|-----|------|
| x 起点 | 450 | 跳过左侧代码面板（约 36% 宽度） |
| y 起点 | 55 | 跳过顶部 URL 地址栏 |
| 宽度 | 780 | 保留应用界面区域 |
| 高度 | 560 | 保留应用界面区域 |

```powershell
$ffmpeg = "node_modules\@ffmpeg-installer\win32-x64\ffmpeg.exe"
& $ffmpeg -i "cypress\videos\login-record.cy.js.mp4" -vf "crop=780:560:450:55" -c:a copy -y "cypress\videos\login-app-only.mp4"
```

### 阶段三：ffmpeg 叠加文字

使用 `drawtext` 滤镜在视频底部半透明黑底上显示白色步骤文字。字体使用系统微软雅黑 `C\:/Windows/Fonts/msyh.ttc`。

**步骤时间线**：

| 步骤 | 文字 | 时间窗口 |
|------|------|----------|
| ① | 打开登录页面 | 0.5s – 2.5s |
| ② | 输入用户名：1657 | 1.5s – 4.5s |
| ③ | 点击密码框，触发科室加载 | 3.5s – 6.5s |
| ④ | 输入密码 | 5.5s – 7.5s |
| ⑤ | 选择科室：心血管一病区 | 7.0s – 9.5s |
| ⑥ | 点击登录按钮 | 9.0s – 10.5s |
| ⑦ | 同意免责声明 → 进入病人列表 | 10.0s – 12.5s |

各步骤有 1 秒重叠过渡，切换自然不突兀。

```powershell
$font   = "C\:/Windows/Fonts/msyh.ttc"
$input  = "cypress\videos\login-app-only.mp4"
$output = "cypress\videos\login-annotated.mp4"

$filter = @"
drawtext=fontfile='$font':text='① 打开登录页面':fontsize=22:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=8:x=(w-text_w)/2:y=h-th-30:enable='between(t,0.5,2.5)',
drawtext=fontfile='$font':text='② 输入用户名：1657':fontsize=22:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=8:x=(w-text_w)/2:y=h-th-30:enable='between(t,1.5,4.5)',
drawtext=fontfile='$font':text='③ 点击密码框，触发科室加载':fontsize=22:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=8:x=(w-text_w)/2:y=h-th-30:enable='between(t,3.5,6.5)',
drawtext=fontfile='$font':text='④ 输入密码':fontsize=22:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=8:x=(w-text_w)/2:y=h-th-30:enable='between(t,5.5,7.5)',
drawtext=fontfile='$font':text='⑤ 选择科室：心血管一病区':fontsize=22:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=8:x=(w-text_w)/2:y=h-th-30:enable='between(t,7,9.5)',
drawtext=fontfile='$font':text='⑥ 点击登录按钮':fontsize=22:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=8:x=(w-text_w)/2:y=h-th-30:enable='between(t,9,10.5)',
drawtext=fontfile='$font':text='⑦ 同意免责声明 → 进入病人列表':fontsize=22:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=8:x=(w-text_w)/2:y=h-th-30:enable='between(t,10,12.5)'
"@

& $ffmpeg -i $input -vf $filter -c:a copy -y $output
```

### drawtext 参数说明

| 参数 | 值 | 含义 |
|------|-----|------|
| `fontfile` | 字体路径 | 微软雅黑，支持中文 |
| `fontsize` | 22 | 字号 |
| `fontcolor` | white | 白色文字 |
| `box` | 1 | 开启半透明背景框 |
| `boxcolor` | black@0.55 | 55% 不透明度黑色背景 |
| `boxborderw` | 8 | 背景框内边距 |
| `x` | (w-text_w)/2 | 水平居中 |
| `y` | h-th-30 | 距底部 30px |
| `enable` | between(t,a,b) | 仅在 a~b 秒间显示 |

---

## 踩坑记录

1. **cropdetect 失效**：Cypress GUI 全画面有内容，无法自动检测左右分界
2. **headless 模式仍捕获 GUI**：`cypress run --browser edge` 视频包含完整 Test Runner 界面
3. **ffmpeg 字体路径**：Windows 路径用正斜杠 `C\:/Windows/Fonts/msyh.ttc`
4. **PowerShell 引号转义**：drawtext 的 `enable` 参数用 here-string (`@"..."@`) 包裹

## 相关文档

详细方法和完整命令参考：`med_ai_assistant_1.0_bs_backend\doc\其他\Cypress登录录屏与视频标注方法.md`
