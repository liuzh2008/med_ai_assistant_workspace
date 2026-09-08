# dsh-gateway-prototype（阶段 0-Linux 原型网关 → 阶段 1 试点基线）

MedAi SSO 登录代理 → HttpOnly 会话 → 按用户路由到对应 DSH 实例（单 origin 透传）。

## 版本

- **v0.4（当前）**：CONFIG 外置 `gateway.config.json`（instances/userMap 配置化，provision 改写即扩容）；配套 `provision-user.sh` 开户自动化。
- v0.3：会话 + 实例 cookie 同步持久化到 `state.json`（600）——网关重启不丢登录态、免重新引导实例（实测：重启后旧 cookie 直接 200）。
- v0.2：实例引导代管（登录后服务端完成实例 bootstrap、注入 dsh-auth cookie）；AJAX 登录页。
- v0.1：登录代理 + 会话 + 路由透传骨架。

## 批量开户与常驻（阶段 1 实测，2026-09-08）

```bash
# 批量开户：list 文件每行一个 userId（# 注释）；自动 key=u<N>；注册不重启，最后统一 sync+验证
bash /srv/dsh-platform/gateway/batch-provision.sh <list-file>

# 平台服务管理（systemd 托管，开机自启）
sudo cp dsh-platform.service /etc/systemd/system/ && sudo systemctl daemon-reload
sudo systemctl enable --now dsh-platform.service
/srv/dsh-platform/bin/dsh-platform.sh {start|stop|status}   # 手动管理（前台监督模式）
```

实测：5 账号批量开户（10102→u4、1119→u5、1201→u6、1418→u7、1592→u8）+ 原 u1-u3 = **8 用户全通**。测试库账号密码哈希已升级 argon2（`temp/upgrade_users_hash_123456.sql`，密码 123456，备份表 `USERS_BAK_20260908`）。

> 实例被 systemd/监督拉起后 bootstrap token 轮换——`dsh-platform.sh` 会自动刷新 `state/<key>.token` 并清网关 instAuth（网关下次转发自动重引导），无需手工干预。

## 单户开户（provision-user.sh）

```bash
# 服务器（100.66.1.4）：一个命令开户 → 自动完成 目录/端口/llmproxy token 注册/实例启动/settings/bootstrap token/网关配置
bash /srv/dsh-platform/gateway/provision-user.sh <MedAi-userId> <key> [port]
# 例：
bash /srv/dsh-platform/gateway/provision-user.sh 20001 u3        # 端口自动分配（自 3103 起）
bash /srv/dsh-platform/gateway/provision-user.sh 1658 u4 3110    # 指定端口
```

脚本流程：建 DSH_HOME/workspace → 分配端口 → 注册 llmproxy machine（`openssl rand` 明文 + sha256 追加 execution `application-execution.properties`，重启 execution ~60s）→ 实例启动（env 注入 token）→ 写 settings.yaml（medai-llmproxy provider）→ bootstrap token 落盘 `state/<key>.token` → 更新 `gateway.config.json` + 重启网关。

> 注意：注册新用户会重启 execution 容器（~60s 模型不可用）——批量开户可分批或后续改为"注册不重启、统一重启"模式。

### ⚠️ 配置漂移自愈（必读）

`application-execution.properties` 被 git 跟踪（服务器 deploy 目录随代码库 pull 同步）——**未提交的 machines 注册会被 git pull/reset 还原**（2026-09-08 实测发生：u1/u2 注册丢失致 token 401）。对策：

```bash
# 以 .llmproxy-tokens 为权威源补全缺失的 machines 注册 + 重启 execution + 验证
bash /srv/dsh-platform/gateway/sync-machines.sh          # 补全并重启
bash /srv/dsh-platform/gateway/sync-machines.sh --check  # 只检查
```

建议：每次服务器代码 pull/升级后、或发现 token 401 时先跑 sync-machines.sh。长期方案：把每环境 machines 注册移出 git 跟踪文件（env 注入/独立配置），见方案 §7.6 待办。

## 架构语义

```
浏览器 → :3200（网关，唯一对外口）
  GET/POST /login        → 网关自营（MedAi SSO 代理）
  其余任意路径（含 WS）   → cookie(dshgw) 会话 → userMap[userId] → 127.0.0.1:31xx 透传
                            （Host 改写回环；同一 origin 规避 DSH 前端 /api 硬编码子路径问题）
```

## 关键设计（与方案文档对应）

- 网关不持 MedAi JWT secret；登录后调 MedAi 受保护端点验真（当前 GET /api/users/{id}，body 丢弃防 passwordHash 泄露；正式换 /api/auth/me，见方案 §8-6）。
- 实例仅回环 127.0.0.1；浏览器不能直连 31xx。
- 透传时改写 Host、剥离 origin/sec-fetch 头（DSH 回环特权接口 + Host 围栏要求）。
- **v0.2 实例引导代管**：登录成功后网关服务端 GET `/?token=<bootstrap>`（token 从 `/srv/dsh-platform/state/<key>.token` 读，由 provision 落盘）捕获实例签发的 `dsh-auth-*` cookie 存内存，转发时注入——浏览器只登录一次，实例侧授权全由网关持有。实例重启后 token 轮换 → 需更新 state 文件重新引导。
- **v0.3 状态持久化**：`state.json`（默认 `/srv/dsh-platform/gateway/state.json`，0600）同步保存 sessions 与 instAuth；启动时加载（`state restored: sessions=N instAuth=N`）。重启后浏览器登录态与实例授权均不丢。

## 运行

```bash
npm install           # http-proxy
GW_PORT=3200 MEDAI_BASE=http://127.0.0.1:8081/api node gateway.js
```

## 当前联调状态（2026-09-07）

- userMap 已填：`1657(刘朝晖) -> u1(3101)`、`0001(Administrator) -> u2(3102)`（MedAi 测试库账号）
- E2E 验证：两账号登录 → 302 → GET / 200（各自实例 GUI）；错密码 401
- bootstrap token 落盘：`/srv/dsh-platform/state/u1.token`、`u2.token`（600）

## 已知限制（原型）

- 会话/实例 cookie 内存存储（进程重启即失；实例 cookie 可通过重新引导恢复，需 state token 仍有效——实例本身 30 天有效期内 token 不变）
- 登录失败形态：MedAi 返回 400（账号/密码错或停用）与 500 均视为失败
- 无 CSRF（原型内网）；正式加双提交校验（方案 §4.1）
- bootstrap token 每次实例重启轮换（以 logs/u1.log 最新为准，需同步 state 文件）
