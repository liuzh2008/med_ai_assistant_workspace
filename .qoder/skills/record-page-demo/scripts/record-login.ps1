# record-page.ps1 — 一键录制医疗AI助手页面操作演示视频
# 三阶段：Cypress 录屏 → ffmpeg 裁剪 → ffmpeg 标注
# 用法：.\record-page.ps1 -Spec "login-record.cy.js" [-Browser edge] [-CropX 450] [-CropY 55] [-CropW 780] [-CropH 560]
param(
    [Parameter(Mandatory=$true)]
    [string]$Spec,          # Cypress 测试文件（仅文件名，如 "login-record.cy.js"）
    [string]$Browser = "edge",
    # 裁剪参数（基于 1280x720 的默认值，去掉左侧 36% 代码面板 + 顶部 55px URL 栏）
    [int]$CropX = 450,
    [int]$CropY = 55,
    [int]$CropW = 780,
    [int]$CropH = 560
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$VueRoot   = Resolve-Path "$ScriptDir\..\..\..\..\..\med_ai_assistant_1.0_bs_vue"
$ffmpeg    = "$VueRoot\node_modules\@ffmpeg-installer\win32-x64\ffmpeg.exe"
$font      = "C\:/Windows/Fonts/msyh.ttc"
$videoDir  = "$VueRoot\cypress\videos"

# 推导输出文件名
$baseName  = [System.IO.Path]::GetFileNameWithoutExtension($Spec) -replace '-record$', ''
$rawVideo  = "$videoDir\$Spec.mp4"
$croppedVideo = "$videoDir\$baseName-app-only.mp4"

# 检查 ffmpeg
if (-not (Test-Path $ffmpeg)) {
    Write-Host "ffmpeg 未安装，正在通过 npm 安装..." -ForegroundColor Yellow
    Push-Location $VueRoot
    npm install --save-dev @ffmpeg-installer/ffmpeg
    Pop-Location
    if (-not (Test-Path $ffmpeg)) {
        Write-Error "ffmpeg 安装失败"
        exit 1
    }
}

# 阶段 1：Cypress 录屏
Write-Host "`n=== 1/2 运行 Cypress 录屏：$Spec ===" -ForegroundColor Cyan
Push-Location $VueRoot
npx cypress run --spec "cypress/e2e/$Spec" --browser $Browser
if ($LASTEXITCODE -ne 0) {
    Write-Error "Cypress 录制失败"
    Pop-Location; exit 1
}
Pop-Location

if (-not (Test-Path $rawVideo)) {
    Write-Error "未找到录制的视频文件：$rawVideo"
    exit 1
}
Write-Host "原始视频：$rawVideo" -ForegroundColor Gray

# 阶段 2：ffmpeg 裁剪（去掉左侧代码面板 + 顶部 URL 栏）
Write-Host "`n=== 2/2 ffmpeg 裁剪 crop=${CropW}:${CropH}:${CropX}:${CropY} ===" -ForegroundColor Cyan
& $ffmpeg -i $rawVideo -vf "crop=${CropW}:${CropH}:${CropX}:${CropY}" -c:a copy -y $croppedVideo 2>&1 | Select-String "frame=" | Select-Object -Last 1

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  裁剪完成：$croppedVideo" -ForegroundColor Green
Write-Host "  下一步：手动叠加 drawtext 步骤文字" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Green
