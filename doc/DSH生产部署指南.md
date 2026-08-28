# DeepSeek Harness 生产部署指南

> 依据：DSH 官方 README/docs + 本机 3080 正式实例的**已验证生产方案**（start-dsh.cmd + watchdog 看门狗 + restart 脚本）。
> 适用：把 DSH Web UI（agent harness）部署为长期运行的生产服务，**含无法联网（内网/离线）的生产服务器**。

---

## 0. 部署形态概览

DSH 是**一切皆插件**（Cordis 驱动）的 agent harness，生产部署 = 「Node 进程 + profile 配置树 + 持久化数据目录 + 进程守护」。

```
┌─ 浏览器（本机或局域网/内网）────────────────┐
│   http://<host>:3080                        │
└──────────────┬──────────────────────────────┘
               │ HTTP / SSE (WebSocket)
┌──────────────▼──────────────────────────────┐
│  dsh web 进程（Node.js ≥22.19）              │
│  ┌────────────────────────────────────────┐  │
│  │ profile 配置树（$DSH_HOME/profiles/）   │  │
│  │  bundles 层 → cordis.patch.yml → overlay│  │
│  └────────────────────────────────────────┘  │
│  凭据 .credentials.yaml / 环境变量           │
└──────────────┬──────────────────────────────┘
               │ 进程守护
     systemd（Linux）/ 任务计划+watchdog（Windows）
```

- 默认 Web UI 地址：`http://127.0.0.1:3080`
- `web` 是 `--profile web` 的别名（`dsh web` = `dsh --profile web`）

---

## 1. 前置条件

| 项 | 要求 | 说明 |
|---|---|---|
| Node.js | `^22.19.0 \|\| >=24.0.0` | 生产建议用 24 LTS |
| pnpm | 11.x（仓库 packageManager=pnpm@11.7.0） | 仅源码方式需要 |
| 操作系统 | Linux（systemd）或 Windows Server | 二选一，守护方式不同 |
| 磁盘 | 数据目录所在盘预留空间 | 会话/附件/存储持久化 |
| 网络 | 放行 3080（或自定义端口） | 远程访问需可信网络/认证 |

验证：`node -v && pnpm -v`

---

## 2. 安装

### 方式 A：npm 包（快速，推荐起步）

```sh
npm install -g @deepseek-ai/dsh
dsh web          # 或 npx @deepseek-ai/dsh web
```

> 当前 npm 最新版：`0.1.1-rc.2`（开发者预览，破坏性变更可能发生）。

### 方式 B：源码部署（本机 3080 采用，可控性强）

```sh
git clone https://github.com/deepseek-ai/deepseek-harness.git
cd deepseek-harness
pnpm install
pnpm run build
pnpm dsh web
```

> 源码方式便于：
> - 加载仓库内/本地业务插件 bundle（如本项目的 `@medai/*` 插件、`dsh-routing-suite` 等）；
> - 随时 `git pull` 升级 + 重启。

### 2.3 离线（内网）部署 —— 生产服务器无法联网时

**先明确：DSH 运行本身不依赖外网**（纯 Node 进程 + 本地数据目录）。联网只发生在三处：

| 阶段 | 联网点 | 离线对策 |
|---|---|---|
| 构建期 | `pnpm install` 下载依赖 | 有网机器构建 → 整包传输 |
| 运行期 | LLM API 调用 | **必须解决**，见 §6.4 |
| 运维期 | `git pull` 升级 | 重新构建整包传输 |

> **核心约束（先读，否则白干）**：
> 1. `node_modules` 含**平台相关二进制**（`@vscode/ripgrep`、zstd native 等）→ 构建机与生产机必须 **同 OS + 同 CPU 架构 + 同 Node 大版本**。Windows↔Linux 互拷必然不可用。
> 2. pnpm 的 `node_modules` 是 **junction/symlink 指向 store** → **禁止直接 xcopy/robocopy 复制 node_modules**（链接会断）；必须用「tar 打包（跟随链接展开）」或「pnpm store + --offline」。
> 3. 生产机即使离线，也需要 Node.js 与 pnpm 本体 → 一并离线传输（见下）。

**方式 1：tar 整包拷贝（Windows→Windows / Linux→Linux，最省事，推荐）**

构建机（有网，与生产机同平台）：
```sh
git clone https://github.com/deepseek-ai/deepseek-harness.git
cd deepseek-harness
pnpm install
pnpm run build
pnpm dsh web --dump-config    # 启动前验证配置树正常
cd ..
tar -czf dsh-offline.tar.gz deepseek-harness/
# Windows 用系统自带 tar.exe 即可；tar 会把 node_modules 的 junction/symlink
# 跟随展开成真实文件（libarchive 自动防环），目标机解包后即为完整文件树
```

生产机（离线，无任何网络）：
```sh
# ① 装 Node.js（离线安装包与构建机同版本）：
#    Windows: node-v24.x.x-x64.msi   /   Linux: node-v24.x.x-linux-x64.tar.xz
#    同时装 pnpm：corepack enable 或拷贝 pnpm 安装目录
# ② 解包
tar -xzf dsh-offline.tar.gz -C /opt           # Linux
tar -xzf dsh-offline.tar.gz -C C:\            # Windows（解出 C:\deepseek-harness）
# ③ 验证依赖完整（全程零网络）
cd deepseek-harness
pnpm dsh web --dump-config                    # 能出合成树 = 依赖装配正常
```

**方式 2：pnpm store + `--offline`（Linux→Linux 推荐，最干净）**

```sh
# 构建机：装完依赖后把 store 一起导出
pnpm store path                                # 记下 store 路径（如 ~/.local/share/pnpm/store）
# 把 项目目录 + store 目录 一起拷到生产机（tar 或 rsync）

# 生产机：设好 store 路径后离线安装（零网络）
pnpm config set store-dir <拷贝过去的store路径>
cd deepseek-harness
pnpm install --offline --frozen-lockfile
```

**方式 3：npm 全局包（不挂载本地业务插件时的轻量形态）**

构建机：`npm install -g @deepseek-ai/dsh` → 把 `$(npm prefix -g)` 整个目录（全局 node_modules 是扁平结构，无链接）+ bin 脚本（`dsh.cmd`/`dsh`）拷到生产机同路径。

**离线部署运行时网络需求清单（部署后逐项核对）**：
- [ ] Node.js / pnpm 已离线安装，`pnpm dsh web --dump-config` 通过
- [ ] LLM API 可达（§6.4 决策）
- [ ] MCP 网关可达（本项目 = MedAi 后端，同内网 127.0.0.1:8081 或内网 IP）
- [ ] 浏览器可访问 DSH Web UI（内网 HTTP，与公网无关）

---

## 3. 数据目录与 profile 体系（核心概念）

### 3.1 DSH_HOME

所有持久化数据集中在 `$DSH_HOME`（默认 `~/.dsh`，本机为 `C:\Users\Administrator\.dsh`）：

```
.dsh/
├── profiles/            # profile 配置树（核心）
│   ├── web/             #   web profile：package.json + cordis.yml + cordis.patch.yml
│   │   ├── package.json        # dsh.profile.bundles 声明装配哪些 bundle
│   │   ├── cordis.yml          # 空入口，勿编辑（由 patch 合成）
│   │   └── cordis.patch.yml    # ★ 用户 patch 层：webserver/插件/MCP 全在这改
│   ├── headless/        #   一次性任务 profile（CLI 批处理模式）
│   └── node_modules/
├── sessions/            # 会话持久化（可恢复会话）
├── storages/            # 存储
├── attachments/         # 附件（read_image 等）
├── skills/              # skill 目录
├── settings.yaml        # UI 主题、默认模型等
└── .credentials.yaml    # ★ API 密钥（生产敏感）
```

### 3.2 profile 配置树的分层

```
bundle 层（package.json: dsh.profile.bundles，如 @deepseek-ai/dsh-base、@deepseek-ai/dsh-web-app）
   ↓
用户 patch 层（profiles/web/cordis.patch.yml）        ← 生产配置写这里
   ↓
命令行 overlay（dsh web --patch extra.yml）          ← 临时/环境级覆盖
```

查看合成后的完整配置树（不改动运行）：

```sh
pnpm dsh web --dump-config          # 含用户层
pnpm dsh web --dump-default-config  # 仅 bundle 层
```

---

## 4. 配置

### 4.1 凭据（API 密钥）

打开 Web UI → **设置 → 模型**，输入 DeepSeek API 密钥保存（写入 `.credentials.yaml`，立即生效，无需重启）。
其他 provider（OpenAI 兼容端点等）见 `docs/user/guide/providers.md`。

生产建议：密钥走环境变量注入（如 `MEDAI_MCP_TOKEN` 模式），不落明文到代码库。

### 4.2 服务器监听（cordis.patch.yml）

```yaml
# profiles/web/cordis.patch.yml 示例
- id: webserver
  config:
    host: 127.0.0.1        # 默认本机；局域网访问改绑 LAN IP（见 §6）
    port: !!js ctx.webStartup.port ?? 3080
```

### 4.3 业务插件 / MCP 接线（cordis.patch.yml）

本机 3080 生产实例的真实 patch（节选，完整见 `C:\Users\Administrator\.dsh\profiles\web\cordis.patch.yml`）：

```yaml
# MCP 网关接线：连接后端 MCP 服务器
- insert:
    - id: mcp-medai
      name: '@medai/dsh-mcp-client'
      config:
        serverName: medai
        transport: streamable-http
        url: http://127.0.0.1:8081/mcp
        exchangeToken: !!js 'process.env.MEDAI_MCP_TOKEN'
        failOnStartupError: false        # 网关宕机不阻塞 DSH 启动
        toolCallTimeoutMs: 60000
        reconnect: { enabled: true, initialDelayMs: 1000, maxDelayMs: 30000, maxAttempts: 10 }

# 数据脱敏 / 报告卡片 / 会话同步等业务插件
- insert:
    - id: dsh-pii-guard
      name: '@medai/dsh-pii-guard'
- insert:
    - id: dsh-ui-report-card
      name: '@medai/dsh-ui-report-card'
```

> 插件通过 `dsh plugin --profile web add <package>` 安装进 profile，再在 patch 中插入接线。

### 4.4 默认模型（settings.yaml）

```yaml
agent-default-model:
  provider: deepseek-official
  model: deepseek-v4-flash
  reasoningEffort: high
```

---

## 5. 首次启动与验证

```sh
# 1) 预览配置树（确认无语法错误）
pnpm dsh web --dump-config > tree.txt

# 2) 启动（前台，观察日志）
pnpm dsh web

# 3) 验证
curl http://127.0.0.1:3080        # 200
netstat -ano | findstr 3080       # LISTENING
```

打开浏览器访问，配置模型密钥 → 添加工作区 → 跑一条任务验证 agent 链路。

> 注意：`dsh` 进程把**调用目录**作为默认文件系统位置 → 生产启动脚本中 `cd` 到固定工作目录（如项目根），再用 `file-browser.root` 配置默认浏览目录。

---

## 6. 网络暴露与安全（关键）

### 6.1 安全事实（必须先读）

1. **`--host 0.0.0.0` 被 DSH 有意禁止**（启动报错）：因为 agent 有工具执行能力 = 远程代码执行，不能裸绑全网卡。
2. 远程访问的正确姿势：**绑定具体 LAN/VPN IP** + `--trusted-host` 声明信任的 authority + （可选）`--allow-remote-privileged-methods` 放开特权方法。
3. `/api` 有浏览器信任围栏（DNS-rebinding 防护）：非 loopback 来源必须命中 `trustedHosts` 才放行。

### 6.2 局域网/VPN 直接访问（本机 3080 真实方案）

```sh
pnpm dsh web \
  --host 100.66.1.3 \
  --trusted-host 100.66.1.3 \
  --allow-remote-privileged-methods
```

- `--trusted-host`：可重复，支持 `host` 或 `host:port`；
- `--allow-remote-privileged-methods`：允许可信来源访问特权方法（settings/credentials/agent-preset 编写/原生对话框），通常绑 loopback。

### 6.3 反向代理（更推荐的生产形态）

用 Nginx/Caddy 做 TLS 终结 + 基本认证，再反代到 `127.0.0.1:3080`：

```nginx
server {
  listen 443 ssl;
  server_name dsh.example.com;
  # ssl_certificate ...;

  location / {
    proxy_pass http://127.0.0.1:3080;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;      # SSE/WebSocket 必需
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
  }
}
```

> 反代形态下 `--host 127.0.0.1` 即可，浏览器只与 TLS 边界通信；务必加认证（basic auth / SSO），并限制仅可信网络可达。

### 6.4 LLM 通道（内网/离线服务器必须决策）

DSH 是 agent harness，**必须能调用 LLM 才能工作**——生产机无法联网时，这是唯一绕不开的运行期网络依赖，三选一：

| 方案 | 适用 | 说明 |
|---|---|---|
| **① 内网 OpenAI 兼容端点（推荐）** | 内网已有 vLLM / Ollama / DeepSeek 私有化 / one-api / new-api 等 | DSH 配自定义 OpenAI 兼容 provider，baseURL 填内网地址，零外网 |
| **② 内网转发代理** | 内网仅一台机器能出网 | 在该机跑 one-api/new-api/自建 HTTP 中转，DSH 指向内网代理地址 |
| **③ 无任何 LLM** | 极端隔离 | DSH 无法运行；只部署 MedAi 后端 MCP 网关等无 LLM 依赖的服务 |

配置方式二选一：
- GUI：**设置 → 模型 → 添加自定义端点** → 填 baseURL（如 `http://llm-gateway:8000/v1`）、模型名、密钥 → 保存后立即可路由，无需重启；
- 配置文件（`$DSH_HOME/settings.yaml`）：
```yaml
agent-default-model:
  provider: <内网provider名>
  model: <模型名>
```
> 自定义 provider 的详细配置（请求格式、headers 等）见官方 `docs/user/guide/providers.md`（`@deepseek-ai/dsh-llm-openai-compatible` 适配器）。

### 6.5 本项目 LLM 通道落地：执行服务器 M3 代理（已验证兼容）

本项目后端已内置 **M3 DSH 专用 LLM 出口**（`DshLlmProxyController`，仅执行服务器装配），与 DSH 官方 `llm-deepseek` 适配器**天然兼容**（已源码核实）：

| 契约项 | M3 代理（执行服务器） | DSH llm-deepseek 适配器 | 兼容 |
|---|---|---|---|
| 端点 | `POST /api/dsh-llm/chat/completions` | `POST {baseURL}/chat/completions` | ✅ baseURL=`http://<执行服务器>:8082/api/dsh-llm` |
| 鉴权 | `Authorization: Bearer <每机token>`（哈希注册表） | `Authorization: Bearer <apiKey>` | ✅ apiKey=每机 token |
| 响应流 | 清洗后的 DeepSeek SSE 行（`data: {...}` + `data: [DONE]`，PII 清洗/残留阻断/审计） | `parseSse`（eventsource-parser） | ✅ 逐行透传不改行结构 |
| 模型 | 上游按 `model` 字段解析（`deepseek-v4-flash` 等） | catalog 默认含 `deepseek-v4-flash` | ✅ |

**生产机配置**（`$DSH_HOME/settings.yaml`）：
```yaml
llm-deepseek:
  baseURL: http://10.120.10.251:8082/api/dsh-llm   # 生产执行服务器（示例 IP，按实际）
  apiKeyEnv: DSH_MACHINE_TOKEN                      # 每机 token 走环境变量（生产勿落盘）
agent-default-model:
  provider: deepseek-official
  model: deepseek-v4-flash
```
- 环境变量 `DSH_MACHINE_TOKEN=<每机token>`：值由运维生成，**SHA-256 哈希注册**到执行服务器配置 `medai.llmproxy.machines[]`（token 不落明文）；
- 限流默认 60 次/分钟/机（`medai.llmproxy.rate-limit-per-minute-per-machine`），需更高配额在执行服务器调；
- 执行服务器需 `@Profile("execution")` + `medai.llmproxy.enabled=true` + 已配置 `machines` 注册表，DEEPSEEK_API_KEY 只存在于执行服务器（出网口唯一）。

---

## 7. 进程守护（生产必备）

DSH 是单 Node 进程，进程守护 = 崩溃自愈 + 开机自启。二选一：

### 7.1 Linux：systemd

```ini
# /etc/systemd/system/dsh.service
[Unit]
Description=DeepSeek Harness Web
After=network-online.target

[Service]
Type=simple
User=dsh
WorkingDirectory=/opt/deepseek-harness
Environment=DSH_HOME=/var/lib/dsh
ExecStart=/usr/local/bin/pnpm dsh web --host 127.0.0.1
Restart=always
RestartSec=5
# 依赖后端网关时：ExecStartPre 探活，或业务插件 failOnStartupError=false

[Install]
WantedBy=multi-user.target
```

```sh
sudo systemctl daemon-reload && sudo systemctl enable --now dsh
journalctl -u dsh -f          # 看日志
```

### 7.2 Windows：任务计划程序 + watchdog（本机 3080 已验证）

**三层脚本**（本机即用模板，位于 `C:\Users\Administrator\.dsh\`）：

**① 启动脚本 `start-dsh.cmd`** —— 幂等启动 + 依赖检查（端口占用 → pnpm → 后端网关就绪 → 启动）：

```bat
@echo off
setlocal enabledelayedexpansion
set "PROJECT_DIR=C:\path\to\deepseek-harness"
set "PORT=3080"

rem 已在运行则跳过（防双开）
powershell -NoProfile -Command "try{$c=New-Object Net.Sockets.TcpClient;$c.Connect('127.0.0.1',%PORT%);$c.Close();exit 0}catch{exit 1}" >nul 2>&1
if not errorlevel 1 ( echo [OK] dsh already running. & exit /b 0 )

where pnpm >nul 2>&1 || ( echo [ERROR] pnpm not found & pause & exit /b 1 )

rem （可选）依赖检查：后端 MCP 网关 8081 未就绪则先拉起并轮询等待
rem （本机方案：网关就绪检查 + 90s 轮询，详见 .dsh\start-dsh.cmd 原版）

cd /d "%PROJECT_DIR%"
call pnpm dsh web --trusted-host 100.66.1.3 --allow-remote-privileged-methods
exit /b %errorlevel%
```

**② 看门狗 `watchdog-dsh.ps1`** —— TCP 探活，挂了且 10 分钟内未拉过则拉起：

```powershell
param([int]$Port = 3080)
$dshHome = 'C:\Users\Administrator\.dsh'
$log  = Join-Path $dshHome 'watchdog-dsh.log'
$lock = Join-Path $dshHome 'watchdog-dsh.lock'
$launch = Join-Path $dshHome 'watchdog-launch.cmd'

# 1) 端口通 → 健康，退出
$client = $null
try {
  $client = New-Object System.Net.Sockets.TcpClient
  $connect = $client.ConnectAsync('127.0.0.1', $Port)
  if ($connect.Wait(3000) -and $client.Connected) { exit 0 }
} catch { } finally { if ($client) { $client.Close() } }

# 2) 10 分钟防抖锁
if (Test-Path $lock) {
  $age = (Get-Date) - (Get-Item $lock).LastWriteTime
  if ($age.TotalMinutes -lt 10) { exit 0 }
}
"$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  [watchdog] DSH down, launching" | Add-Content $log -Encoding ASCII
(Get-Date) | Set-Content $lock -Encoding ASCII
Start-Process -FilePath $launch -WorkingDirectory $dshHome -WindowStyle Hidden
```

（`watchdog-launch.cmd` = 隐藏窗口里 `cd 项目目录 && call start-dsh.cmd` 并把输出追加到日志）

**③ 计划任务触发**（每 5 分钟跑一次 watchdog）：

```bat
schtasks /Create /TN "dsh-watchdog" /TR "powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\Administrator\.dsh\watchdog-dsh.ps1" /SC MINUTE /MO 5 /RL HIGHEST /RU SYSTEM
```

### 7.3 手动重启 `restart-dsh.ps1`（本机 3080 已验证模板）

动态定位 3080 监听进程 → 沿父链找 `start-dsh.cmd` 根 → `taskkill /T /F` → 等端口释放（15s）→ 兜底强杀 → 重新拉起。完整代码见 `C:\Users\Administrator\.dsh\restart-dsh.ps1`（53 行，直接复用）。

---

## 8. 运维

### 8.1 日志
- 前台启动：stdout 即日志；
- 守护形态：Linux 用 `journalctl -u dsh`；Windows 用启动脚本重定向（`>> watchdog-dsh-start.log 2>&1`）。

### 8.2 健康检查
```sh
curl -sf http://127.0.0.1:3080 >/dev/null && echo OK
```
（看门狗即基于此探活；可外接监控平台轮询。）

### 8.3 备份（务必）
```sh
# 数据目录整体备份（会话/凭据/profile/附件）
tar czf dsh-backup-$(date +%F).tgz ~/.dsh
# 或 Windows：robocopy C:\Users\Administrator\.dsh D:\backup\dsh /MIR
```
> `.credentials.yaml` 含 API 密钥——备份需加密存储，权限收紧。

### 8.4 升级（源码方式）
```sh
git pull
pnpm install
pnpm run build
# 重启（Linux: sudo systemctl restart dsh；Windows: 运行 restart-dsh.ps1）
```
> 升级前先备份 `~/.dsh`；升级后核对 `dsh web --dump-config` 无异常。

**离线升级（无法联网的生产机）**：在有网构建机重新 `git pull → pnpm install → pnpm run build` → 重新打 tar → 传输到生产机 → **只覆盖代码目录，保留 `$DSH_HOME` 数据目录不动** → 解包 → 重启。若升级涉及 `cordis.patch.yml` 新插件接线，同步更新生产机 profile。

### 8.5 多实例隔离（本机已验证）
- 不同实例用不同 `DSH_HOME` + 不同端口：
  - 正式：`DSH_HOME=~/.dsh` + 3080（`start-dsh.cmd`）
  - 开发沙箱：`DSH_HOME=~/.dsh-dev` + 3081（`start-dsh-dev.cmd`，--port 3081）
- 互不干扰，可同时运行；开发实例的插件先在沙箱验证再上正式。

---

## 9. 生产部署 Checklist

- [ ] Node.js ≥ 22.19（24 LTS 更佳），pnpm 11.x
- [ ] 安装完成（npm 包 或 源码 clone+build）
- [ ] `DSH_HOME` 指向专用数据目录，首次启动确认 profiles 自动初始化
- [ ] `.credentials.yaml` / 环境变量配置 API 密钥（GUI 设置 → 模型 验证可路由）
- [ ] `cordis.patch.yml`：webserver host/port、业务插件、MCP 接线、`failOnStartupError` 策略
- [ ] 启动脚本固定 `cd` 工作目录
- [ ] 远程访问：LAN IP + `--trusted-host`（或 Nginx 反代 + TLS + 认证）；**不用 0.0.0.0**
- [ ] **离线（无法联网时）**：构建机与生产机同 OS/arch/Node 版本；tar 整包或 pnpm store 方式传输；Node/pnpm 已离线安装
- [ ] **离线（无法联网时）**：LLM 通道决策完成（内网端点/代理），DSH provider 指向内网地址；MCP 网关地址改为生产内网可达地址
- [ ] 进程守护：systemd 或 计划任务 + watchdog（探活 + 防抖 + 自愈）
- [ ] 手动重启脚本验证一次（kill → 自动拉起）
- [ ] 数据目录备份策略落地（含加密的凭据）
- [ ] 升级演练：git pull → build → restart → 配置树核对

---

## 10. openEuler 22.03 生产落地实战（MedAi 项目参考）

> 目标机：**openEuler 22.03 (LTS-SP3) x86_64，IP 10.120.11.43（无法联网）**；LLM 经**执行服务器（10.120.10.251:8082）M3 代理**中转（§6.5）。

### 10.1 部署拓扑

```
医生站（Windows，独立客户端，内网）
   │ 经主服务器业务接口/API 集成调用（不直接访问 DSH 页面）
   ▼
DSH + MedAi 主服务器（openEuler 10.120.11.43 = 生产主服务器，同一台机，离线外网，systemd 守护）
   ├─ headless 服务：127.0.0.1:3080（仅同机回环监听，无人工 GUI）
   ├─ LLM  ──► 执行服务器 10.120.10.251:8082 /api/dsh-llm（M3 代理，Bearer 每机 token）
   │               └─► DeepSeek API（执行服务器出网，持 DEEPSEEK_API_KEY）
   └─ MCP  ──► 127.0.0.1:8081/mcp（同机主服务器 MCP 网关，回环直连，零防火墙）
```

> 已确认：**10.120.11.43 = 生产环境主服务器（非医生站）** = DSH 部署机（同机）→ MCP 网关走 `127.0.0.1:8081`，无需跨机放行。执行服务器 = 10.120.10.251:8082（compose 中 MAIN_SERVER_HOST=10.120.10.250 为执行服务器回调地址，与 DSH 侧无关）。**DSH 以 headless 服务形态运行在主服务器上**：医生站（Windows）经主服务器后端集成调用 DSH 能力（对话/文书生成等），不直接访问 DSH Web 页面。

### 10.2 构建（在有网 x86_64 Linux 构建机上完成）

已验证候选：**测试服务器 100.66.1.4（Ubuntu 24.04 x86_64，可访问 GitHub/npm registry）**，其 Node 为 v18.19.1，需先升级：

```sh
# ① 构建机安装 Node 24 + pnpm（可联网，直接装）
curl -fsSL https://nodejs.org/dist/v24.x.x/node-v24.x.x-linux-x64.tar.xz | tar -xJ -C /opt
export PATH=/opt/node-v24.x.x-linux-x64/bin:$PATH
npm install -g pnpm@11

# ② 克隆 + 构建（与生产机同平台，产物含 Linux 二进制依赖）
git clone https://github.com/deepseek-ai/deepseek-harness.git
cd deepseek-harness
pnpm install
pnpm run build
pnpm dsh web --dump-config        # 构建产物自检

# ③ 打包（含 node_modules，tar 跟随 symlink/junction 展开为真实文件）
cd ..
tar -czf dsh-offline-linux.tar.gz deepseek-harness/
# 同时准备：node-v24.x.x-linux-x64.tar.xz（生产机离线安装 Node 用）
```

> **业务插件一并打包（MedAi 项目）**：生产 DSH 需挂载 `@medai/*` 插件（至少 `@medai/dsh-mcp-client` fork——含 exchangeToken 双因子/重连，官方 mcp-client 无此能力）。步骤：
> ```sh
> # ① 把 medai-plugins 仓库（D:\MedAiAssistant 1.0 BS\medai-plugins）传到构建机
> cd medai-plugins && pnpm install        # ★ 必装：插件运行依赖（@modelcontextprotocol/sdk 等）
> #    link: 装配的依赖不会递归安装，插件的 node_modules 必须在 medai-plugins 自身 install
> # ② 在 DSH profile 声明 link: 依赖（@medai/* 是 TS 源码直载，main: src/index.ts，无需 build）
> #    profile package.json: "@medai/dsh-mcp-client": "link:<路径>/packages/@medai/dsh-mcp-client"
> #    profile pnpm-workspace.yaml: nodeLinker: hoisted + autoInstallPeers: false（防拉 peer 404）
> # ③ tar 打包时 link 展开为真实文件 → 插件源码+依赖一并进包
> # 可选补丁：dsh-api-proxy-source-guard.patch（medai-plugins/patches/，git apply 进 deepseek-harness）
> ```
> 插件最小集建议：`dsh-mcp-client`（必需）+ `dsh-pii-guard`（网关宕机降级提示）；UI 类（report-card / session-sync / feature-guide / record-sync / flow-panel / flow-validator / ui-draft-card）按生产功能需求选装——**UI 类插件含 client bundle，装配方式不同（需 client roster + 构建 client.js），二期单独处理**。

### 10.3 传输与安装（生产机 10.120.11.43，全程离线）

```sh
# ① 通过内网通道（U 盘/堡垒机/内网共享）把 tar 与 Node 安装包送到生产机
# ② 安装 Node（离线 tarball 解压即用）
mkdir -p /opt/node && tar -xJf node-v24.x.x-linux-x64.tar.xz -C /opt/node --strip-components=1
export PATH=/opt/node/bin:$PATH
node -v                                   # v24.x.x
# ③ 解包 DSH
tar -xzf dsh-offline-linux.tar.gz -C /opt   # → /opt/deepseek-harness
cd /opt/deepseek-harness
node apps/cli/lib/types/bin.js --version 2>/dev/null || true
pnpm dsh web --dump-config                  # 零网络自检通过
```

### 10.4 配置（生产机）

```sh
export DSH_HOME=/var/lib/dsh
export DSH_MACHINE_TOKEN=<运维生成的每机token>
```

`/var/lib/dsh/profiles/web/cordis.patch.yml`：
```yaml
- id: webserver
  config:
    host: 127.0.0.1          # 内网反代/直连时改绑内网 IP 并加 --trusted-host
    port: !!js ctx.webStartup.port ?? 3080

# medai MCP 网关 → 同机主服务器（回环直连）
- insert:
    - id: mcp-medai
      name: '@medai/dsh-mcp-client'
      config:
        serverName: medai
        transport: streamable-http
        url: http://127.0.0.1:8081/mcp
        exchangeToken: !!js 'process.env.MEDAI_MCP_TOKEN'
        failOnStartupError: false
        reconnect: { enabled: true, initialDelayMs: 1000, maxDelayMs: 30000, maxAttempts: 10 }
```

`/var/lib/dsh/settings.yaml`：
```yaml
llm-deepseek:
  baseURL: http://10.120.10.251:8082/api/dsh-llm
  apiKeyEnv: DSH_MACHINE_TOKEN
agent-default-model:
  provider: deepseek-official
  model: deepseek-v4-flash
  reasoningEffort: high
```

### 10.5 systemd 守护（openEuler）

```ini
# /etc/systemd/system/dsh.service
[Unit]
Description=DeepSeek Harness Web (MedAi production)
After=network-online.target

[Service]
Type=simple
User=dsh
WorkingDirectory=/opt/deepseek-harness
Environment=DSH_HOME=/var/lib/dsh
Environment=DSH_MACHINE_TOKEN=<每机token>
Environment=MEDAI_MCP_TOKEN=<每机token>
ExecStart=/opt/node/bin/pnpm dsh web --host 127.0.0.1
Restart=always
RestartSec=5
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
```

```sh
sudo systemctl daemon-reload && sudo systemctl enable --now dsh
journalctl -u dsh -f
curl -sf http://127.0.0.1:3080 >/dev/null && echo DSH-OK
```

### 10.6 验证清单（生产上线前）

- [ ] 构建机产物 `dsh web --dump-config` 通过（§10.2）
- [ ] 生产机离线解包后 `--dump-config` 通过（§10.3）
- [ ] 执行服务器 M3 代理在线：`curl -X POST http://10.120.10.251:8082/api/dsh-llm/chat/completions -H "Authorization: Bearer <token>" -d '{"model":"deepseek-v4-flash","messages":[{"role":"user","content":"hi"}],"stream":true}'` 返回 SSE 流
- [ ] 生产主服务器 /mcp 网关在线（`failOnStartupError=false` 时 DSH 可先行启动，medai 工具缺失有降级提示）
- [ ] GUI 登录 → 新建会话 → 发一条任务 → 回复 + 工具调用正常（LLM 走 M3 代理，工具走 MCP 网关）
- [ ] 重启演练：`systemctl restart dsh` → 自动恢复；kill 进程 → Restart=always 拉起
- [ ] 数据目录备份策略就位（`/var/lib/dsh`）

### 10.7 上线前需确认的参数（当前状态）

1. ✅ **生产主服务器 IP**：10.120.11.43（= DSH 同机）→ MCP 网关用 `http://127.0.0.1:8081/mcp`
2. ⏳ **执行服务器 machines 注册**：见 §10.8（需在生产执行服务器配置追加并重启）
3. ⏳ **每机 token 生成**：命令见 §10.8 步骤 ①（生成后明文只在 DSH 机环境变量）
4. ✅ **构建机**：100.66.1.4（Ubuntu 24.04 x86_64，Node 已升 24.11.1，pnpm 待确认）
5. ⏳ **防火墙放行**：10.120.11.43 出向 → 10.120.10.251:8082（DSH→执行服务器 M3）；同机 127.0.0.1:8081 无需放行

### 10.8 执行服务器 machines 注册操作步骤（openEuler 10.120.10.251）

**背景**：M3 代理鉴权 = `Authorization: Bearer <每机token>`，执行服务器只存 **SHA-256 哈希**（`ProxyTokenAuthenticator` 每请求 `SHA-256(token)` 比对，不落明文）。当前生产执行服务器配置**尚无 `medai.llmproxy` 段**（`llm.proxy-ip-whitelist` 已含 10.120.11.43，但那是老版 LlmProxyController 的 IP 白名单，与 M3 无关）。

**① 生成每机 token 并算哈希**（✅ **2026-08-24 已生成并落地**）：
- 明文 token：`c09be4be13014eb094ffca1a`（DSH 机环境变量 `DSH_MACHINE_TOKEN` 与 `MEDAI_MCP_TOKEN` 均用它；勿提交到代码库）
- token-hash：`456ad78681a640e45b6d82e531d43de9bb01470c2e91de2583c9550f8ed945e5`（SHA-256(UTF-8) 小写 hex，已写入执行服务器 `machines[0]` 与主服务器 `medai.mcp.tokens[3]`）

新机器自行生成（在 DSH 机 10.120.11.43 或任意 Linux 上执行）：
```sh
TOKEN=$(openssl rand -hex 24)                # 48 位十六进制随机串
echo "明文 token（仅 DSH 机环境变量使用，勿外传）：$TOKEN"
echo -n "$TOKEN" | sha256sum | awk '{print $1}'   # → token-hash（小写 hex，与 Java SHA-256 UTF-8 一致）
```

**② 在生产执行服务器配置追加**（✅ **2026-08-24 已落地**：`deploy/execution-linux/config/execution/application-execution.properties`，容器挂载卷 `./config/execution:/app/config:ro`，容器内 `/app/config/application-execution.properties`）：
```properties
# LLM 代理（M3，DSH 专用出口）配置 — 2026-08-24 生产启用
medai.llmproxy.enabled=true
medai.llmproxy.block-on-residual=true
medai.llmproxy.rate-limit-per-minute-per-machine=60
medai.llmproxy.mapping-ttl-seconds=1800
# 每机 token 注册表（SHA-256 哈希；生产配置从零加，用 [0]，无 dev 占位）
medai.llmproxy.machines[0].token-hash=<步骤①的 sha256 输出>
medai.llmproxy.machines[0].machine-id=dsh-prod-1043
```
> **主服务器 MCP 网关（M2）同步注册**（✅ 已落地：`deploy/main-linux-oracle/config/application.properties`）——DSH 的 MEDAI_MCP_TOKEN 走 exchangeToken 双因子，主服务器须有对应准入条目（doctor-id 必填，服务 JWT 绑定医生身份）：
> ```properties
> medai.mcp.tokens[3].token-hash=<同一 sha256>
> medai.mcp.tokens[3].doctor-id=D001        # DSH 换取服务 JWT 绑定的医生身份，可改
> medai.mcp.tokens[3].machine-id=dsh-prod-1043
> medai.mcp.tokens[3].departments[0]=心血管一病区
> ```
> M2/M3 共用同一 token（与 dev 环境 medai-dev-token 同哈希复用模式一致）。

**③ 重启执行服务器容器**（注意记忆库坑 2：必须显式项目名 + force-recreate）：
```sh
cd /medai/deploy/execution-linux   # 或实际部署目录
docker compose -p execution-prod up -d --force-recreate --remove-orphans
# 或旧版：docker-compose -p execution-prod up -d --force-recreate
docker logs -f med-ai-execution-server | grep -i llmproxy   # 确认装配无报错
```

**④ 验证 M3 端点在线**（从 DSH 机 10.120.11.43 执行，须放行出向 8082）：
```sh
curl -N -X POST http://10.120.10.251:8082/api/dsh-llm/chat/completions \
  -H "Authorization: Bearer <明文token>" \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-v4-flash","messages":[{"role":"user","content":"你好，请回复OK"}],"stream":true}'
# 期望：HTTP 200 + SSE 流（data: {...} ... data: [DONE]）
# 401 = token 哈希未注册/不匹配；429 = 超配额；无响应 = 防火墙/容器未起
```

**⑤ 反向核对哈希算法一致性**（可选）：Java 端 = `SHA-256(token UTF-8)` 小写 hex；`echo -n`（不带换行）必须与 Java 一致，注意**不要用 `printf` 自带换行**或用 `echo` 不带 `-n` 的情况。
