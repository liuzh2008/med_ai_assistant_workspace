# Qoder 配置同步设置脚本
# 将 Qoder 记忆和用户配置迁移到 OneDrive，用符号链接同步
# 注意：仅同步用户级数据（记忆、配置），不含项目目录 .qoder/
# 运行前请确保 Qoder 已关闭！
# 必须以管理员身份运行

$ErrorActionPreference = "Stop"
$userName = $env:UserName
$oneDriveSync = "C:\Users\$userName\OneDrive\QoderSync"

Write-Host "╔══════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║    Qoder 配置同步 - OneDrive 设置脚本      ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# 检查管理员权限
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "❌ 请以管理员身份运行此脚本！" -ForegroundColor Red
    Write-Host "   右键 PowerShell → 以管理员身份运行" -ForegroundColor Yellow
    pause
    exit 1
}

# 检查 Qoder 是否在运行
$qoderProcess = Get-Process -Name "Qoder" -ErrorAction SilentlyContinue
if ($qoderProcess) {
    Write-Host "❌ Qoder 正在运行！请先关闭 Qoder 再运行此脚本。" -ForegroundColor Red
    Write-Host "   关闭后按任意键继续..." -ForegroundColor Yellow
    pause
    exit 1
}

# 检查是否已有旧的符号链接（防止重复运行误覆盖）
$alreadySetup = $false
$cacheItem = Get-Item "C:\Users\$userName\.qoder\cache" -ErrorAction SilentlyContinue
if ($cacheItem -and $cacheItem.LinkType -eq "Junction") {
    $alreadySetup = $true
}

if ($alreadySetup) {
    Write-Host "⚠️ 检测到已经设置过符号链接了！" -ForegroundColor Yellow
    Write-Host "   如果只是想重新设置，请先手动删除现有的符号链接。" -ForegroundColor Yellow
    Write-Host "   可运行: Remove-Item 'C:\Users\$userName\.qoder\cache' -Force" -ForegroundColor DarkYellow
    $choice = Read-Host "   是否继续检查并更新？(y/n)"
    if ($choice -ne "y") { exit 0 }
}

# ==========================================================
# 1. 迁移 .qoder 目录中的关键数据（记忆核心）
# ==========================================================
Write-Host "`n📦 第1步：迁移 .qoder 目录数据（记忆核心）..." -ForegroundColor Green

$qoderTarget = "$oneDriveSync\.qoder"
New-Item -ItemType Directory -Path $qoderTarget -Force | Out-Null

# 需要迁移的子目录列表（不含 extensions、logs、bin 等）
$dirsToSync = @("cache", "skills", "agents", "commands")

foreach ($dirName in $dirsToSync) {
    $sourcePath = "C:\Users\$userName\.qoder\$dirName"
    $targetPath = "$qoderTarget\$dirName"

    # 检查是否已是符号链接
    $currentItem = Get-Item $sourcePath -ErrorAction SilentlyContinue
    if ($currentItem -and $currentItem.LinkType -eq "Junction") {
        Write-Host "   ⏭️  $dirName 已是符号链接，跳过" -ForegroundColor DarkYellow
        continue
    }

    if (Test-Path $sourcePath) {
        # 移动目录到 OneDrive
        Write-Host "   📋 正在移动 $dirName 到 OneDrive..." -ForegroundColor Gray
        try {
            Move-Item -Path $sourcePath -Destination $targetPath -Force -ErrorAction Stop
        } catch {
            Write-Host "   ⚠️  直接移动失败（可能文件被锁定），尝试复制后删除..." -ForegroundColor Yellow
            Copy-Item -Path $sourcePath -Destination $targetPath -Recurse -Force
            Remove-Item -Path $sourcePath -Recurse -Force -ErrorAction SilentlyContinue
        }
    } else {
        # 源不存在，创建空目录
        Write-Host "   📋 $dirName 不存在，创建空目录..." -ForegroundColor Gray
        New-Item -ItemType Directory -Path $targetPath -Force | Out-Null
    }

    # 创建 Junction（目录符号链接）
    if (-not (Test-Path $sourcePath)) {
        New-Item -ItemType Junction -Path $sourcePath -Target $targetPath -Force | Out-Null
        Write-Host "   ✅ $dirName → 符号链接创建成功" -ForegroundColor Green
    } else {
        Write-Host "   ❌ $dirName 符号链接创建失败，目标路径已存在" -ForegroundColor Red
    }
}

# 记录 .qoder 中其他不需要同步但应保留在原处的目录
$keepLocal = @("extensions", "logs", "bin")
Write-Host "`n   ℹ️  以下目录保留在本地（不同步）:" -ForegroundColor DarkGray
foreach ($dirName in $keepLocal) {
    $p = "C:\Users\$userName\.qoder\$dirName"
    if (Test-Path $p) {
        Write-Host "      - $dirName" -ForegroundColor DarkGray
    }
}

# ==========================================================
# 2. 迁移 AppData 中的配置文件（使用文件符号链接）
# ==========================================================
Write-Host "`n📦 第2步：迁移 AppData 配置文件..." -ForegroundColor Green

$appDataTarget = "$oneDriveSync\AppData\Roaming\Qoder"
New-Item -ItemType Directory -Path "$appDataTarget\User\globalStorage" -Force | Out-Null
New-Item -ItemType Directory -Path "$appDataTarget\SharedClientCache" -Force | Out-Null

# 需要迁移的文件列表
$filesToSync = @(
    @{ Source = "C:\Users\$userName\AppData\Roaming\Qoder\User\globalStorage\state.vscdb"; Target = "$appDataTarget\User\globalStorage\state.vscdb"; Desc = "全局状态数据库（含记忆）" },
    @{ Source = "C:\Users\$userName\AppData\Roaming\Qoder\User\globalStorage\state.vscdb.backup"; Target = "$appDataTarget\User\globalStorage\state.vscdb.backup"; Desc = "状态数据库备份" },
    @{ Source = "C:\Users\$userName\AppData\Roaming\Qoder\User\globalStorage\storage.json"; Target = "$appDataTarget\User\globalStorage\storage.json"; Desc = "全局存储元数据" },
    @{ Source = "C:\Users\$userName\AppData\Roaming\Qoder\User\settings.json"; Target = "$appDataTarget\User\settings.json"; Desc = "用户设置" },
    @{ Source = "C:\Users\$userName\AppData\Roaming\Qoder\SharedClientCache\mcp.json"; Target = "$appDataTarget\SharedClientCache\mcp.json"; Desc = "MCP 配置" }
)

foreach ($file in $filesToSync) {
    $source = $file.Source
    $target = $file.Target

    # 检查是否已是符号链接
    $currentItem = Get-Item $source -ErrorAction SilentlyContinue
    if ($currentItem -and $currentItem.LinkType -eq "SymbolicLink") {
        Write-Host "   ⏭️  $($file.Desc) 已是符号链接，跳过" -ForegroundColor DarkYellow
        continue
    }

    if (Test-Path $source) {
        # 复制到 OneDrive
        $targetDir = Split-Path $target -Parent
        New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
        Copy-Item -Path $source -Destination $target -Force
        Write-Host "   📋 已复制 $($file.Desc) 到 OneDrive" -ForegroundColor Gray

        # 删除原文件，创建符号链接
        Remove-Item -Path $source -Force
        New-Item -ItemType SymbolicLink -Path $source -Target $target -Force | Out-Null
        Write-Host "   ✅ $($file.Desc) → 符号链接创建成功" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  源文件不存在: $($file.Desc)，跳过" -ForegroundColor Yellow
    }
}

# ==========================================================
# 3. 迁移工作区状态数据库（项目级记忆）
# ==========================================================
Write-Host "`n📦 第3步：迁移工作区状态数据库（项目记忆）..." -ForegroundColor Green

$wsStorage = "C:\Users\$userName\AppData\Roaming\Qoder\User\workspaceStorage"
$wsTarget = "$appDataTarget\User\workspaceStorage"
New-Item -ItemType Directory -Path $wsTarget -Force | Out-Null

$wsFound = $false
foreach ($ws in Get-ChildItem -Path $wsStorage -Directory) {
    $wsJson = Join-Path $ws.FullName "workspace.json"
    if (Test-Path $wsJson) {
        $content = Get-Content $wsJson -Raw
        if ($content -match "MedAiAssistant") {
            $wsFound = $true
            $wsId = $ws.Name
            $stateDb = Join-Path $ws.FullName "state.vscdb"
            $stateDbBackup = Join-Path $ws.FullName "state.vscdb.backup"
            $wsTargetDir = "$wsTarget\$wsId"

            # 检查是否已是符号链接
            $currentDb = Get-Item $stateDb -ErrorAction SilentlyContinue
            if ($currentDb -and $currentDb.LinkType -eq "SymbolicLink") {
                Write-Host "   ⏭️  工作区 $wsId 已是符号链接，跳过" -ForegroundColor DarkYellow
                continue
            }

            New-Item -ItemType Directory -Path $wsTargetDir -Force | Out-Null

            if (Test-Path $stateDb) {
                Copy-Item -Path $stateDb -Destination "$wsTargetDir\state.vscdb" -Force
                Remove-Item -Path $stateDb -Force
                New-Item -ItemType SymbolicLink -Path $stateDb -Target "$wsTargetDir\state.vscdb" -Force | Out-Null
                Write-Host "   ✅ 工作区 $wsId state.vscdb 符号链接创建成功" -ForegroundColor Green
            }
            if (Test-Path $stateDbBackup) {
                Copy-Item -Path $stateDbBackup -Destination "$wsTargetDir\state.vscdb.backup" -Force
                Remove-Item -Path $stateDbBackup -Force
                New-Item -ItemType SymbolicLink -Path $stateDbBackup -Target "$wsTargetDir\state.vscdb.backup" -Force | Out-Null
            }

            # 复制 workspace.json（只读配置，不需要符号链接）
            Copy-Item -Path $wsJson -Destination "$wsTargetDir\workspace.json" -Force
        }
    }
}
if (-not $wsFound) {
    Write-Host "   ℹ️  未找到 MedAiAssistant 相关的工作区状态数据库" -ForegroundColor DarkGray
}

# ==========================================================
# 4. 验证结果
# ==========================================================
Write-Host "`n🔍 第4步：验证同步状态..." -ForegroundColor Green

function Test-Symlink {
    param($Path)
    $item = Get-Item $Path -ErrorAction SilentlyContinue
    return ($item -and $item.LinkType)
}

$allOk = $true
Write-Host "`n   目录链接状态:" -ForegroundColor White
foreach ($dirName in $dirsToSync) {
    $p = "C:\Users\$userName\.qoder\$dirName"
    if (Test-Symlink $p) {
        Write-Host "   ✅ .qoder\$dirName" -ForegroundColor Green
    } else {
        Write-Host "   ❌ .qoder\$dirName" -ForegroundColor Red
        $allOk = $false
    }
}

Write-Host "`n   文件链接状态:" -ForegroundColor White
foreach ($file in $filesToSync) {
    if (Test-Symlink $file.Source) {
        Write-Host "   ✅ $($file.Desc)" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  $($file.Desc) 未链接（可能源文件不存在）" -ForegroundColor Yellow
    }
}

# ==========================================================
# 完成
# ==========================================================
Write-Host ""
if ($allOk) {
    Write-Host "✅ 全部设置完成！" -ForegroundColor Green
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host "  OneDrive 同步目录: $oneDriveSync" -ForegroundColor White
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "📌 同步覆盖范围（不含项目目录 .qoder/）:" -ForegroundColor Yellow
    Write-Host "   ✅ .qoder\cache\      — 记忆核心数据" -ForegroundColor Green
    Write-Host "   ✅ .qoder\skills\     — 自定义 Skill" -ForegroundColor Green
    Write-Host "   ✅ .qoder\agents\     — 自定义 Agent" -ForegroundColor Green
    Write-Host "   ✅ .qoder\commands\   — 自定义命令" -ForegroundColor Green
    Write-Host "   ✅ AppData 配置文件  — 用户设置、全局状态" -ForegroundColor Green
    Write-Host "   ❌ 项目 .qoder\       — 不同步（随 Git 管理）" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "⚠️  注意事项:" -ForegroundColor Yellow
    Write-Host "   1. 启动 Qoder 前确保 OneDrive 已同步完成" -ForegroundColor DarkYellow
    Write-Host "   2. 如果有文件冲突，OneDrive 会创建副本，不会丢失数据" -ForegroundColor DarkYellow
    Write-Host "   3. 在另一台电脑上需要运行相同的设置脚本，创建符号链接指向 OneDrive 同一位置" -ForegroundColor DarkYellow
} else {
    Write-Host "⚠️  部分设置未完成，请检查上述错误信息。" -ForegroundColor Yellow
}

pause
