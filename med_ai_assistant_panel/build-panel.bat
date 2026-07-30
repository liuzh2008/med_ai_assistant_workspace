@echo off
REM 医疗AI助手 - 桌面侧边栏面板 发布脚本
REM 输出：publish\MedAiPanel.exe（win-x64 自包含单文件，无需预装 .NET 运行时）
REM 分发：将 MedAiPanel.exe + config.json 放主系统 /downloads/ 静态目录，医生站内网浏览器下载运行

dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:EnableCompressionInSingleFile=true -o publish
if errorlevel 1 (
    echo 发布失败
    exit /b 1
)

copy /y config.json publish\ >nul
echo 发布完成: publish\MedAiPanel.exe
