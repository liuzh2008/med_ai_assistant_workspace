# record-login.ps1 — 一键录制医疗AI助手登录流程演示视频
# 三阶段：Cypress 录屏 → ffmpeg 裁剪 → ffmpeg 标注
param(
    [string]$Browser = "edge"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$VueRoot   = Resolve-Path "$ScriptDir\..\..\..\..\..\med_ai_assistant_1.0_bs_vue"
$ffmpeg    = "$VueRoot\node_modules\@ffmpeg-installer\win32-x64\ffmpeg.exe"
$font      = "C\:/Windows/Fonts/msyh.ttc"
$videoDir  = "$VueRoot\cypress\videos"

# 检查 ffmpeg
if (-not (Test-Path $ffmpeg)) {
    Write-Host "ffmpeg 未安装，正在通过 npm 安装..." -ForegroundColor Yellow
    Push-Location $VueRoot
    npm install --save-dev @ffmpeg-installer/ffmpeg
    Pop-Location
    if (-not (Test-Path $ffmpeg)) {
        Write-Error "ffmpeg 安装失败，请手动执行: npm install --save-dev @ffmpeg-installer/ffmpeg"
        exit 1
    }
}

# 阶段 1：Cypress 录屏
Write-Host "`n=== 1/3 运行 Cypress 录屏 ===" -ForegroundColor Cyan
Push-Location $VueRoot
npx cypress run --spec cypress/e2e/login-record.cy.js --browser $Browser
if ($LASTEXITCODE -ne 0) {
    Write-Error "Cypress 录制失败"
    Pop-Location; exit 1
}
Pop-Location

# 找到最新录制的视频
$rawVideo = Get-ChildItem "$videoDir\login-record.cy.js.mp4" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $rawVideo) {
    Write-Error "未找到录制的视频文件"
    exit 1
}
Write-Host "原始视频：$($rawVideo.FullName)" -ForegroundColor Gray

# 阶段 2：ffmpeg 裁剪（去掉左侧代码面板 + 顶部 URL 栏）
Write-Host "`n=== 2/3 ffmpeg 裁剪 ===" -ForegroundColor Cyan
$croppedVideo = "$videoDir\login-app-only.mp4"
& $ffmpeg -i $rawVideo.FullName -vf "crop=780:560:450:55" -c:a copy -y $croppedVideo 2>&1 | Select-String "frame=" | Select-Object -Last 1
Write-Host "裁剪完成：$croppedVideo" -ForegroundColor Gray

# 阶段 3：ffmpeg 叠加步骤文字
Write-Host "`n=== 3/3 ffmpeg 叠加步骤文字 ===" -ForegroundColor Cyan
$finalVideo = "$videoDir\login-annotated.mp4"

$drawtextFilter = @"
drawtext=fontfile='$font':text='① 打开登录页面':fontsize=22:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=8:x=(w-text_w)/2:y=h-th-30:enable='between(t,0.5,2.5)',
drawtext=fontfile='$font':text='② 输入用户名：1657':fontsize=22:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=8:x=(w-text_w)/2:y=h-th-30:enable='between(t,1.5,4.5)',
drawtext=fontfile='$font':text='③ 点击密码框，触发科室加载':fontsize=22:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=8:x=(w-text_w)/2:y=h-th-30:enable='between(t,3.5,6.5)',
drawtext=fontfile='$font':text='④ 输入密码':fontsize=22:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=8:x=(w-text_w)/2:y=h-th-30:enable='between(t,5.5,7.5)',
drawtext=fontfile='$font':text='⑤ 选择科室：心血管一病区':fontsize=22:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=8:x=(w-text_w)/2:y=h-th-30:enable='between(t,7,9.5)',
drawtext=fontfile='$font':text='⑥ 点击登录按钮':fontsize=22:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=8:x=(w-text_w)/2:y=h-th-30:enable='between(t,9,10.5)',
drawtext=fontfile='$font':text='⑦ 同意免责声明 → 进入病人列表':fontsize=22:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=8:x=(w-text_w)/2:y=h-th-30:enable='between(t,10,12.5)'
"@

& $ffmpeg -i $croppedVideo -vf $drawtextFilter -c:a copy -y $finalVideo 2>&1 | Select-String "frame=" | Select-Object -Last 1

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  完成！最终视频：$finalVideo" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
