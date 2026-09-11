# DSH 服务器化多租户平台架构方案

> 状态：方案讨论稿 v1.4（2026-09-11，**100.66.1.4 容器限容完成 + 1–2 人场景容量判定更新**：该机可用内存 3.8→8.9 GiB、swap 归零，DSH 侧 1–2 人实测需求仅 **0.83 GiB**，定位由"仅 Linux 形态验证"升为"**可正式承载 1–2 人**"；同日实例收敛 8→2 并加 systemd `MemoryMax=2G`。v1.3（2026-09-07，grill-with-docs 审查修复：MedAi /api/auth/* 后端缺失漂移、启动产物 bin.js、§4.6.3 与 §5 容量口径矛盾、§7 编号错位；v1.2 规模收敛；v1.1 硬件实测）
> 关联：doc/DSH生产部署指南.md（单实例 3080 部署，本方案是其"多用户服务器化"演进）
> 决策输入：复用 MedAi 账号体系；**近期按几十人收敛（30-50 账号 / 10-30 并发），1000+ 账号 / 150+ 并发为远期目标（生产承载机待定）**；试点主环境=本机 Windows（63.8GB，2026-09-07 定），100.66.1.4=Linux 形态验证；生产 MedAi 10.120.11.43（7.3GB VM）配套 DSH 仅 1-3 人
> **2026-09-11 追加**：100.66.1.4 的目标场景明确为 **1–2 人接入** —— 该机完成容器限容后可正式承载（实测 DSH 侧仅需 0.83 GiB，见 §4.6.3），不再局限于"形态验证"。
> 硬件实测：本机 3081 实例内存、100.66.1.4（SSH）、生产 VM 配置采集，见 §4.6.1

---

## 1. 背景与目标

### 1.1 动因

在用户机上安装/维护 DSH 的运维成本随用户数线性恶化（Node 运行时、代码、依赖、配置、升级、杀毒白名单、故障处理 × 每台机器），1000+ 用户规模下不可行。必须改为**服务器集中部署**：用户零安装、浏览器访问、服务器统一运维升级。

### 1.2 目标（验收口径）

1. 用户机零安装、零维护、零运行负担（浏览器为唯一客户端）。
2. 不同用户拥有各自独立的对话记录，互不可见、互不可续接。
3. 用户身份复用 MedAi 账号（工号 + 密码登录），不重建账号体系。
4. 近期规模：**30-50 注册账号、高峰 10-30 并发**（单机即可）；架构预留 **1000+ 账号 / 150+ 并发**的分片扩展（远期，生产承载机待定）。
5. 医疗合规：用户间数据/会话/用量隔离；审计留痕；日志无 PII。
6. 运维收敛到服务器端（本机 Windows 试点主环境 + 100.66.1.4 Linux 形态验证 → 生产承载机待定），升级一次全量生效。
7. 模型出口统一走 MedAi llmproxy（每用户独立 token → per-user 配额与审计），用户不填任何 API Key。

### 1.3 非目标（本期不做）

- 不做 DSH 官方无的"进程内会话级多租户核心改造"（workspace 加 owner 等深层 fork 手术），隔离靠进程 + 目录物理边界。
- 不做用户机 DSH 的自动远程分发/收编（阶段 3 单独评估迁移）。
- 不做多科室数据共享策略（预留元数据，见 §8 打开问题）。

---

## 2. 已核实事实基线（2026-09-07 代码级核实）

### 2.1 DSH 侧

| 事实 | 出处/依据 | 影响 |
|---|---|---|
| `DSH_HOME` 是环境变量可覆盖的 | 本机 3080(`~/.dsh`)/3081(`~/.dsh-dev`) 双实例即此机制 | **每用户一个 DSH_HOME = 物理隔离** |
| 会话/配置/凭据/技能全部锚定在 DSH_HOME | `~/.dsh*/sessions/<workspace-key>/<uuid>/session.jsonl.zstd` 等 | 每用户数据自包含 |
| DSH 会话模型**无 user/owner 维度** | session 系 13 个包 grep 无 userId/ownerId | 不做进程内多用户核心改造 |
| webserver 无 TLS/认证/origin 策略；host 仅 `127.0.0.1`/`0.0.0.0` | docs/subsystems/web-server.zh.md | 认证/安全在网关层补 |
| 支持 `--trusted-host <host>` 白名单远程访问 | 本机 3080/3081 启动参数 | 网关改写 Host 后可访问特权接口 |
| 进程内支持多 workspace（注册表 + 会话账本） | packages/workspace：`WorkspaceRegistry.list()`、会话按 cwd 归属 | 单用户多工作目录 OK；但**不做跨用户共享进程** |
| 权限预设默认 `danger-full-access`；sandbox 在 Linux 有 landlock，**Windows 无内核沙箱** | docs/subsystems/permission-presets.md、sandbox.md | Windows 阶段不做进程内多租户，agent 全权限但进程边界隔离 |
| 消息通道 = HTTP + WebSocket(upgrade) + SSE（四象限） | packages/host/webserver、apiproxy | 网关必须转发 upgrade 与流式 |
| DSH 前端把 API 基址硬编码 `location.origin + "/api/..."` | dsh-hub 调研（社区踩坑） | 路径形态是原型验证点（§7.4） |
| **npm 0.1.2-rc.1 web 首启带 bootstrap token**：无 token 访问返回 401，URL 带 `?token=…` 才进入引导（2026-09-07 100.66.1.4 实测） | 双实例首启日志 + HTTP 401 复验 | 新实例首次访问有引导门槛：**多用户自动开户需处理首次引导**（网关代管 token/预置 settings 或首次访问转发） |

### 2.2 MedAi 侧

| 事实 | 出处/依据 | 影响 |
|---|---|---|
| 登录 `POST /api/users/login`（body `{id,password}`）→ `LoginResponse{token(JWT), userId, name, username, departments[], defaultDepartmentId, roles[], permissions[]}` | AuthService.java / UserController.java | 网关服务端转发登录，拿 JWT + 用户信息 |
| JWT = HS256 对称密钥（`JwtProperties.secret`），claims `sub=userId, name, username` | JwtTokenService.java | **网关不得持有 secret**（持密可伪造任意用户）；验真走 MedAi 自身 |
| 会话校验 `GET /api/auth/me`（Bearer，`JwtAuthenticationFilter` 全局保护） | 前端 api/auth.js 定义了 `/auth/me`、`/auth/logout`、`/auth/refresh`，但 **Java 后端无任何 `/api/auth/*` 实现（2026-09-07 grill 复核 ❌）** | 验真端点**缺失**：网关验真需 MedAi 侧新增该端点（前端契约已存在，最小改动）或暂用受保护只读接口（见 §4.1 步骤 4 修订）；**列为阶段 0 前置改动** |
| `isActive` 停用标志、RBAC（roles/科室范围）、科室/专业组 | model/User、service/rbac | 白名单门禁 + 科室元数据 |
| 模型出口 `DshLlmProxyController`（llmproxy）：每机 token 鉴权 + 配额 + 脱敏 + 审计；token 注册表为**多 token 哈希列表**（token→machineId） | llmproxy/config、ProxyTokenAuthenticator | **每用户实例配独立 token = per-user 配额/审计** |
| **llmproxy 实际启用方 = 执行服务器（execution, 8082）**，端点 `POST /api/dsh-llm/chat/completions`（OpenAI 兼容）；main(8081) 的 `medai.llmproxy.enabled` 未启用 | 源码 `@RequestMapping("/api/dsh-llm")` + application-execution.properties（2026-09-07 实测）；配置挂载于 execution 容器 `/app/config/application-execution.properties` | **方案原文"main 8081"为隐含错误假设，已修正**：DSH provider baseURL = `http://<exec-host>:8082/api/dsh-llm`；加每用户 token = 在该 properties 增 `medai.llmproxy.machines[N].token-hash`（明文 SHA-256）+ 重启 execution 容器——**MedAi 侧前置运维动作**（明文 token 由运维生成持有） |
| 主/执行服务器共享同一 JWT 密钥 | 前端 request.js 注释 | 与网关无关（网关不验签） |

### 2.3 社区参考（已克隆核实）

- AnkoCD/dsh-server-deployment：Linux systemd 每用户实例 + OS 账号隔离 + 回环网关 + iptables 租户隔离 + sudo 降权文件助手（安全细节最全，MIT，中文）。**借鉴其网关/隔离设计**。
- mill413/dsh-server-manager：Docker 单容器多进程用户池 + FastAPI 网关 + admin（自述不可生产，MIT）。
- slywalker2006/dsh-passwords：单实例多租户权限网关（GPL-3.0），方向不同（进程内多租户），不采用，参考其登录/限流/审计实现手法。
- kirbylynx/dsh-hub：出站隧道中心（不同拓扑，不采用）。

---

## 3. 总体架构

**形态：MedAi SSO 接入网关 + 多节点分片 + 每片"用户实例池"（按需启停进程）**

```
                        浏览器（医生/护士，零安装）
                              │ https(内网)/http
                              ▼
        ┌──────────────── 接入层：DSH 门户网关 ────────────────┐
        │  ① MedAi SSO：服务端转发 /api/users/login            │
        │  ② 验真：JWT → 服务端调 /api/auth/me（MedAi 自验签）  │
        │  ③ 网关会话：HttpOnly Cookie(sessionId) 绑定 userId   │
        │  ④ RBAC 门禁：角色白名单 → 是否允许使用 DSH          │
        │  ⑤ 路由：userId → 一致性哈希 → shard → 实例(或启动)   │
        │  ⑥ 反代：Host 改写 127.0.0.1:31xx + WS/SSE 升级转发    │
        │  ⑦ 审计：userId/时间/动作（无 PII）                   │
        └──────────────┬───────────────────────────────┘
                       │ 控制面
        ┌──────────────▼───────────────────────────────┐
        │ 控制层：注册表 + 实例池 supervisor（每 shard） │
        │  开户=建目录｜按需启动｜空闲回收｜并发上限     │
        └──────────────┬───────────────────────────────┘
     shard 1（承载机待定）    shard 2（未来加机器）
   ┌───────────────────┐    ┌───────────────────┐
   │ 用户A 实例:3101    │    │ 用户X 实例:3101    │
   │ 用户B 实例:3102    │    │ 用户Y 实例:3102    │
   │ 用户C(空闲=停止)   │    │ …池上限 N 进程     │
   │ DSH_HOME 各自独立  │    │ 代码共享只读       │
   └───────────────────┘    └───────────────────┘
         │ llmproxy token 每用户独立（→ MedAi 配额/审计）
         ▼
   MedAi 后端（登录/me/业务接口 + llmproxy + MCP 网关）
```

### 3.1 三层职责

| 层 | 组件 | 职责 |
|---|---|---|
| 接入层 | 门户网关（Node，自研，仿 AnkoCD server.js） | SSO/会话/RBAC/路由/反代/审计。对外唯一端口，全局限流 |
| 控制层 | 注册表 + 池 supervisor（每 shard 一个） | 用户目录 provisioning、实例启停/回收、并发上限、健康检查、状态上报 |
| 数据层 | 每用户 DSH_HOME + workspace 目录 | 会话/配置/凭据/技能按用户物理隔离；共享只读代码树 |

### 3.2 数据布局（Linux 正式形态示意）

```
/srv/dsh-platform/
├── code/                     # 共享 DSH 代码 + 依赖（只读，root 所有，无 group/other 写位）
│   └── deepseek-harness/     # custom/medai fork checkout
├── gateway/                  # 网关代码 + 状态（users 注册表、secret、审计日志）
├── users/<uid>/              # 每用户一个目录（0700）
│   ├── dsh-home/             # DSH_HOME（settings/credentials/profiles/sessions/skills…）
│   └── workspace/            # 该用户工作区（agent 锚点）
└── backups/                  # 定时备份（users/ + gateway/）
```

Windows 开发形态：`D:\dsh-users\<uid>\` 同构（dsh-home + workspace），进程宿主为 Windows 服务/watchdog。

---

## 4. 关键环节设计

### 4.1 身份认证（MedAi SSO 接入）

**原则：网关不持有 MedAi JWT secret、不自己验签；MedAi JWT 不落入浏览器（防 XSS）；密码只经服务端转发。**

流程：
1. 用户访问门户 → 网关登录页（或经 MedAi 主站单点入口跳转，见 §8 打开问题）。
2. 表单提交工号+密码 → 网关**服务端** POST MedAi `/api/users/login`。
3. MedAi 返回 JWT + user 信息（userId/name/username/departments/roles/permissions）。密码错误/停用由 MedAi 判定（isActive 校验在 AuthService 内）。
4. 网关以该 JWT 服务端调用 MedAi 的**验真端点**：首选 MedAi **新增 `GET /api/auth/me`**（前端契约已定义、后端未实现——阶段 0 前置改动，仅需一个返回 userId/name/username/departments 的轻量受保护端点）；兜底暂用现有受保护只读接口（如 `GET /api/users/{id}`，注意其返回 `User` 实体——**响应不得回传浏览器或落盘**，防 passwordHash 泄露）。MedAi 的 `JwtAuthenticationFilter` 负责验签（白名单外路径均拦截，`/api/users/login`、`/api/users/*/departments` 等已放行）；401/403 = 无效。**只有 MedAi 确认过的人才建网关会话**。
5. 网关签发自管 sessionId（随机、HttpOnly、Secure、SameSite=Lax，SQLite 持久化绑定 userId），**JWT 即弃**（不回浏览器、不落网关盘——如确需缓存只存内存短时）。
6. 会话 TTL：默认 12h；每次访问可低频回查验真端点（同步骤 4 前置条件；或按 JWT exp 做硬上限），账号停用/改密 → MedAi 侧 JWT 失效 → 网关会话随之失效。
7. RBAC 门禁：`roles` 走白名单（如哪些角色允许用 DSH）；`departments` 登记为元数据（阶段 3 科室策略用）。
8. 审计：登录成功/失败、会话建立/销毁、路由目标，只记 userId + 时间 + 动作；限流（IP + 账号两级）仿 dsh-passwords。

**为什么不在 DSH 内加认证**：DSH webserver 无认证是刻意的（官方回环模型），认证层放网关，DSH 实例只对回环可见（Host 围栏 + 网关改写），改动最小且隔离清晰。

### 4.2 用户实例池（本方案核心，替代"每用户常驻进程"）

**1000 账号的成本 = 1000 个目录；进程数只跟并发走。**

| 事件 | 动作 |
|---|---|
| 首次登录（provision） | 建 `users/<uid>/`（dsh-home + workspace），从模板写 settings（模型 provider → MedAi llmproxy + 该用户独立 token）、复制 profile 骨架；**不启进程** |
| 用户开始使用 | 网关路由发现实例未起 → supervisor 启动 `DSH_HOME=<…> node <code>/apps/cli/lib/bin.js web --port 31xx --trusted-host 127.0.0.1`（等价 `dsh web`；**启动产物实测为 lib/bin.js**，非 bin.mjs）→ 实例上报 ready → 反代接通。冷启动期返回"启动中"页/自动重试 |
| 活动结束/空闲 | 30 分钟无活动 → supervisor 停止进程（数据已持久化在目录，重启即恢复会话列表） |
| 池容量 | 每节点并发实例上限 N（本机试点 16-32；按 §4.6 实测调）；达到上限时按 LRU 逐出空闲实例腾位；全部活跃则排队/告警 |
| 停用 | MedAi isActive=0 传导 + 管理接口停实例；删号保留归档或清理（策略待定） |
| 预热（可选） | 按作息表预启动高频用户（如查房高峰前）；"最近 8h 活跃"用户保持在线 |

**为何可行**：DSH 的算力开销集中在会话活跃期（LLM 流、上下文、子 agent）；空闲实例近乎零 CPU 但仍占内存 → 池化回收内存，机器按并发买。单用户多个标签页/会话 = 同一实例内多会话（受 §7 验证项约束）。

**为何不用进程内多租户**：Windows 无内核沙箱，同进程跨用户文件越界无法物理根除；医疗 PII 下进程+目录三层隔离（进程/DIR+token）叙事清晰、核心零改动、官方升级免冲突。代价是单机并发上限受进程数限制 → 用**分片**扩展解决（§4.6）。

### 4.3 路由与反代（接入层关键件）

- 每用户实例端口 3101+ 随机分配并登记（`127.0.0.1` 回环，不对外）。
- 网关按 URL/会话映射到目标 `127.0.0.1:31xx`，代理时**改写 Host 为回环**并剥离浏览器信任标记（AnkoCD 验证的"回环特权接口修复"——否则 DSH 特权接口拒绝非白名单 Host）。
- 必须支持：HTTP 请求转发、**WebSocket upgrade**、SSE 流式（DSH GUI 四象限消息通道）。直接用 AnkoCD 的零依赖实现或 `http-proxy` 级库，不自研协议。
- 路径形态（原型验证项 §7.4）：A) 每用户子路径 `/u/<uid>/*`（若 DSH 前端 origin 硬编码不可行则放弃）；B) 每用户独立子域/端口映射（dsh-hub 确认可行但需要通配子域）。倾向 B 兜底。
- 客户端会话与实例会话的关联：用户浏览器 Cookie(sessionId) → 网关 → 目标实例；**实例自身无认证**，但仅回环 + 仅网关可达（Linux 用 iptables 或容器网络封死直连，Windows 阶段接受已知限制见 §4.5）。

### 4.4 数据与备份

- 每用户 DSH_HOME 内：settings.yaml（模板注入模型 provider）、.credentials.yaml（该用户 llmproxy token，0600）、sessions/（该用户全部对话记录 JSONL.zstd）、profiles/、skills/（共享只读技能可符号链接进用户 home 或全局）。
- 备份：定时对 `users/` + `gateway/` 做快照/rsync/tar → `backups/`；Linux 下也可每用户绑定 volume 由 Docker 卷备份。会话为 append-only JSONL → 支持增量备份。
- 升级：替换共享 `code/` → 重启各实例（或池内滚动重启）；用户数据目录不动，会话完整保留。
- 磁盘估算按 §4.6.2 公式；会话/附件保留策略待阶段 0 出数后定。

### 4.5 隔离与安全

| 面 | 措施 |
|---|---|
| 会话/对话记录 | 每用户 DSH_HOME 物理分目录（A 的进程读不到 B 的目录——进程以服务账号运行且目录 0700 属主隔离，Linux 下可 runuser 每用户 OS 账号升级为 AnkoCD 级隔离） |
| 模型用量 | 每用户独立 llmproxy token → MedAi 侧 per-user 配额/审计（token 哈希存储） |
| 凭据 | 用户目录 0600/0700；网关与代码树分离；代码树只读（**共享可写点 = 跨租户注入点**，AnkoCD 教训） |
| 网络 | 实例仅回环；Linux 用 iptables 回环租户隔离（防 agent 伪造 Host 直连他人端口，AnkoCD 已实现）；Windows 开发期**接受为已知限制**（实例全回环 + 网关单入口 + agent 上下文不含他人端口 + 审计），正式在 Linux 补全 |
| 认证 | 网关 SSO + 限流 + 锁定；日志无 PII（userId 级别） |
| agent 能力 | 会话内 danger-full-access（DSH 原义）只作用于**该用户自己的实例**，跨用户无路径可及 |

威胁模型边界：本方案防"用户间数据/会话/用量越权"，不防"用户对自己实例的 agent 完全授权"（那是 DSH 的用途本身）。

### 4.6 容量模型与扩展（近期几十人单机 / 远期 1000+ 分片）

#### 4.6.1 实测锚点（2026-09-07 本机 + 100.66.1.4 + 生产 VM 实测）

| 锚点 | 实测值 | 说明 |
|---|---|---|
| DSH web 主进程内存（本机 3081 dev 实例） | **WS 403MB / Private 466MB** | 含 dev 插件链、tsx 源码运行、注入器；是**上界**参考 |
| node wrapper 附加 | +~104MB | pnpm 启动层，生产直跑 bin 可省 |
| 会话磁盘（压缩 JSONL.zstd，本机） | 普通会话数百 KB~数 MB；重度开发会话 6~14MB | 医疗文书会话预计偏小；现 3 工作区共 265MB/137 文件 |
| 本机（Windows，试点主环境） | **63.8GB 内存（可用 43.9GB）**，i7-14700KF 20 核/28 线程，D 盘余 76GB | 同时常驻 Oracle ~6.7GB、MedAi 后端 8081 ~1GB、3080/3081 DSH |
| 100.66.1.4（1–2 人正式承载，**2026-09-11 限容后复测**） | 联想小新 Pro 14：i5-13500H / 16GiB（**可用 8.9GiB**）/ NVMe 余 366GB | **LPDDR5 板载焊接不可扩内存**；swap 4GB **已归零**；7 容器实际占 ~4.5GB、**上限合计 8.0GiB（全部设限，6 个禁容器 swap）**；DSH 2 实例（含网关）实测 **384MiB**，systemd `MemoryMax=2G` |
| 生产 VM（10.120.11.43，配套 MedAi 生产） | **7.3GiB（可用 ~6.1GiB）**，8 vCPU（Core 2 Duo T7700 虚拟化，无 AVX），KVM | DSH 需求仅 **1-3 人**：4×0.35+3×0.15+0.5 ≈ **2.4GB，够用** |

> ⚠️ 每活跃会话增量 S 仍是**阶段 0 必测项**（§7.2）；**实例基线 B 已实测**：npm 官方版 0.1.2-rc.1 干净实例（无 dev 插件链）RSS ≈ **297MB**（2026-09-07 100.66.1.4 实测，两实例并行稳定）——低于原估算 350MB，容量测算可按 B≈300MB 重算（池上限可放大 ~15%）；dev 版 403-466MB 为含插件链上界参考。
> **2026-09-11 复测**：8 实例并行（u1–u8）时每实例 RSS **169–175MB（均值 ≈173MB）**、网关 53MB，与"冷态 ~170MB"吻合 —— **1–2 人场景按 B≈170MB 计更贴近实际**（比 §4.6.3 表中所取 350MB 保守下限低一半）。
> 注：锚点表内存取系统报告原值（本机 Windows 报 GB、Linux/生产报 GiB，1GiB≈1.074GB），量级差异不影响测算结论。

#### 4.6.2 估算公式

```
单机内存需求 ≈ 池上限 N × 实例基线 B + 峰值活跃会话数 × 每会话增量 S + 系统余量 20%
磁盘需求   ≈ Σ(每用户会话数 × 单会话均值) + 附件 + 备份(建议 ≥1:1)
CPU        ≈ 8-16 核/机足够（推理在 MedAi llmproxy/DeepSeek 侧；本机只做工具执行/流式转发/subagent 并发）
网络       ≈ 内网 1Gbps 足够（GUI 流量小、长连接多）
```

内存是瓶颈。**近期几十人（30-50 账号 / 10-30 并发）单机即可**；远期单机池 150 × 350MB 光基线 ≈ 52GB → **150+ 并发必须分片**（§4.6.5）。

#### 4.6.3 分环境测算（B 取下限 350MB、S 取 150MB 计）

| 环境 | 池/并发 | 内存估算 | 建议配置 |
|---|---|---|---|
| 本机 Windows（试点主环境） | 池 16-32，~30 活跃 | ≈ **10~16GB**（池 16 取 16×0.35+30×0.15≈10GB；池 32 取 ≈16GB） | 现成：可用 43.9GB，池开到 60-80 做压测也够；数据放 D 盘 |
| **100.66.1.4（1–2 人正式承载，2026-09-11 更新）** | **池 2 / 活跃 2** | 2×0.17 + 2×0.15 + 网关 0.05 ≈ **0.69GB**（含 20% 余量 ≈ **0.83GB**） | 容器限容已完成（2026-09-11）：可用内存 **8.9GB**、swap 0B、DSH 2 实例实测 384MB；**1–2 人绰绰有余**；池 16/活跃 10–15 亦可（≈5.1GB）；**几十人试点仍不可行**（30 并发 ≈11.6GB 超可用） |
| 生产 MedAi 10.120.11.43（1-3 人） | 池 4-6，~3 活跃 | 4×0.35 + 3×0.15 + 网关 0.5 ≈ **2.4GB** | 7.3GB VM（可用 6.1GB）够用；CPU 老但低负载无碍 |
| 远期 150+ 并发（生产承载机待定） | 每 shard 池 50-80、50-80 活跃 | 每 shard ≈ **25-40GB**（50 池+50 活跃≈25GB；80+80≈40GB） | 2×(64GB + 16 核 + 1TB NVMe) 起步；加 shard 即扩 |
| 磁盘（远期 1000 账号） | 全量会话 + 备份 | 留存策略定后按公式（§4.4） | 备份区独立，NVMe 必须（session zstd 高频追加写） |

#### 4.6.4 容量结论

1. **预算按"池上限 × 实例基线"买内存**，不按注册用户数；优化实例基线（干净 profile、去 dev 链）可直接放大池上限 ~40%。
2. **试点主环境 = 本机 Windows**（资源现成、MedAi 后端 127.0.0.1:8081 同机、联调链路最短）；**100.66.1.4（Linux）在 1–2 人场景下可直接正式承载** —— 2026-09-11 完成容器限容后可用内存 3.8→8.9 GiB、swap 归零，DSH 实测仅 384 MiB（2 实例 + 网关），已具备产品级运行条件；该机仍不适合几十人试点（30 并发 ≈11.6 GiB 超可用）。
3. 生产 MedAi 10.120.11.43 配套 DSH 仅 1-3 人 → 7.3GB VM 够用（约 2.4GB），与 MedAi 服务同机部署时注意端口/目录隔离；**几十人规模的正式生产承载机待定**（远期 1000+ 一并规划）。
4. 磁盘：NVMe 必须；会话量按 §4.4 留存策略出数，备份 ≥1:1。
5. MedAi 侧 llmproxy 配额同步：每用户 token 即配额单元；超限仅影响该用户。

#### 4.6.5 水平扩展（远期启用，近期单机不需）

`userId 一致性哈希 → shard`；每 shard 一台（或一台多实例负载均衡）**达标服务器**（64GB+/16 核级）；网关持有 shard 路由表，实例注册表按 shard 分片存储；新增 shard 只需网关路由表热更新 + 存量用户按哈希重映射（可分批迁移）。网关/池/数据布局从第一天按此可迁移设计，避免远期重构。

### 4.7 运维与可观测

- Windows：网关 + supervisor 以服务/计划任务常驻（复用现成 watchdog 模式）；实例子进程由 supervisor 管理。
- Linux：网关 systemd 或容器；池内实例进程或 on-demand 用户容器（试点二选一实测，倾向容器 + iptables）。
- 管理页：用户列表（状态/端口/内存/最近活动/停用开关）、池容量视图、审计查询、手动启停。
- 自愈：实例崩溃 → supervisor 拉起（会话数据持久化无损）；网关崩溃 → watchdog。
- 升级与回滚演练、备份恢复演练纳入阶段 2。

---

## 5. 双环境落地矩阵

| | 本机 Windows（试点主环境） | Linux 100.66.1.4（形态验证） |
|---|---|---|
| 网关 | Node 进程（任务计划+watchdog） | 同代码容器（compose） |
| 池宿主 | 池 supervisor 直接拉子进程 | 容器内进程 or 每用户 on-demand 容器（实测选型） |
| 网络隔离 | 无 iptables → 回环 + 单入口（已知限制） | iptables 回环租户隔离 / 容器网络 |
| 数据 | `D:\dsh-users\<uid>\` | `/srv/dsh-platform/users/<uid>/` 或每用户 volume |
| 并发池 | 16-32（可用内存允许开到 60-80 压测） | **池 2（1–2 人正式承载，2026-09-11 收敛 8→2）**；实测 2 实例 384 MiB；池 16/活跃 10–15 亦可（≈5.1GB） |
| 用途 | 阶段 0 原型 + 阶段 1 几十人试点主力 | **1–2 人正式承载机**（2026-09-11 起）+ Linux 部署样板；已完成：容器全量限容（med-ai-main 1536m / execution 2G / 前端 128m 等，可用 3.8→8.9 GiB）、DSH 实例收敛 8→2、systemd `MemoryMax=2G` 安全网 |

---

## 6. 分阶段实施路线

### 阶段 0 · 原型验证（Windows 本机，先行）
目标：实测 §7 全部未知数，产出资源测算表与形态选型结论。
交付：3 个手工用户目录 + 最小池（启停）+ MedAi SSO 网关（登录代理 + Cookie + 反代 + WS）+ 2 用户联调（各自会话隔离、双 llmproxy token 分账、冷启动耗时、空闲内存）。

**✅ 阶段 0-Linux 原型已完成（2026-09-07，100.66.1.4 实测）**：
- 双用户实例（u1=3101/u2=3102）独立 DSH_HOME 常驻；**实例基线 RSS ≈ 163-297MB**（干净 npm 版，冷态 ~170MB）
- MedAi SSO 网关 v0.2（:3200）登录代理 + 会话 + 实例引导代管 + 按用户路由透传；测试账号 **1657(刘朝晖)→u1、0001(Administrator)→u2**
- **浏览器实测：两账号工作区与会话完全隔离**；目录证据：各自 sessions/<独立workspace-key>/session.jsonl.zstd，交叉包含 0
- llmproxy 每用户 token（dsh-u1/u2）已注册且经**代码缺陷修复**（WebSecurityConfig 白名单缺 /api/dsh-llm/**）后鉴权 200
- 网关/代码：DSH-custom/gateway-prototype/（本地备份）；问题档案：med_ai_assistant_1.0_bs_backend/doc/问题修复/2026-09-07-llmproxy每机token401-白名单缺dsh-llm路径修复.md

**✅ 阶段 0-Linux 承载能力复核（2026-09-11，容器限容 + 实例收敛）**：
- **容器全量限容**：7 容器由"显式 12GiB 限额 + 4 个完全无上限"改为**全部设限、合计 ≈8.0GiB**（main 1536m / execution 2G / redis 256m / 两个前端各 128m / medteach 1G / oracle 3G；除 oracle 外均 `memswap_limit=mem_limit` 禁用容器 swap）—— **可用内存 3.8→8.9 GiB，swap 由 99.98% 归零**
- **DSH 实例收敛 8→2**：`gateway/config.json` 的 `instances`/`userMap` 仅保留 u1(1657 刘朝晖)/u2(0001 Administrator)，移除 u3–u8（账号 20001/10102/1119/1201/1418/1592）；**平台内存 1.40GiB → 384MiB**；`users/u3..u8` 数据目录原样保留（各约 2.1MB）备查
- **内存安全网**：新增 systemd drop-in `/etc/systemd/system/dsh-platform.service.d/memlimit.conf`（`MemoryMax=2G`、`MemorySwapMax=0`）—— 防止 DSH 侧失控反过来触发整机 OOM
- **实测基线更新**：2 实例 + 网关 = **384MiB**（空闲态 169–175MB/实例），1–2 人场景按 B≈170MB 计
- **连带事故（已处置）**：该机 2026-09-11 22:33 发生 **global OOM**（整机 15.3GiB 下容器限额超卖 + 当日在服务器端执行的 2GB 堆前端构建），22:35:49 起失联、22:58:50 强制重启，DSH 8 实例随重启由 systemd 自动拉起；根因与处置详见 `doc/服务器环境/`（部署与故障处置全记录 / 死机排查报告 / 容器资源限制方案）

### 阶段 1 · 本机试点（Windows，几十人收敛）
交付：supervisor 池正式化（开户/启停/回收/审计/管理页）+ watchdog 常驻；用户 provisioning 自动化（MedAi 账号同步或首登开户）；3-5 真实用户试用（池 16-32）；**100.66.1.4 已具备 1–2 人正式承载条件（2026-09-11 限容完成，见阶段 0-Linux 复核），可并行承接真实 1–2 人使用**；其余 Linux 形态验证项（iptables 租户隔离 / 容器化池宿主，§7.5）继续推进。

### 阶段 2 · 几十人正式 + 生产承载机落定
交付：按阶段 0/1 实测数据定稿生产规格（本方案 §4.6.4 结论 3 的"几十人正式承载机"）；生产部署（候选：达标 Linux 机/本机过渡）；llmproxy 配额治理对接；压测与故障演练。

### 阶段 3 · 远期 1000+ 账号（生产承载机待定，预留设计）
交付：分片路由启用（§4.6.5）；存量用户机数据迁移/收编评估；科室策略（预留元数据启用）；运维手册与值班流程；SLO 监控告警。

---

## 7. 未知数与原型验证清单（阶段 0 必须实测，禁止拍脑袋）

### 7.1 单实例 idle 内存与冷启动耗时（决定池上限与预热/等待页策略）。

### 7.2 单实例并发会话承载上限（一个用户多标签/多会话稳定性和内存增量）。

### 7.3 网关 WS/SSE 长连接转发稳定性（全量 GUI 流量过网关）。

### 7.4 路径形态：每用户子路径 vs 独立子域/端口映射（DSH 前端 `location.origin + /api` 硬编码的兼容性实测）。

### 7.5 双环境池宿主（Linux 容器内进程 vs on-demand 容器）的运维成本实测对比。

### 7.6 MedAi llmproxy 多 token 并存（2026-09-07 已实测一半）：出口确认为 **execution server 8082 `/api/dsh-llm/chat/completions`**（main 8081 未启用）；每用户 token = 在 execution 挂载的 `application-execution.properties` 增 `medai.llmproxy.machines[N]`（明文 SHA-256 哈希）+ 重启容器。待确认：token 新增/轮换的运维化路径（避免每次重启）与多 token 配额语义。

### 7.7 `--trusted-host 127.0.0.1` + 网关 Host 改写后，settings/credentials/agentPreset 特权接口可用性（AnkoCD 已证，本 fork 版本复验）。

---

## 8. 打开问题

1. 入口形态：医生从 MedAi 主站（Vue）加一个"AI 助手"入口跳转门户（带一次性 ticket），还是门户独立登录页？涉及 MedAi 前端改造范围。
2. 每用户 workspace 语义：医生是否需要"工作目录 + 共享只读知识库/技能"的结构（agent 数据访问面与医疗流程对齐）。
3. 会话保留/归档策略与磁盘规划（合规保留期）。
4. 删号/离院账号的数据处置流程。
5. MedAi 侧是否增加"每用户 llmproxy 配额"配置化治理（当前每机配额是否够用）。
6. **MedAi 验真端点缺失（阶段 0 前置）**：前端 `/auth/me`、`/auth/logout`、`/auth/refresh` 契约已存在而后端无实现；网关验真需 MedAi 新增受保护轻量 `GET /api/auth/me`（返回 userId/name/username/departments 等，不回传哈希），见 §2.2 / §4.1 修订。

---

## 附：参考

- 本项目 DSH fork：`liuzh2008/deepseek-harness` branch `custom/medai`（DSH-custom/patches 档案，基线 47f943859b）
- AnkoCD/dsh-server-deployment（MIT）：网关/隔离/回环防护设计蓝本
- mill413/dsh-server-manager（MIT）：容器化用户池参考
- slywalker2006/dsh-passwords（GPL-3.0）：登录/限流/审计实现参考
- sandbaseai/deepseek-harness-handbook：DSH 架构手册（ACP/MCP 多租户边界）
