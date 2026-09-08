# DSH 服务器化多租户平台——实施总结（2026-09-07/08）

> 状态：阶段 0（原型验证）与阶段 1（8 用户试点）已完成并稳定运行；扩容推迟至正式部署阶段。
> 关联详细文档：
> - 架构方案：doc/整体方案/DSH服务器化多租户平台架构方案.md（v1.3）
> - 服务器配置：doc/整体方案/DSH平台服务器配置方案.md（台式机采购，部署时启用）
> - 网关代码：DSH-custom/gateway-prototype/（README 含全部脚本用法）
> - 问题档案：med_ai_assistant_1.0_bs_backend/doc/问题修复/2026-09-07-llmproxy每机token401-白名单缺dsh-llm路径修复.md、2026-09-08-llmproxy响应格式不兼容DSH-SSE手动流式修复.md

---

## 1. 背景与目标

- **动因**：DSH（DeepSeek Harness）原为用户机安装形态，1000+ 用户机安装/维护不可行 → 改为**服务器集中部署**（浏览器唯一客户端）。
- **目标**：用户零安装；不同用户各自独立对话记录；身份复用 MedAi 账号；模型出口统一走 MedAi llmproxy。
- **规模决策（用户拍板）**：近期几十人收敛（30-50 账号 / 10-30 并发）；1000+ 账号 / 150+ 并发为远期（生产承载机待定，分片预留）；**测试环境不扩容，扩容在正式部署阶段处理**。
- **部署矩阵（实测核定）**：100.66.1.4 = 测试/试点（联想小新笔记本 16G 板载不可扩，8 用户上限）；本机 63.8GB Windows = 试点主环境备选；生产 MedAi 10.120.11.43（7.3GB VM）配套 DSH 仅 1-3 人；新台式机（配置方案已定稿）＝ 正式承载机（部署时采购/装机）。

## 2. 架构（已落地形态）

```
浏览器 → http://100.66.1.4:3200（网关，systemd 常驻，唯一入口）
  ├─ 1657/0001/20001/10102/1119/1201/1418/1592（MedAi 账号登录）
  └─ 每账号路由到独立 DSH 实例（u1-u8，127.0.0.1:3101-3108，独立 DSH_HOME）
        └─ 模型出口 → llmproxy（每用户独立 token）→ DeepSeek
```

隔离三层：**进程（每用户独立 DSH 进程）+ 目录（独立 DSH_HOME）+ 网关路由**。会话按用户物理隔离（各自 `sessions/<独立workspace-key>/`）。

关键实现机制：
- DSH_HOME 环境变量覆盖（每用户 home，含 sessions/settings/credentials/profiles）
- 网关 v0.4：MedAi SSO 登录代理（服务端转发 `/api/users/login` → 验真 `/api/users/{id}` 状态码，JWT 不落盘）→ HttpOnly 会话（JSON 持久化）→ 按 userMap 路由 → **实例引导代管**（服务端完成 bootstrap、持实例 dsh-auth cookie、转发注入）→ 单 origin 透传（规避 DSH 前端 /api 硬编码子路径问题）
- DSH 0.1.2 bootstrap token 机制（无 token 401；`/?token=` → 303 + dsh-auth cookie 30 天）
- llmproxy：每用户 machine token（`medai.llmproxy.machines[N]`，明文 SHA-256 哈希存配置）

## 3. 实施完成清单

### 3.1 基础设施（100.66.1.4）
| 项 | 详情 |
|---|---|
| Node 22.23.2 | `/opt/node22`（软链 /usr/local/bin；系统 node18 未动） |
| DSH 0.1.2-rc.1 | npm 官方包，`dsh` = `lib/bin.js`（grill 修复验证） |
| 平台目录 | `/srv/dsh-platform/{code,gateway,users,state,logs,backups,bin}` |
| systemd | `dsh-platform.service`（enable 开机自启）+ `dsh-platform.sh`（监督循环 15s 拉起网关/实例） |

### 3.2 8 用户试点（阶段 1）
- 测试库 32 bcrypt 账号执行 `temp/upgrade_users_hash_123456.sql` 升级 argon2id（密码 123456，备份表 `SYSTEM.USERS_BAK_20260908`）
- 开户：provision-user.sh（单户）+ batch-provision.sh（批量，注册不重启最后统一 sync）
- **实例基线内存实测 ≈ 297MB**（npm 干净版）；8 实例 + 网关总占用 <1.5GB
- 浏览器实测：两账号工作区与会话完全隔离（目录证据：独立 workspace-key、交叉 0）

### 3.3 MedAi 侧修复（两个真实缺陷，均进正式发布链）
1. **0.9.294**：`WebSecurityConfig.PUBLIC_PATHS` 缺 `/api/dsh-llm/**` → 每机 token 被用户 JWT 过滤器拦截（401）→ 白名单加行修复。
2. **0.9.295**：`DshLlmProxyController` 硬编码 NDJSON 响应，DSH 0.1.2（stainless SDK，Accept: application/json）→ MVC collect 无 converter → 500 → **按 Accept 协商（x-ndjson→NDJSON / 其余→SSE）+ `flux.toIterable()` 手动逐块写**修复。
3. 附带环境修复：测试 execution `.env.execution` 原指向生产 Oracle（172.16.11.43/freepdb1 不可达）→ 改连本地测试库 `127.0.0.1:1521/XE`（**git pull 会还原，需重应用，勿提交**）。

### 3.4 部署教训（三坑，已入问题档案）
① bump 版本后 jar 名变化（0.9.294 产物名，勿再 scp 旧 293）——部署前 `ls target/*.jar` + md5 比对；② docker build COPY 层缓存偶发命中——确认 build 输出无 CACHED 或 `--no-cache`；③ 增量编译沿用旧 class——删 `target/classes` 对应 .class 强制重编。

## 4. 测试环境运行手册（100.66.1.4，liuzh2008）

```bash
# 服务管理（systemd 常驻）
sudo systemctl status dsh-platform          # 查看
/srv/dsh-platform/bin/dsh-platform.sh status # 网关+实例状态
sudo systemctl restart dsh-platform         # 重启全部

# 开户 / 批量开户
bash /srv/dsh-platform/gateway/provision-user.sh <MedAi-userId> <key> [port]
bash /srv/dsh-platform/gateway/batch-provision.sh <list-file>   # 每行一个 userId

# llmproxy 注册漂移自愈（git pull / token 401 后必跑）
bash /srv/dsh-platform/gateway/sync-machines.sh

# 关键路径
/srv/dsh-platform/logs/{gateway,u1..u8}.log   # 日志
/srv/dsh-platform/gateway/{gateway.config.json,state.json,.llmproxy-tokens}  # 配置/状态/token(600)
/srv/dsh-platform/state/<key>.token           # 实例 bootstrap token（实例重启后由 dsh-platform.sh 自动刷新）
/srv/dsh-platform/users/<key>/dsh-home        # 用户 DSH_HOME
```

试运行账号：8 个医生账号（密码 123456，测试库），登录入口 `http://100.66.1.4:3200`。20001 账号密码非 123（不可用）。

## 5. 已知边界与正式部署阶段待办

| 类别 | 事项 |
|---|---|
| 测试环境 | 内存 3.6GB 可用、8 实例上限（**不再扩容**）；execution 依赖本地 XE 库 |
| 安全加固（部署时） | iptables/容器网络租户隔离（Windows/测试阶段已知限制）；网关 CSRF/限流；实例 401 自动重引导（现为 dsh-platform 拉起时刷新） |
| MedAi 收尾 | `/api/auth/me` 验真端点（现用 /api/users/{id} 状态码兜底）；llmproxy machines 注册移出 git 跟踪文件；0.9.294/0.9.295 auto-deploy 闭环（安全窗口 02:30-03:30 或手动 DEPLOY_ALLOW_OUTSIDE_WINDOW=true） |
| 正式部署 | 新台式机装机（配置方案）；用户迁移；池化空闲回收；分片（§4.6.5，远期） |
| 运维 | 备份策略（每用户目录 + gateway 状态）；watchdog 已由 systemd 承担 |

## 6. 版本与发布状态

- backend：0.9.293 → **0.9.295**（三仓库已推送：backend f5b1f229→6c44233f、vue、root 0a3b3f8→c22ee8e）
- tag：v0.9.294、v0.9.295 已推送（GitHub Actions 构建 → medai-builds 发布 → auto-deploy）
- 网关/脚本：本地 DSH-custom/gateway-prototype/ 已入根仓库（v0.4）
- 测试环境 execution 镜像已手动重建运行修复版（连本地 XE）

## 7. 文档索引

| 文档 | 位置 |
|---|---|
| 架构方案 v1.3 | doc/整体方案/DSH服务器化多租户平台架构方案.md |
| 服务器配置方案 | doc/整体方案/DSH平台服务器配置方案.md |
| 本总结 | doc/整体方案/DSH服务器化多租户平台-实施总结.md |
| 网关 README | DSH-custom/gateway-prototype/README.md |
| 问题档案 1（白名单） | med_ai_assistant_1.0_bs_backend/doc/问题修复/2026-09-07-llmproxy每机token401-白名单缺dsh-llm路径修复.md |
| 问题档案 2（SSE） | med_ai_assistant_1.0_bs_backend/doc/问题修复/2026-09-08-llmproxy响应格式不兼容DSH-SSE手动流式修复.md |
| 记忆库 | 记忆库/（决策与设计 / 环境与配置 / 踩坑与教训 / 会话记忆） |
| 发布日志 | med_ai_assistant_1.0_bs_backend/doc/更新日志/2026-09-08.md、更新小结.md |
