---
trigger: manual
description: "本机连不上测试服务器 100.66.1.4 时按序执行的排查速查（四步 + 四个必知陷阱）"
---

## 本机连不上测试服务器（100.66.1.4）排查速查

**何时用**：本机访问 `100.66.1.4`（或组网内其它 `100.66.1.x`）的 SSH / 8080 / 8081 / 8082 失败时，**按顺序走完四步**；每步都以给出的判据下结论，**不要用 ping 判断通不通**。
**来源**：2026-09-11 事故档案 `med_ai_assistant_1.0_bs_backend/doc/问题修复/2026-09-11-本机节点小宝GUI开机崩溃导致测试服务器组网中断修复.md`

### 第 0 步：先分清三个网络（30 秒）

| 网络 | 载体 | 覆盖 | 与 100.66.1.x 的关系 |
|---|---|---|---|
| 深信服 aTrust（零信任） | 网卡「本地连接」 | `2.0.0.0/24` | **无关**（不承载组网；但它会捣乱，见陷阱③） |
| **节点小宝 NodeBabyLink** | 网卡 `NodeBabyLink` | 组网 `100.66.1.x` | **唯一通道** |
| 外网穿透 | `nb.nblink.cc:16619` | SSH 入口 | 组网不通时的备用入口 |

### 第 1 步：GUI 进程在不在（最高频根因）

```powershell
Get-Process nblink                       # 不存在 = 组网必然断
Start-Process 'C:\Program Files (x86)\nblink\nblink.exe' -ArgumentList '--cmd=autorun'
Get-Content 'C:\Users\Administrator\.dsh\fix-nblink-vip.log' -Encoding Unicode -Tail 6
```

- **`NodeBabyLinkService` 是 Running ≠ 组网可用**：服务自启 ≠ GUI 自启，**组网路由由 GUI 登录后才下发**（2026-09-11 教训：服务 17:31 就绪，GUI 崩溃导致直到 20:14 都不通）。
- 本机已有 watchdog（任务 `DSH-Fix-NBLink-VIP`：登录后延迟 2 分钟 + 每 3 分钟）会自动拉起；日志出现 `backing off (crash loop guard)` 表示 20 分钟内崩了 3 次，需人工介入。

### 第 2 步：看组网路由表（唯一权威判据）

```powershell
curl http://127.0.0.1:2080/tun/routers     # states 为空 = 出站不可用
curl http://127.0.0.1:16880/glp/peerlist   # QLCallee=入站 / QLCaller=出站
Get-NetRoute -AddressFamily IPv4 | Where-Object { $_.DestinationPrefix -like '100.66*' }
```

- 正常形态：`100.66.1.1~8/32` 由客户端**自动**下发（**metric 326**）。
- 缺路由时**不要手工加**：`New-NetRoute ... 100.66.1.4/32` 无任何实际作用（原因见陷阱①）。

### 第 3 步：四个必知陷阱（别被骗）

1. **ICMP/TCP「通」是隧道客户端代答**：手工加路由后 ping 会 Reply（<1ms TTL=64）、端口显示 OPEN；但同网段**未使用**地址 `10.222.222.30` 同样 Reply、`10.222.222.2~30` 全端口假 OPEN（HTTP 毫秒级失败）。删掉路由立刻超时 → **两种状态都到不了服务**。
2. **`peerinfo -2006「not existed」≠ 设备离线**：它只表示当前无 P2P 直连记录（对正在访问本机的 peer 查询同样 -2006）。**在线判据用 `/tun/routers` 与 `/glp/peerlist`**。
3. **aTrust 在未连接状态下 WFP 仍会间歇拦截** 100.66.1.x 的 TCP：报错形态 `WSAECONNABORTED` / `aborted by the software in your host machine`（区别于远端 RST）。对照复测：`Stop-Service aTrustService -Force` → 复测 → **务必 `Start-Service aTrustService` 恢复**。
4. **banner 对照法**：TCP 连上后**只读不写**，真实 sshd 必主动吐 `SSH-2.0-...`；若连一个**不存在**的地址也得到同样的「无 banner 直接 EOF」，即为代答。本机对照：`10.222.222.1:22`（本机 sshd，有 banner）。

### 第 4 步：确认恢复（用真实业务响应，别用 ping）

```powershell
ssh -o ConnectTimeout=8 testserver "hostname"
curl -m 8 http://100.66.1.4:8082/api/execute/health
curl -m 8 http://100.66.1.4:8080/
```

- 恢复标志：`/tun/routers` 非空 + 路由表出现 metric 326 的 `100.66.1.4/32`。
- **入站可用 ≠ 出站可用**：外部 peer 能连入本机（`100.66.1.3:3081/8085`）时，本机仍可能连不出去——别用「别人能连我」推断「我能连别人」。
