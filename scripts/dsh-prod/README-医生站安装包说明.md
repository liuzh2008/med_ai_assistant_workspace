# 医生端 DSH 安装包说明（Windows 医生站）

## 📦 安装包

**`D:\dsh-win-build\dsh-station-install-20260824.bat`**（542.5 MB，自解压单文件 .bat）

**E2E 验收（2026-08-24，本机完整链路）**：
```
install: Node v24.11.1 + node_modules 936 包离线重建 + profile 装配 + 计划任务 ✅
DSH 监听 127.0.0.1:3099 + HTTP 200 ✅
[1/5] web alive → [2/5] session.create → [3/5] prompt accepted → [4/5] assistant 回复
HEADLESS 验证结果: PASS ✅（LLM → M3 代理 → DeepSeek 全链路）
```

## 用法（医生站 Windows 电脑，内网，无管理员）

```bat
dsh-station-install-20260824.bat
```
双击或命令行运行。自动完成：Node 24+pnpm → DSH 代码树 → 依赖离线重建（pnpm store）→ medai 插件装配 → DSH_HOME 预置（含工具收敛 profile）→ token 环境文件 → **计划任务**（`dsh-station` 开机自启 + `dsh-station-watchdog` 每 5 分钟探活）→ 启动 → 自检。

- 安装目录：`%LOCALAPPDATA%\dsh`（免管理员）
- Web：`http://127.0.0.1:3080`（**工作站现有前端 iframe 嵌入**，浏览器信任围栏天然放行）
- 验证：`node "%LOCALAPPDATA%\dsh\verify-prod-headless.mjs" http://127.0.0.1:3080/api 120000`

## 拓扑

```
医生站（Windows，多台）
   └─ DSH（本机 %LOCALAPPDATA%\dsh，计划任务守护）
        ├─ MCP → 主服务器 10.120.11.43:8081/mcp（跨机，双因子每机 token）
        └─ LLM → 执行服务器 10.120.10.251:8082/api/dsh-llm（M3 代理）
```

## 每机 token（医生站）

- 明文：`0aee7c63d24d19008bbf9045`（`DSH_MACHINE_TOKEN` / `MEDAI_MCP_TOKEN`，已内置安装包）
- 哈希：`609b15dab6fc62ac013ac8d5ab5bad7e8b879f74fb5d3bbcca94b9dd494f68ca`
- **已注册**（deploy 配置已改，随服务器重启生效）：
  - 主服务器 `medai.mcp.tokens[4]`（machine-id=dsh-station，doctor-id=D001）
  - 执行服务器 `medai.llmproxy.machines[1]`（machine-id=dsh-station）
- 多站共享此 token；**台数扩展**时：`openssl rand -hex 24` 生成独立 token → 哈希注册两处 → 安装包内改 token（或分发时经环境变量覆盖）→ 重新打包。

## 服务器侧前置（已改配置，待重启）

1. 主服务器（10.120.11.43）：`deploy/main-linux-oracle/config/application.properties` 已含 `medai.mcp.tokens[3]/[4]` → 重启主服务器容器（`docker compose -p medai-main-prod up -d --force-recreate`）
2. 执行服务器（10.120.10.251）：`deploy/execution-linux/config/execution/application-execution.properties` 已含 `machines[0]/[1]` → 重启执行服务器（`-p execution-prod`）
3. 防火墙：医生站出向 → 10.120.11.43:8081、10.120.10.251:8082

## 分发方式（参考《侧边栏面板方案》）

放主系统 `/downloads/` 静态目录 → 医生站内网浏览器直接下载运行（一机一人）。

## 安全边界（医生端瘦客户端，方案文档既定）

- 医生端 profile 已内置**工具收敛**（`tool-fs/pwsh/bash/web/subagent/workflow/...` 全禁，模型能力面只剩 `mcp__medai__*` + `medai_feature_guide`）——依据《DSH医疗环境最严格工具收敛方案.md》
- 患者数据不落医生电脑（数据在服务器端，`PatientAccessGuard` + 双因子 + LLM 代理 PII 清洗）
- 医生站失陷威胁由服务器端边界 + 医院安全体系兜底（非 DSH 白名单职责）
