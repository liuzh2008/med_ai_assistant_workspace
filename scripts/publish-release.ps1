<#
.SYNOPSIS
    开发机构建并发布到 Gitee Release（跳过 GitHub Actions 的 Gitee 上传环节）。

.DESCRIPTION
    背景：GitHub Actions runner 到 gitee.com 的网络不可靠（DNS 间歇失败、90MB 上传卡住），
    导致 release-backend.yml 的 Publish to Gitee Release 步骤失败。
    本脚本在开发机本地完成同样的产物生成与发布：
      - mvn package（若目标 jar 不存在）
      - jar 分卷（90MB/卷，绕开 Gitee 单附件 100MB 限制）
      - deploy-package（sql/entrypoint/config/Dockerfile.runtime）
      - manifest（sha256）
      - 创建/更新 Gitee Release 并上传（只传分卷/zip/json）

    Gitee token 不落盘：默认通过 ssh 从测试服执行服务器容器读取。

.PARAMETER Version
    版本号，默认读取仓库根 VERSION 文件。

.PARAMETER SkipBuild
    跳过 mvn package（jar 已存在时使用）。

.PARAMETER Token
    显式指定 Gitee token（默认从测试服容器读取）。

.EXAMPLE
    .\publish-release.ps1
    .\publish-release.ps1 -Version 0.9.304
#>
[CmdletBinding()]
param(
    [string]$Version = "",
    [switch]$SkipBuild,
    [string]$Token = "",
    [string]$Owner = "chengdu-qingzhou_0",
    [string]$Repo = "med_ai_assistant_1.0_bs_backend",
    [string]$SshTarget = "testserver",
    [string]$TokenContainer = "med-ai-execution-server"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$Backend = Join-Path $Root "med_ai_assistant_1.0_bs_backend"

if ([string]::IsNullOrEmpty($Version)) {
    $Version = (Get-Content (Join-Path $Root "VERSION") -Raw).Trim()
}
Write-Host "==> 发布版本: $Version"

# ---------- 1. 校验 pom 版本 ----------
$pom = Get-Content (Join-Path $Backend "pom.xml") -Raw
if ($pom -notmatch "<revision>$([regex]::Escape($Version))</revision>") {
    throw "pom.xml 的 <revision> 不是 $Version，请先运行 bump-version.ps1"
}

# ---------- 2. 构建 jar ----------
$jar = Get-ChildItem (Join-Path $Backend "target") -Filter "med_ai_assistant_backend-*.jar" -ErrorAction SilentlyContinue |
       Where-Object { $_.Name -eq "med_ai_assistant_backend-$Version.jar" } |
       Select-Object -First 1

if (-not $jar -or $jar.Length -lt 100MB) {
    if ($SkipBuild) { throw "目标 jar 不存在且指定了 -SkipBuild" }
    Write-Host "==> mvn package（约 1-2 分钟）..."
    Push-Location $Backend
    try { & mvn -q -DskipTests package; if ($LASTEXITCODE -ne 0) { throw "mvn package 失败" } }
    finally { Pop-Location }
    $jar = Get-ChildItem (Join-Path $Backend "target") -Filter "med_ai_assistant_backend-$Version.jar" | Select-Object -First 1
}
if (-not $jar) { throw "未找到构建产物: med_ai_assistant_backend-$Version.jar" }
Write-Host "==> jar: $($jar.FullName) ($([math]::Round($jar.Length/1MB,1)) MB)"

# ---------- 3. 分卷（90MB） ----------
$ReleaseDir = Join-Path (Join-Path $Root "temp") "release-$Version"
if (Test-Path $ReleaseDir) { Remove-Item $ReleaseDir -Recurse -Force }
New-Item -ItemType Directory -Path $ReleaseDir -Force | Out-Null

$Chunk = 90MB
$index = 1
$fs = [IO.File]::OpenRead($jar.FullName)
$buf = New-Object byte[] (1MB)
try {
    while ($true) {
        $partPath = Join-Path $ReleaseDir ("med_ai_assistant_backend-$Version.jar.{0:D3}" -f $index)
        $outStream = [IO.File]::Create($partPath)
        $written = 0L
        try {
            while ($written -lt $Chunk) {
                $n = $fs.Read($buf, 0, $buf.Length)
                if ($n -le 0) { break }
                $outStream.Write($buf, 0, $n)
                $written += $n
            }
        } finally { $outStream.Close() }
        if ($written -eq 0) { Remove-Item $partPath -Force; break }
        Write-Host ("    分卷 {0}: {1:N1} MB" -f $index, ($written / 1MB))
        if ($written -lt $Chunk) { break }
        $index++
    }
} finally { $fs.Close() }

# ---------- 4. deploy-package ----------
$Pkg = Join-Path $ReleaseDir "deploy-package"
New-Item -ItemType Directory -Path $Pkg -Force | Out-Null
$mainDeploy = Join-Path $Backend "deploy\main-linux-oracle"
$execDeploy = Join-Path $Backend "deploy\execution-linux"

# 部署脚本与编排
Get-ChildItem $mainDeploy -Filter *.sh -File | ForEach-Object { Copy-Item $_.FullName $Pkg -Force }
Copy-Item (Join-Path $mainDeploy "docker-compose-main-linux-oracle-image.yml") $Pkg -Force
Copy-Item (Join-Path $mainDeploy ".env.main.example") (Join-Path $Pkg ".env.main.example") -Force
Copy-Item (Join-Path $mainDeploy "docker-entrypoint.sh") (Join-Path $Pkg "docker-entrypoint.sh") -Force
Copy-Item (Join-Path $mainDeploy "Dockerfile.runtime") (Join-Path $Pkg "Dockerfile.main.runtime") -Force
Copy-Item (Join-Path $execDeploy "docker-entrypoint-execution.sh") (Join-Path $Pkg "docker-entrypoint-execution.sh") -Force
Copy-Item (Join-Path $execDeploy "Dockerfile.runtime") (Join-Path $Pkg "Dockerfile.execution.runtime") -Force
Copy-Item (Join-Path $execDeploy "auto-deploy-execution.sh") $Pkg -Force -ErrorAction SilentlyContinue

# config / sql / migration
New-Item -ItemType Directory -Path (Join-Path $Pkg "config") -Force | Out-Null
Copy-Item (Join-Path $mainDeploy "config\application.properties") (Join-Path $Pkg "config") -Force
Copy-Item (Join-Path $Backend "sql") (Join-Path $Pkg "sql") -Recurse -Force
$mig = Join-Path $Backend "src\main\resources\db\migration\oracle"
if (Test-Path $mig) {
    New-Item -ItemType Directory -Path (Join-Path $Pkg "db\migration") -Force | Out-Null
    Copy-Item $mig (Join-Path $Pkg "db\migration") -Recurse -Force
}

$deployZip = Join-Path $ReleaseDir "med_ai_assistant_backend-deploy-$Version.zip"
# 用 .NET ZipFile 手动添加条目：条目名统一正斜杠，Linux unzip 解压不会产生"反斜杠文件名"
Add-Type -AssemblyName System.IO.Compression | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem | Out-Null
if (Test-Path $deployZip) { Remove-Item $deployZip -Force }
$zipStream = [IO.Compression.ZipFile]::Open($deployZip, [IO.Compression.ZipArchiveMode]::Create)
try {
    Get-ChildItem $Pkg -Recurse -File | ForEach-Object {
        $rel = $_.FullName.Substring($Pkg.Length + 1).Replace('\', '/')
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
            $zipStream, $_.FullName, $rel, [IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
} finally { $zipStream.Dispose() }
Write-Host "==> deploy-package: $([math]::Round((Get-Item $deployZip).Length/1KB,1)) KB"

# ---------- 5. manifest ----------
$jarSha = (Get-FileHash $jar.FullName -Algorithm SHA256).Hash.ToLower()
$deploySha = (Get-FileHash $deployZip -Algorithm SHA256).Hash.ToLower()
$parts = @()
Get-ChildItem $ReleaseDir -Filter "*.jar.*" | Sort-Object Name | ForEach-Object {
    $parts += [ordered]@{
        name   = $_.Name
        size   = $_.Length
        sha256 = (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLower()
    }
}
$manifest = [ordered]@{
    version   = $Version
    gitSha    = (git -C $Backend rev-parse HEAD 2>$null)
    createdAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    artifacts = [ordered]@{
        backendJar    = [ordered]@{ name = $jar.Name; size = $jar.Length; sha256 = $jarSha }
        jarParts      = $parts
        deployPackage = [ordered]@{ name = (Split-Path $deployZip -Leaf); size = (Get-Item $deployZip).Length; sha256 = $deploySha }
    }
}
$manifestPath = Join-Path $ReleaseDir "med_ai_assistant_backend-manifest-$Version.json"
$manifest | ConvertTo-Json -Depth 6 | Set-Content -Path $manifestPath -Encoding UTF8
Write-Host "==> manifest: $manifestPath"

# ---------- 6. token ----------
if ([string]::IsNullOrEmpty($Token)) {
    Write-Host "==> 从 ${SshTarget} 容器 ${TokenContainer} 读取 Gitee token..."
    $Token = (& ssh -o BatchMode=yes $SshTarget "docker exec $TokenContainer printenv GITEE_ACCESS_TOKEN" 2>$null | Out-String).Trim()
    if ([string]::IsNullOrEmpty($Token)) { throw "未能从测试服容器读取 GITEE_ACCESS_TOKEN" }
}
Write-Host "==> token 长度: $($Token.Length)"

# ---------- 7. 发布 Gitee Release ----------
$Api = "https://gitee.com/api/v5"
$Tag = "backend-v$Version"
$curl = Join-Path $env:SystemRoot "System32\curl.exe"

Write-Host "==> 删除同名 Release（若存在）..."
$oldJson = & $curl -sS "$Api/repos/$Owner/$Repo/releases/tags/$Tag`?access_token=$Token"
try { $old = $oldJson | ConvertFrom-Json } catch { $old = $null }
if ($old -and $old.id) {
    & $curl -sS -o NUL -X DELETE "$Api/repos/$Owner/$Repo/releases/$($old.id)?access_token=$Token" | Out-Null
    Write-Host "    已删除旧 release id=$($old.id)"
}

Write-Host "==> 创建 Release $Tag ..."
$bodyObj = @{
    access_token     = $Token
    tag_name         = $Tag
    name             = "Backend build v$Version"
    body             = "Automated build from dev machine (jar split into 90MB parts; merge with cat *.jar.0* > <jar>)."
    target_commitish = "main"
    prerelease       = $false
}
$bodyJson = $bodyObj | ConvertTo-Json -Compress
$bodyFile = Join-Path $ReleaseDir "create-release.json"
[IO.File]::WriteAllText($bodyFile, $bodyJson, [Text.UTF8Encoding]::new($false))
$resp = & $curl -sS -X POST "$Api/repos/$Owner/$Repo/releases" -H "Content-Type: application/json;charset=UTF-8" --data-binary "@$bodyFile"
try { $rel = $resp | ConvertFrom-Json } catch { $rel = $null }
if (-not $rel -or -not $rel.id) { throw "创建 Release 失败: $resp" }
$rid = $rel.id
Write-Host "    release_id=$rid"

Write-Host "==> 上传附件..."
$files = @()
$files += Get-ChildItem $ReleaseDir -Filter "*.jar.*"
$files += Get-Item $deployZip
$files += Get-Item $manifestPath

foreach ($f in $files) {
    $code = "000"
    for ($attempt = 1; $attempt -le 4; $attempt++) {
        $code = (& $curl -sS -o (Join-Path $ReleaseDir "upload.json") -w "%{http_code}" `
            -X POST "$Api/repos/$Owner/$Repo/releases/$rid/attach_files" `
            -F "access_token=$Token" -F "file=@$($f.FullName)" `
            --connect-timeout 30 --max-time 900).Trim()
        if ($code -eq "201") { break }
        Write-Host "    上传失败（第 $attempt/4 次，http=$code）: $($f.Name)"
        Start-Sleep -Seconds 5
    }
    if ($code -ne "201") { throw "上传失败: $($f.Name) (http=$code)" }
    Write-Host ("    OK {0} ({1:N1} MB)" -f $f.Name, ($f.Length / 1MB))
}

Write-Host ""
Write-Host "==> 完成：https://gitee.com/$Owner/$Repo/releases/tag/$Tag"
Write-Host "    产物目录: $ReleaseDir"
