---
name: testserver-pull-deploy
description: 测试服务器（100.66.1.4）一键「拉取最新代码 → 构建 → 部署 → 验证」：服务器本地 git pull、服务器端 Maven/npm 构建、容器替换与健康检查、失败回滚。当用户要求在测试服务器上部署最新代码、验证某功能在测试服务器的实际效果、或说"拉最新代码重新部署/构建部署到测试服"时使用。
---

# 测试服务器：拉取最新代码 → 构建 → 部署（一键）

> 本技能与 `testserver-deploy`（开发模式/Docker 模式启动调试）**互补**：
> 那份偏"环境与调试"，本份是**端到端部署流水线**，且**修正了其中过时的容器名**。
> 脚本内建的验证与坑位判据来自 2026-10-01 的实测教训。

## 服务器速查（实测字段，勿用记忆）

| 项 | 值 |
|---|---|
| SSH 别名 | `testserver`（100.66.1.4） |
| 工作区（源码） | `/home/liuzh2008/public/med_ai_assistant_workspace/`（`公共` 与 `public` 是同一目录） |
| 后端源码 | `{工作区}/med_ai_assistant_1.0_bs_backend`（git 仓库，origin=GitHub SSH） |
| 前端源码 | `{工作区}/med_ai_assistant_1.0_bs_vue`（git 仓库，origin=GitHub SSH） |
| 前端部署目录 | `/home/liuzh2008/medai/frontend-deploy-test`（**`dist` 属主为 root → 需 sudo**） |
| 后端容器 | **`med-ai-main`**（⚠️ 非 `med-ai-main-server`），jar 在 `/app/app.jar`（镜像内，挂载不含 `/app` 本身） |
| 前端容器 | **`med-ai-assistant-frontend`**（⚠️ 非 `med-ai-frontend`），端口 8080/8443 |
| 访问地址 | 前端 `http://100.66.1.4:8080`，后端 `http://100.66.1.4:8081` |
| 构建环境 | JDK **21.0.12.1** / Maven **3.8.7** / Node **v22.23.2** / npm 10.9.8 / 16 核 / 内存 available ≈9.5Gi / 磁盘 ≈417G |
| GitHub 连通 | ✅ 直连可达（`github:22 OPEN`、HTTPS 200、`git ls-remote` ≈0.88s） |
| Maven 依赖源 | ✅ Maven Central 直连 200（有 19 处 mirror 配置 + 208M 缓存） |

**构建耗时实测**：后端全量 **25s**、增量离线（`-o`）**1.5s**；前端 `npm run build` 约 1~3 分钟（node_modules 660M 已就绪）。

---

## 一、前置条件（**最常被忽略**）

1. **本地必须先 push 到 GitHub**。服务器是 `git pull --ff-only`，**本地未 push 的提交服务器拉不到**。
   - 检查是否有未推送提交：`git -C <repo> log --oneline origin/<branch>..HEAD`
   - 推送用 `/git-push-github` 技能（aTrust 环境下有专用 KEX 配置）。
2. `sudo -n` 免密可用（部署前端 `dist` 与 docker 命令需要；实测可用）。
3. 服务器上**不要有会阻塞 ff-only 的本地改动**；若有，脚本会报 `git pull failed` 并原样输出日志。

---

## 二、一键用法

```powershell
# 1) 把脚本送上服务器（本地已置于技能 scripts/，纯 ASCII，避免编码破坏）
scp ".dsh\skills\testserver-pull-deploy\scripts\testserver-pull-deploy.sh" testserver:/tmp/ts-pull-deploy.sh

# 2) 执行（三选一）
ssh testserver "bash /tmp/ts-pull-deploy.sh backend"    # 只后端
ssh testserver "bash /tmp/ts-pull-deploy.sh frontend"   # 只前端
ssh testserver "bash /tmp/ts-pull-deploy.sh all"        # 前后端

# 3) 长耗时任务建议后台跑并抓日志（前端构建分钟级）
ssh -o ServerAliveInterval=30 testserver "bash /tmp/ts-pull-deploy.sh all 2>&1 | tee /tmp/deploy-$(date +%H%M).log"
```

**可覆盖的环境变量**：`WORKSPACE`、`ROLLBACK`（默认 `/home/liuzh2008/medai/rollback-<时间戳>`）、`LOG_DIR`（默认 `/tmp/medai-deploy-logs`）。

> 脚本**退出码 0/1** 表示全部成功/有失败；结尾打印 `SUMMARY (ok=N fail=M)` 与回滚目录路径。

---

## 三、脚本做什么（每步都带验证）

| 阶段 | 后端 | 前端 |
|---|---|---|
| **pull** | `git pull --ff-only`，打印 `origin`、before/after commit | 同左 |
| **build** | `mvn -B -DskipTests -Dmaven.test.skip=true package` → 取 `target/*.jar`（排除 `.original`） | `npm run build` → 打包 `dist` → 打印 `app.<hash>.js` |
| **deploy** | 备份容器内 `app.jar` → `docker cp` 替换 → `docker restart`（60~90s） | 备份旧 `dist` → 替换 `dist` → `docker build` → `docker run`（**沿用容器现有网络**） |
| **verify** | 轮询至 `(healthy)` → `curl /api/ai/health/ping` 必须 **200**；失败打印容器末 15 行日志 | 轮询至 `(healthy)` → `curl /` 必须 **200** → **页面引用的 `app.<hash>.js` 必须等于本次构建产物** |
| **rollback** | `$ROLLBACK/app.jar.bak` | `$ROLLBACK/dist.bak` |

**回滚**：把对应 `.bak` 复制回原位再重启即可（后端 `docker cp` + `restart`；前端替换 `dist` 后 `docker build` + `docker run`）。

---

## 四、关键坑位与判据（**每条都是实测踩出来的**）

### 1. 本地没 push = 服务器拉不到（最高频）
服务器拉的是 GitHub 上的代码。**本地"已 commit"不等于"服务器能拿到"**——必须 push。

### 2. 通过 PowerShell 调 SSH：一律用「脚本文件 scp 上去执行」
在 `ssh "..."` 里写 `$(...)`、`$var`、嵌套引号、中文字面量，会被**本地 PowerShell 先解析**，症状五花八门：
`seq 不是 cmdlet`、`未预期的记号 "("`、`Unterminated quoted string`、`Variable reference is not valid`，甚至**含中文的脚本在远端 bash 报"寻找匹配的 `"` 时遇到未预期的 EOF"**（中文被编码转换破坏，引号被撑坏）。
→ **本技能脚本为纯 ASCII（注释与输出全英文）、LF 行尾**，正是为此。

### 3. `compose` 网段冲突（部署前端必踩）
`frontend-deploy-test/docker-compose.yml` 里 `subnet: ${DOCKER_SUBNET:-172.20.0.0/16}`，而 `172.20.0.0/16` **已被现有网络占用**（`med_ai_assistant_10_bs_vue_med-ai-network`），`docker compose up --force-recreate` 会报
`failed to create network ... Pool overlaps with other one on this address space`。
→ 脚本改用 **`docker run` 并 `--network "$(docker inspect <容器> --format '{{.HostConfig.NetworkMode}}')"` 沿用现有网络**，规避冲突；如需改用 compose，可加 `.env` 设 `DOCKER_SUBNET=172.22.0.0/16`（实测空闲）。

### 4. 前端 `dist` 属主是 root
`/home/liuzh2008/medai/frontend-deploy-test/dist` 及其内容属 **root**，`rm/tar/docker build` 必须走 `sudo`（`liuzh2008` 在 sudo 组且免密）。脚本已统一处理。

### 5. ⚠️ 新代码依赖带 `@ConditionalOnProperty` 的 Bean → 应用可能起不来
2026-10-01 真实事故：新 Controller 注入的 Bean 带 `@ConditionalOnProperty(medai.mcp.enabled=true)`，而测试服务器**未启用 MCP** → Bean 不存在 → **整个 Spring 上下文启动失败**（容器停在 `health: starting`）。
→ **部署后必须验证容器到 `(healthy)` 且健康端点 200**（脚本已内建）；若失败，先看容器日志里的 `UnsatisfiedDependencyException`。

### 6. 判据（别被假信号骗到）
- **`BUILD SUCCESS` ≠ 测试跑过**：`-Dtest=X` 无匹配时也 SUCCESS，必须看 `Tests run:` 行。
- **401 ≠ 端点存在**：Spring Security 对**未匹配路径**同样返回 401；判断端点是否存在要用**对照路径**或直接查产物（如 `strings app.jar | grep consultation/`）。
- **前端部署成功要看 assets 哈希**：页面引用的 `app.<hash>.js` 必须等于本次构建产物，否则可能仍是旧镜像。

### 7. 后端部署窗口
`docker restart med-ai-main` 会中断服务 **60~90s**（entrypoint 会等 Redis/Oracle 就绪）。建议避开使用时段；正式环境请走 CI（`trigger-release-build` / auto-deploy）而非本脚本。

---

## 五、与其它技能的关系

| 技能 | 分工 |
|---|---|
| `testserver-deploy` | 开发模式(9080/9081/9082)启动调试、Docker 模式容器运维；**容器名以其为准会过时，以本技能表为准** |
| `git-push-github` | 推送代码到 GitHub（本技能的**前置步骤**） |
| `check-test-dev-servers` / `check-test-docker-servers` | 只做**状态与版本核对**，不改动环境 |
| `trigger-release-build` | 官方发布链路（tag → Actions → medai-builds → auto-deploy），生产/测试正式发版用 |
| `sync-devpc-code` | 另一台机器（100.66.1.1 devpc）的代码同步，与本技能无关 |

---

## 六、快速验收清单（部署后自检）

- [ ] 后端：`docker ps --filter name=med-ai-main` 显示 `(healthy)`
- [ ] 后端：`curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8081/api/ai/health/ping` → `200`
- [ ] 前端：`curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/` → `200`
- [ ] 前端：页面 `app.<hash>.js` 与 `dist/js/app.<hash>.js` 一致
- [ ] 业务：登录后访问目标页面/接口（如 `POST /api/consultation/patients/search` 应 200，无 JWT 应 401）
- [ ] 回滚资料已生成：`$ROLLBACK/{app.jar.bak,dist.bak}`
- [ ] 容器名核对：用的是 `med-ai-main` / `med-ai-assistant-frontend`（不是 `*-server` / `med-ai-frontend`）
