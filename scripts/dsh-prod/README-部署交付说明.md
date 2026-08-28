# DSH 生产部署交付包说明（MedAi 项目）

> 生产目标机：openEuler 22.03 x86_64，**10.120.11.43 = 生产环境主服务器（非医生站）**（MCP 服务器同机 8081），无法联网
> 拓扑：医生站（Windows）为独立客户端，经内网调用主服务器业务，DSH 能力由主服务器后端集成——**DSH 本身是主服务器上的 headless 服务**
> 构建机：100.66.1.4（Ubuntu 24.04，有网）

## ✅ 最终验收（2026-08-24 E2E 全通过）

单文件安装包在构建机完整 E2E（真实 systemd 安装 + headless 验证）：

```
install exit: 0        # 一键安装全流程（Node/依赖离线重建/profile 装配/systemd/自检）
PORT-OK                # DSH 服务 systemd active，监听 3080
[1/5] web alive: HTTP 200
[2/5] session.create → sessionId: session-99648edd-...
[3/5] session.prompt → accepted: true
[4/5] history → assistant/chunk + turn/end（LLM → M3 代理 → DeepSeek 全链路通）
HEADLESS 验证结果: PASS ✅
```

## 📦 单文件安装包（一键安装，自动配置）

**`/home/liuzh2008/medai/downloads/dsh-prod-install-20260824.run`** —— 自解压单文件（≈583 MB：Node 24+pnpm、DSH v0.1.1-rc.2 源码、medai 插件、pnpm store 1.5G+缓存、全部预置配置、systemd 模板），**安装后自动完成全部配置**。

```sh
# 传输到生产机（U 盘 / 内网通道 / scp）后：
sudo ./dsh-prod-install-20260824.run
# 可选参数：sudo ./dsh-prod-install-20260824.run --dir /opt --home /var/lib/dsh
# 自定义 token：DSH_MACHINE_TOKEN=xxx MEDAI_MCP_TOKEN=xxx sudo ./dsh-prod-install-20260824.run
```

安装过程自动完成：
1. Node 24 + pnpm 解压到 `/opt/node`
2. DSH 代码树 → `/opt/deepseek-harness`（medai-plugins → `/opt/medai-plugins` 备用）
3. 预置 DSH_HOME → `/var/lib/dsh`（`profiles/web`、`settings.yaml`、`storages/workspace.json`）
4. 创建运行用户 `dsh` + 工作区 `/opt/medai-dsh-workspace`
5. token 写入 `/etc/dsh-prod/env`（600，systemd EnvironmentFile）
6. systemd 服务 `/etc/systemd/system/dsh.service`（enable --now）
7. 自检（端口探活 + MCP 网关 8081 探活 + 安装报告）

安装后验证（headless，无 GUI）：
```sh
node /opt/verify-prod-headless.mjs http://127.0.0.1:3080/api 120000
# PASS = LLM→M3 代理→DeepSeek 链路通（含 medai MCP 工具在位检测）
```

## 🖥️ 生产形态：Headless 服务（无图形网页端）

**生产环境没有图形网页端** —— DSH 按 **headless 服务形态**部署：无人机浏览器交互，**首次配置全部预置**（不依赖 GUI 引导），**验证走 API**（不依赖浏览器）。

| 事项 | 预置方式 |
|---|---|
| LLM 通道 | `$DSH_HOME/settings.yaml` 预置 `llm-deepseek.baseURL=http://10.120.10.251:8082/api/dsh-llm` + `apiKeyEnv: DSH_MACHINE_TOKEN`（**已入包**） |
| 默认模型 | `settings.yaml` → `agent-default-model: deepseek-official / deepseek-v4-flash`（**已入包**） |
| 凭据 | 环境变量 `DSH_MACHINE_TOKEN` + `MEDAI_MCP_TOKEN`（systemd unit 注入） |
| 工作区 | `$DSH_HOME/storages/workspace.json` 预置 `/opt/medai-dsh-workspace`（**已入包**，部署时创建该目录） |
| 验证 | `verify-prod-headless.mjs`（API 全链路：存活 → 建会话 → 提问 → 轮询历史） |

> 监听仅 `127.0.0.1:3080`（同机主服务器前端/API 调用即可，无需 `--trusted-host` / `--allow-remote-privileged-methods`）。

## ✅ 构建与验证状态（2026-08-24 完成）

| 项 | 结果 |
|---|---|
| Node / pnpm（构建机） | v24.11.1 / 11.23.0 |
| DSH checkout | v0.1.1-rc.2（GitHub main，pnpm install + build 通过，web dist 200 client artifacts） |
| medai-plugins | 9 插件源码 + 依赖（196 包，含 @modelcontextprotocol/sdk） |
| 生产 profile | `mcp-medai`（127.0.0.1:8081/mcp + exchangeToken 双因子 + 重连）+ `dsh-pii-guard` link 装配 |
| 单文件安装包 | `dsh-prod-install-20260824.run`（自解压）——TEST_MODE 安装 ✅（dump-config 524 行，mcp-medai 在位）；E2E systemd 启动验证进行中 |
| 启动方式 | **直接 `node --import tsx/esm apps/cli/src/bin.ts web`（绕过 pnpm）**——解包/离线目录下 pnpm 会触发 deps-check 重装（无 TTY+离线必失败），且 pnpm 内部 spawn node 取自 PATH（会命中系统 v18） |

> ⚠ **关键打包要求**：安装包内所有 tar 必须用 `-h`（解引用 symlink）——否则 node_modules/@medai 等链接解包后指向构建机路径变成断链（GNU tar 默认不跟随 symlink；构建机 boot 成功会掩盖此问题，必须做解包后 E2E 验证）。

## ✅ 每机 token（2026-08-24 已生成并落地）

| 项 | 值 |
|---|---|
| **明文 token** | `c09be4be13014eb094ffca1a`（DSH 机环境变量 `DSH_MACHINE_TOKEN` + `MEDAI_MCP_TOKEN` 均用它；勿提交代码库） |
| token-hash（SHA-256 小写 hex） | `456ad78681a640e45b6d82e531d43de9bb01470c2e91de2583c9550f8ed945e5` |
| 执行服务器注册 | `deploy/execution-linux/config/execution/application-execution.properties` → `medai.llmproxy.machines[0]`（token-hash + machine-id=dsh-prod-1043） |
| 主服务器注册 | `deploy/main-linux-oracle/config/application.properties` → `medai.mcp.tokens[3]`（token-hash + doctor-id=D001 + machine-id=dsh-prod-1043 + 心血管一病区） |

> 部署到生产时：把上述两个配置文件同步到服务器对应挂载卷 → 重启容器（执行服务器：`docker compose -p execution-prod up -d --force-recreate`；主服务器同理 `-p medai-main-prod`）→ 从 10.120.11.43 curl 验证 M3 端点 200 + SSE（见指南 §10.8 ④）。

## 交付包内容

| 路径 | 说明 |
|---|---|
| `deepseek-harness/` | DSH 源码 checkout **v0.1.1-rc.2**（含 node_modules，已 build） |
| `.dsh/` | **DSH_HOME 数据目录**（`profiles/web/` 生产配置 + `@medai` 插件链接已展开为真实文件） |
| `medai-plugins/` | medai 插件源码仓库（保留备用） |

## 生产机部署步骤（全程离线）

```sh
# ① 安装 Node 24（离线 tarball）与解包
mkdir -p /opt/node && tar -xJf node-v24.11.1-linux-x64.tar.xz -C /opt/node --strip-components=1
export PATH=/opt/node/bin:$PATH
node -v                                  # v24.11.1

# ② 解包交付包（root 执行，保证 /opt 与 /var 权限）
sudo mkdir -p /opt /var/lib/dsh
sudo tar -xzf dsh-prod-20260824.tar.gz -C /opt
#    → /opt/deepseek-harness + /opt/.dsh（把 .dsh 移动到 /var/lib/dsh）
sudo mv /opt/.dsh /var/lib/dsh

# ③ 每机 token（LLM 与 MCP 各一；与执行服务器/主服务器注册的哈希对应）
export DSH_MACHINE_TOKEN=<M3 代理 token>
export MEDAI_MCP_TOKEN=<MCP 网关 token>

# ④ 启动自检（零网络）
cd /opt/deepseek-harness
sudo -E env PATH=$PATH DSH_HOME=/var/lib/dsh \
  node /opt/node/lib/node_modules/pnpm/bin/pnpm.cjs dsh web --dump-config > /tmp/dsh-tree.txt
grep -c "mcp-medai" /tmp/dsh-tree.txt    # ≥1 即 MCP 接线生效

# ⑤ 创建预置工作区目录
sudo mkdir -p /opt/medai-dsh-workspace && sudo chown -R dsh:dsh /opt/medai-dsh-workspace

# ⑥ systemd 守护（unit 文件：scripts/dsh-prod/systemd/dsh.service）
sudo cp /path/to/dsh.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now dsh
sleep 15 && journalctl -u dsh -n 20 --no-pager

# ⑦ Headless 全链路验证（无 GUI，走 API）
curl -sf http://127.0.0.1:3080 >/dev/null && echo WEB-OK
node /opt/medai-dsh-workspace/../verify-prod-headless.mjs http://127.0.0.1:3080/api 120000
#   PASS = LLM→M3 代理→DeepSeek 链路通；FAIL 则查 journalctl + 执行服务器 M3 端点
```

## 前置条件（生产侧已确认/待执行）

- [x] 主服务器 = 10.120.11.43（同机，MCP 走 127.0.0.1:8081）
- [x] 构建机 100.66.1.4：Node 24.11.1 + pnpm 11.23.0 + DSH v0.1.1-rc.2 构建通过
- [ ] 执行服务器 `medai.llmproxy.machines[]` 注册 token 哈希（指南 §10.8）+ 重启容器
- [ ] 主服务器 MCP 网关注册 MEDAI_MCP_TOKEN 哈希（M2 通道）
- [ ] 防火墙：10.120.11.43 出向 → 10.120.10.251:8082
- [ ] 浏览器访问：内网 `http://10.120.11.43:3080`（如需跨机访问，webserver host 改绑内网 IP + `--trusted-host`）

## 生产 profile 已含配置（/var/lib/dsh/profiles/web/）

- `cordis.patch.yml`：webserver(127.0.0.1:3080) + `mcp-medai`（127.0.0.1:8081/mcp，exchangeToken 双因子 + 重连）+ `dsh-pii-guard`
- `package.json`：`@medai/dsh-mcp-client` + `@medai/dsh-pii-guard` link 装配（已展开为真实文件）
- 待生产机补充：`settings.yaml`（llm-deepseek baseURL=执行服务器 M3 代理 + agent-default-model），见指南 §10.4
