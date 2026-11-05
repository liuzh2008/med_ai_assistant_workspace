<#
.SYNOPSIS
    开发机构建并发布到 Gitee Release（后端 jar + 前端包，一条命令）。

.DESCRIPTION
    背景：GitHub Actions runner 到 gitee.com 网络不可靠（DNS 间歇失败、90MB 上传卡住），
    因此提供开发机本地发布通道。产物格式与 CI 完全一致，执行服务器的
    gitee-pull-release.sh / auto-deploy-frontend.sh 无需改动。

    后端：mvn package → jar 分卷 90MB → deploy-package → manifest
    前端：npm build → 部署包（dist + nginx + compose + 脚本）→ zip → manifest

    Gitee token 不落盘：默认通过 ssh 从测试服执行服务器容器读取。

.PARAMETER Component
    backend / frontend / all（默认 all）。

.PARAMETER Version
    版本号，默认读取仓库根 VERSION 文件。

.PARAMETER SkipBuild
    跳过 mvn package / npm run build。

.PARAMETER ForceBuild
    强制重新构建（即使产物已存在）。

.EXAMPLE
    .\publish-release.ps1                    # 前后端都发
    .\publish-release.ps1 -Component backend
    .\publish-release.ps1 -Component frontend -ForceBuild
#>
[CmdletBinding()]
param(
    [ValidateSet("backend", "frontend", "all")]
    [string]$Component = "all",
    [string]$Version = "",
    [switch]$SkipBuild,
    [switch]$ForceBuild,
    [string]$Token = "",
    [string]$Owner = "chengdu-qingzhou_0",
    [string]$SshTarget = "testserver",
    [string]$TokenContainer = "med-ai-execution-server"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$BackendDir = Join-Path $Root "med_ai_assistant_1.0_bs_backend"
$VueDir = Join-Path $Root "med_ai_assistant_1.0_bs_vue"
$TempRoot = Join-Path $Root "temp"
$Curl = Join-Path $env:SystemRoot "System32\curl.exe"
$Api = "https://gitee.com/api/v5"

if ([string]::IsNullOrEmpty($Version)) {
    $Version = (Get-Content (Join-Path $Root "VERSION") -Raw).Trim()
}
Write-Host "==> 发布版本: $Version（组件: $Component）"

# ============================================================
# 通用：取 token
# ============================================================
function Get-GiteeToken {
    if (-not [string]::IsNullOrEmpty($Token)) { return $Token }
    Write-Host "==> 从 ${SshTarget} 容器 ${TokenContainer} 读取 Gitee token..."
    $t = (& ssh -o BatchMode=yes $SshTarget "docker exec $TokenContainer printenv GITEE_ACCESS_TOKEN" 2>$null | Out-String).Trim()
    if ([string]::IsNullOrEmpty($t)) { throw "未能读取 GITEE_ACCESS_TOKEN" }
    Write-Host "==> token 长度: $($t.Length)"
    return $t
}

# ============================================================
# 通用：zip（.NET ZipFile，条目正斜杠）
# ============================================================
function New-ZipFromDirectory {
    param([string]$SourceDir, [string]$ZipPath)
    Add-Type -AssemblyName System.IO.Compression | Out-Null
    Add-Type -AssemblyName System.IO.Compression.FileSystem | Out-Null
    if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }
    $zip = [IO.Compression.ZipFile]::Open($ZipPath, [IO.Compression.ZipArchiveMode]::Create)
    try {
        Get-ChildItem $SourceDir -Recurse -File | ForEach-Object {
            $rel = $_.FullName.Substring($SourceDir.Length + 1).Replace('\', '/')
            [IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
                $zip, $_.FullName, $rel, [IO.Compression.CompressionLevel]::Optimal) | Out-Null
        }
    } finally { $zip.Dispose() }
}

# ============================================================
# 通用：发布到 Gitee Release
# ============================================================
function Publish-GiteeRelease {
    param(
        [string]$Repo,
        [string]$Tag,
        [string]$DisplayName,
        [string[]]$AssetPaths,
        [string]$TargetBranch
    )
    Write-Host "==> [$Repo] 删除同名 Release（若存在）..."
    $oldJson = & $Curl -sS "$Api/repos/$Owner/$Repo/releases/tags/$Tag`?access_token=$Token"
    try { $old = $oldJson | ConvertFrom-Json } catch { $old = $null }
    if ($old -and $old.id) {
        & $Curl -sS -o NUL -X DELETE "$Api/repos/$Owner/$Repo/releases/$($old.id)?access_token=$Token" | Out-Null
        Write-Host "    已删除旧 release id=$($old.id)"
    }

    Write-Host "==> [$Repo] 创建 Release $Tag ..."
    $body = @{
        access_token     = $Token
        tag_name         = $Tag
        name             = $DisplayName
        body             = "Automated build from dev machine v$Version"
        target_commitish = $TargetBranch
        prerelease       = $false
    } | ConvertTo-Json -Compress
    $bodyFile = Join-Path $TempRoot "create-release-$Repo.json"
    [IO.File]::WriteAllText($bodyFile, $body, [Text.UTF8Encoding]::new($false))
    $resp = & $Curl -sS -X POST "$Api/repos/$Owner/$Repo/releases" -H "Content-Type: application/json;charset=UTF-8" --data-binary "@$bodyFile"
    try { $rel = $resp | ConvertFrom-Json } catch { $rel = $null }
    if (-not $rel -or -not $rel.id) { throw "创建 Release 失败: $resp" }
    $rid = $rel.id
    Write-Host "    release_id=$rid"

    foreach ($path in $AssetPaths) {
        if (-not (Test-Path $path)) { throw "附件不存在: $path" }
        $f = Get-Item $path
        $code = "000"
        for ($attempt = 1; $attempt -le 4; $attempt++) {
            $code = (& $Curl -sS -o (Join-Path $TempRoot "upload-$Repo.json") -w "%{http_code}" `
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
    Write-Host "==> [$Repo] 完成：https://gitee.com/$Owner/$Repo/releases/tag/$Tag"
}

# ============================================================
# 后端发布
# ============================================================
function Publish-Backend {
    Write-Host ""
    Write-Host "################ 后端 ################"

    $pom = Get-Content (Join-Path $BackendDir "pom.xml") -Raw
    if ($pom -notmatch "<revision>$([regex]::Escape($Version))</revision>") {
        throw "backend pom.xml 的 <revision> 不是 $Version，请先运行 bump-version.ps1"
    }

    $jar = Get-ChildItem (Join-Path $BackendDir "target") -Filter "med_ai_assistant_backend-$Version.jar" -ErrorAction SilentlyContinue |
           Select-Object -First 1
    if (-not $jar -or $jar.Length -lt 100MB -or $ForceBuild) {
        if ($SkipBuild) { throw "目标 jar 不存在（或 -ForceBuild）且指定了 -SkipBuild" }
        Write-Host "==> mvn package（约 1-2 分钟）..."
        Push-Location $BackendDir
        try { & mvn -q -DskipTests package; if ($LASTEXITCODE -ne 0) { throw "mvn package 失败" } }
        finally { Pop-Location }
        $jar = Get-ChildItem (Join-Path $BackendDir "target") -Filter "med_ai_assistant_backend-$Version.jar" | Select-Object -First 1
    }
    if (-not $jar) { throw "未找到构建产物" }
    Write-Host "==> jar: $($jar.FullName) ($([math]::Round($jar.Length/1MB,1)) MB)"

    $RelDir = Join-Path $TempRoot "release-backend-$Version"
    if (Test-Path $RelDir) { Remove-Item $RelDir -Recurse -Force }
    New-Item -ItemType Directory -Path $RelDir -Force | Out-Null

    # 分卷 90MB
    $chunk = 90MB
    $index = 1
    $fs = [IO.File]::OpenRead($jar.FullName)
    $buf = New-Object byte[] (1MB)
    try {
        while ($true) {
            $partPath = Join-Path $RelDir ("med_ai_assistant_backend-$Version.jar.{0:D3}" -f $index)
            $outStream = [IO.File]::Create($partPath)
            $written = 0L
            try {
                while ($written -lt $chunk) {
                    $n = $fs.Read($buf, 0, $buf.Length)
                    if ($n -le 0) { break }
                    $outStream.Write($buf, 0, $n)
                    $written += $n
                }
            } finally { $outStream.Close() }
            if ($written -eq 0) { Remove-Item $partPath -Force; break }
            Write-Host ("    分卷 {0}: {1:N1} MB" -f $index, ($written / 1MB))
            if ($written -lt $chunk) { break }
            $index++
        }
    } finally { $fs.Close() }

    # deploy-package
    $Pkg = Join-Path $RelDir "deploy-package"
    New-Item -ItemType Directory -Path $Pkg -Force | Out-Null
    $mainDeploy = Join-Path $BackendDir "deploy\main-linux-oracle"
    $execDeploy = Join-Path $BackendDir "deploy\execution-linux"
    Get-ChildItem $mainDeploy -Filter *.sh -File | ForEach-Object { Copy-Item $_.FullName $Pkg -Force }
    Copy-Item (Join-Path $mainDeploy "docker-compose-main-linux-oracle-image.yml") $Pkg -Force
    Copy-Item (Join-Path $mainDeploy ".env.main.example") (Join-Path $Pkg ".env.main.example") -Force
    Copy-Item (Join-Path $mainDeploy "docker-entrypoint.sh") (Join-Path $Pkg "docker-entrypoint.sh") -Force
    Copy-Item (Join-Path $mainDeploy "Dockerfile.runtime") (Join-Path $Pkg "Dockerfile.main.runtime") -Force
    Copy-Item (Join-Path $execDeploy "docker-entrypoint-execution.sh") (Join-Path $Pkg "docker-entrypoint-execution.sh") -Force
    Copy-Item (Join-Path $execDeploy "Dockerfile.runtime") (Join-Path $Pkg "Dockerfile.execution.runtime") -Force
    Copy-Item (Join-Path $execDeploy "auto-deploy-execution.sh") $Pkg -Force -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Path (Join-Path $Pkg "config") -Force | Out-Null
    Copy-Item (Join-Path $mainDeploy "config\application.properties") (Join-Path $Pkg "config") -Force
    Copy-Item (Join-Path $BackendDir "sql") (Join-Path $Pkg "sql") -Recurse -Force
    $mig = Join-Path $BackendDir "src\main\resources\db\migration\oracle"
    if (Test-Path $mig) {
        New-Item -ItemType Directory -Path (Join-Path $Pkg "db\migration") -Force | Out-Null
        Copy-Item $mig (Join-Path $Pkg "db\migration") -Recurse -Force
    }
    $deployZip = Join-Path $RelDir "med_ai_assistant_backend-deploy-$Version.zip"
    New-ZipFromDirectory -SourceDir $Pkg -ZipPath $deployZip
    Write-Host "==> deploy-package: $([math]::Round((Get-Item $deployZip).Length/1KB,1)) KB"

    # manifest
    $parts = @()
    Get-ChildItem $RelDir -Filter "*.jar.*" | Sort-Object Name | ForEach-Object {
        $parts += [ordered]@{ name = $_.Name; size = $_.Length; sha256 = (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLower() }
    }
    $manifest = [ordered]@{
        version   = $Version
        gitSha    = (git -C $BackendDir rev-parse HEAD 2>$null)
        createdAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
        artifacts = [ordered]@{
            backendJar    = [ordered]@{ name = $jar.Name; size = $jar.Length; sha256 = (Get-FileHash $jar.FullName -Algorithm SHA256).Hash.ToLower() }
            jarParts      = $parts
            deployPackage = [ordered]@{ name = (Split-Path $deployZip -Leaf); size = (Get-Item $deployZip).Length; sha256 = (Get-FileHash $deployZip -Algorithm SHA256).Hash.ToLower() }
        }
    }
    $manifestPath = Join-Path $RelDir "med_ai_assistant_backend-manifest-$Version.json"
    $manifest | ConvertTo-Json -Depth 6 | Set-Content -Path $manifestPath -Encoding UTF8
    Write-Host "==> manifest: $manifestPath"

    $assets = @()
    $assets += (Get-ChildItem $RelDir -Filter "*.jar.*" | Sort-Object Name | ForEach-Object { $_.FullName })
    $assets += $deployZip
    $assets += $manifestPath
    Publish-GiteeRelease -Repo "med_ai_assistant_1.0_bs_backend" -Tag "backend-v$Version" `
        -DisplayName "Backend build v$Version" -AssetPaths $assets -TargetBranch "main"
    return $RelDir
}

# ============================================================
# 前端发布
# ============================================================
function Publish-Frontend {
    Write-Host ""
    Write-Host "################ 前端 ################"

    $pkgJson = Get-Content (Join-Path $VueDir "package.json") -Raw | ConvertFrom-Json
    if ($pkgJson.version -ne $Version) {
        throw "vue package.json 的 version 是 $($pkgJson.version)，不是 $Version，请先运行 bump-version.ps1"
    }

    $dist = Join-Path $VueDir "dist"
    if ($ForceBuild -or -not (Test-Path (Join-Path $dist "index.html"))) {
        if ($SkipBuild) { throw "dist 不存在（或 -ForceBuild）且指定了 -SkipBuild" }
        Write-Host "==> npm run build（约 1 分钟）..."
        $oldNodeOpts = $env:NODE_OPTIONS
        $env:NODE_OPTIONS = "--openssl-legacy-provider"
        Push-Location $VueDir
        try {
            & npm run build 2>&1 | Select-Object -Last 5
            if ($LASTEXITCODE -ne 0) { throw "npm run build 失败" }
        } finally {
            Pop-Location
            $env:NODE_OPTIONS = $oldNodeOpts
        }
    } else {
        Write-Host "==> 复用已有 dist（-ForceBuild 可强制重建）"
    }
    if (-not (Test-Path (Join-Path $dist "index.html"))) { throw "dist/index.html 不存在" }
    $appJs = Get-ChildItem (Join-Path $dist "js") -Filter "app.*.js" -ErrorAction SilentlyContinue | Select-Object -First 1
    Write-Host "==> dist 校验: index.html + $($appJs.Name)"

    $RelDir = Join-Path $TempRoot "release-frontend-$Version"
    $Pkg = Join-Path $RelDir "package"
    if (Test-Path $RelDir) { Remove-Item $RelDir -Recurse -Force }
    New-Item -ItemType Directory -Path $Pkg -Force | Out-Null

    Copy-Item $dist (Join-Path $Pkg "dist") -Recurse -Force
    foreach ($f in @("nginx.conf", "nginx.main.conf", "nginx-proxy.conf", "docker-compose.yml",
                     "Dockerfile", ".env.production", "package.json", "package-lock.json")) {
        $src = Join-Path $VueDir $f
        if (Test-Path $src) { Copy-Item $src (Join-Path $Pkg $f) -Force }
    }
    # 部署脚本
    foreach ($s in @("deploy\deploy-from-package.sh", "deploy\auto-deploy-frontend.sh", "deploy\restore-frontend.sh")) {
        $src = Join-Path $VueDir $s
        if (Test-Path $src) { Copy-Item $src (Join-Path $Pkg (Split-Path $s -Leaf)) -Force }
    }
    $deployLinux = Join-Path $VueDir "deploy\med_ai_assistant_1.0_bs_vue\deploy-linux.sh"
    if (Test-Path $deployLinux) { Copy-Item $deployLinux (Join-Path $Pkg "deploy-linux.sh") -Force }

    # 可选：离线镜像（需要本机 Docker；没有则跳过，生产 deploy-linux.sh 会 --build）
    $imagesTar = Join-Path $Pkg "medai-images.tar"
    $dockerOk = $false
    try { docker version --format "{{.Server.Version}}" 2>$null | Out-Null; $dockerOk = ($LASTEXITCODE -eq 0) } catch { $dockerOk = $false }
    if ($dockerOk) {
        Write-Host "==> 构建前端镜像并导出 medai-images.tar ..."
        Push-Location $VueDir
        try {
            & docker build -t med-ai-assistant-frontend:latest . 2>&1 | Select-Object -Last 3
            & docker pull nginx:1.25-alpine 2>&1 | Select-Object -Last 2
            & docker save -o $imagesTar med-ai-assistant-frontend:latest nginx:1.25-alpine 2>&1 | Select-Object -Last 2
        } finally { Pop-Location }
    } else {
        Write-Host "==> 本机 Docker 不可用，跳过离线镜像（生产 deploy-linux.sh 会走到 --build 分支）"
    }

    $zipPath = Join-Path $RelDir "med_ai_assistant_frontend-$Version.zip"
    New-ZipFromDirectory -SourceDir $Pkg -ZipPath $zipPath
    Write-Host "==> 前端包: $([math]::Round((Get-Item $zipPath).Length/1MB,1)) MB"

    $manifest = [ordered]@{
        version   = $Version
        gitSha    = (git -C $VueDir rev-parse HEAD 2>$null)
        createdAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
        artifacts = [ordered]@{
            frontendZip = [ordered]@{
                name   = (Split-Path $zipPath -Leaf)
                size   = (Get-Item $zipPath).Length
                sha256 = (Get-FileHash $zipPath -Algorithm SHA256).Hash.ToLower()
            }
        }
    }
    $manifestPath = Join-Path $RelDir "med_ai_assistant_frontend-manifest-$Version.json"
    $manifest | ConvertTo-Json -Depth 6 | Set-Content -Path $manifestPath -Encoding UTF8

    Publish-GiteeRelease -Repo "med_ai_assistant_1.0_bs_vue" -Tag "frontend-v$Version" `
        -DisplayName "Frontend build v$Version" -AssetPaths @($zipPath, $manifestPath) -TargetBranch "master"
    return $RelDir
}

# ============================================================
# 主流程
# ============================================================
$Token = Get-GiteeToken
$dirs = @()
if ($Component -eq "backend" -or $Component -eq "all") { $dirs += (Publish-Backend) }
if ($Component -eq "frontend" -or $Component -eq "all") { $dirs += (Publish-Frontend) }

Write-Host ""
Write-Host "==> 全部完成（$Component）"
$dirs | ForEach-Object { Write-Host "    产物目录: $_" }
