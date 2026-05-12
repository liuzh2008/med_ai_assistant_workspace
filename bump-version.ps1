# 医疗AI辅助系统版本号同步更新脚本
# 功能：同步更新 VERSION、maven.config、pom.xml、package.json 中的版本号
# 用法：./bump-version.ps1 [-Version <新版本号>]
# 示例：./bump-version.ps1
#       ./bump-version.ps1 -Version "0.9.100"

param(
    [string]$Version
)

# UTF-8 无 BOM 编码（PowerShell 5.x 默认会加 BOM，需手动指定）
$Utf8NoBom = New-Object System.Text.UTF8Encoding $false

# 基础路径（脚本所在目录）
$RootDir = $PSScriptRoot
if (-not $RootDir) {
    $RootDir = (Get-Location).Path
}

# 文件路径
$VersionFile   = Join-Path $RootDir "VERSION"
$MavenConfig   = Join-Path $RootDir "med_ai_assistant_1.0_bs_backend\.mvn\maven.config"
$PomXml        = Join-Path $RootDir "med_ai_assistant_1.0_bs_backend\pom.xml"
$PackageJson   = Join-Path $RootDir "med_ai_assistant_1.0_bs_vue\package.json"

function Write-ErrorAndExit($Message) {
    Write-Host "错误: $Message" -ForegroundColor Red
    exit 1
}

# 检查必需文件是否存在
$RequiredFiles = @($VersionFile, $MavenConfig, $PomXml, $PackageJson)
foreach ($f in $RequiredFiles) {
    if (-not (Test-Path $f)) {
        Write-ErrorAndExit "文件不存在: $f"
    }
}

# 读取当前版本号
$CurrentVersion = (Get-Content -Path $VersionFile -Raw).Trim()
if (-not $CurrentVersion) {
    Write-ErrorAndExit "VERSION 文件为空"
}
Write-Host "当前版本: $CurrentVersion"

# 计算新版本号
if ($Version) {
    $NewVersion = $Version.Trim()
} else {
    # 自动递增：解析最后一个 . 后面的数字部分，+1，保持三位数补零
    $LastDotIndex = $CurrentVersion.LastIndexOf('.')
    if ($LastDotIndex -lt 0) {
        Write-ErrorAndExit "无法解析版本号格式: $CurrentVersion"
    }
    $Prefix = $CurrentVersion.Substring(0, $LastDotIndex + 1)
    $SuffixStr = $CurrentVersion.Substring($LastDotIndex + 1)
    if (-not ($SuffixStr -match '^\d+$')) {
        Write-ErrorAndExit "版本号后缀不是数字: $SuffixStr"
    }
    $SuffixNum = [int]$SuffixStr
    $NewSuffix = ($SuffixNum + 1).ToString("D3")
    $NewVersion = $Prefix + $NewSuffix
}

Write-Host "新版本:   $NewVersion"

# 1. 更新 VERSION 文件
try {
    [System.IO.File]::WriteAllText($VersionFile, $NewVersion + [Environment]::NewLine, $Utf8NoBom)
    Write-Host "  已更新: VERSION" -ForegroundColor Green
} catch {
    Write-ErrorAndExit "更新 VERSION 文件失败: $_"
}

# 2. 更新 maven.config
try {
    [System.IO.File]::WriteAllText($MavenConfig, "-Drevision=$NewVersion" + [Environment]::NewLine, $Utf8NoBom)
    Write-Host "  已更新: .mvn/maven.config" -ForegroundColor Green
} catch {
    Write-ErrorAndExit "更新 maven.config 失败: $_"
}

# 3. 更新 pom.xml（正则替换 revision 属性值）
try {
    $PomContent = Get-Content -Path $PomXml -Raw -Encoding UTF8

    # 验证 ${revision} 格式
    if ($PomContent -notmatch '<version>\$\{revision\}</version>') {
        Write-Warning "pom.xml 中 <version> 不是 `${revision}` 格式，请检查"
    }

    # 替换 <revision>旧版本</revision>
    $Pattern = '<revision>' + [regex]::Escape($CurrentVersion) + '</revision>'
    $Replacement = '<revision>' + $NewVersion + '</revision>'

    if ($PomContent -notmatch $Pattern) {
        $Pattern = '<revision>[^<]*</revision>'
    }

    $NewPomContent = [regex]::Replace($PomContent, $Pattern, $Replacement)

    if ($NewPomContent -eq $PomContent) {
        Write-ErrorAndExit "pom.xml 中未找到 <revision> 节点或替换失败"
    }

    [System.IO.File]::WriteAllText($PomXml, $NewPomContent, $Utf8NoBom)
    Write-Host "  已更新: pom.xml (<revision>)" -ForegroundColor Green
} catch {
    Write-ErrorAndExit "更新 pom.xml 失败: $_"
}

# 4. 更新 package.json（正则替换，避免 ConvertTo-Json 改变格式）
try {
    $PkgContent = Get-Content -Path $PackageJson -Raw -Encoding UTF8

    # 正则匹配 "version": "旧版本号"
    $Pattern = '"version"\s*:\s*"' + [regex]::Escape($CurrentVersion) + '"'
    $Replacement = '"version": "' + $NewVersion + '"'

    if ($PkgContent -notmatch $Pattern) {
        # 如果按当前版本匹配不到，尝试通用匹配
        $Pattern = '"version"\s*:\s*"[^"]*"'
        $Replacement = '"version": "' + $NewVersion + '"'
    }

    $NewPkgContent = [regex]::Replace($PkgContent, $Pattern, $Replacement)

    if ($NewPkgContent -eq $PkgContent) {
        Write-ErrorAndExit "package.json 中未找到 version 字段或替换失败"
    }

    [System.IO.File]::WriteAllText($PackageJson, $NewPkgContent, $Utf8NoBom)
    Write-Host "  已更新: package.json" -ForegroundColor Green
} catch {
    Write-ErrorAndExit "更新 package.json 失败: $_"
}

# 5. 验证
try {
    # 验证 pom.xml 可被正确解析为 XML
    [xml]$VerifyPom = Get-Content -Path $PomXml -Encoding UTF8
    $VerifyRevision = $VerifyPom.project.properties.revision
    if ($VerifyRevision -ne $NewVersion) {
        Write-ErrorAndExit "验证失败: pom.xml 中 revision 值为 '$VerifyRevision'，期望 '$NewVersion'"
    }

    # 验证 package.json 可被正确解析
    $VerifyPkg = Get-Content -Path $PackageJson -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($VerifyPkg.version -ne $NewVersion) {
        Write-ErrorAndExit "验证失败: package.json 中 version 值为 '$($VerifyPkg.version)'，期望 '$NewVersion'"
    }

    Write-Host "  验证通过: pom.xml、package.json 解析正常" -ForegroundColor Green
} catch {
    Write-ErrorAndExit "验证失败: $_"
}

# 6. 输出摘要
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "版本号更新完成：$CurrentVersion → $NewVersion" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "已更新文件：" -ForegroundColor Cyan
Write-Host "  ✓ VERSION" -ForegroundColor Green
Write-Host "  ✓ .mvn/maven.config" -ForegroundColor Green
Write-Host "  ✓ pom.xml (<revision>)" -ForegroundColor Green
Write-Host "  ✓ package.json" -ForegroundColor Green
Write-Host ""
