# dsh-gateway-prototype（阶段 0-Linux 原型网关）

MedAi SSO 登录代理 → HttpOnly 会话 → 按用户路由到对应 DSH 实例（单 origin 透传）。

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
