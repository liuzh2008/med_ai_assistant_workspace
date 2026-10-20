---
name: aimedteach-deploy
description: AIMedTeach（AI医学教学系统）前后端在测试服务器 100.66.1.4 的部署与验证。前端 med-teach-frontend（8085，/root/docker/med-teach-frontend 生产路径）+ 后端 med-teach-backend（8083，/home/liuzh2008/medai/aimedteach/testServer）：构建、zip 打包、上传、一键部署脚本、健康检查全流程。当用户需要在 100.66.1.4 部署/升级 AIMedTeach 前端或后端、或部署报错排查时使用。
---

# AIMedTeach 测试服务器部署 Skill

> 目标：100.66.1.4（Ubuntu 24.04）。将"在 100.66.1.4 上部署 AIMedTeach 前后端"的完整链路沉淀于此，
> 避免反复试错。2026-09-01 已用前端 0.1.19 全流程验证通过。

## 服务器信息

| 项目 | 值 |
|------|-----|
| IP | 100.66.1.4 |
| SSH 用户 | `liuzh2008`（有 sudo，无密码 sudo -n ok） |
| SSH 别名 | `testserver` |
| 前端部署路径 | `/root/docker/med-teach-frontend`（**root 所有，需 sudo**） |
| 后端部署路径 | `/home/liuzh2008/medai/aimedteach/testServer`（liuzh2008 可写，无需 sudo） |
| 前端端口 | 8085（nginx → 80） |
| 后端端口 | 8083 |
| 主系统/执行服务器/Oracle | 8081 / 8082 / 1521（已运行，勿动） |

## 架构拓扑

```
medteach-frontend:8085 (nginx 容器)
  ├── /api/users/login, /api/voice/realtime, /api/teaching/cases → main-server:8081（主系统）
  └── /api/ 其余（SSE） → medteach-backend:8083（教学微服务，宿主机）
extra_hosts: main-server / medteach-backend → host-gateway
```

---

## 一、前端部署（med-teach-frontend）

### 1.1 构建（本机 Windows）

```powershell
# 前置：本地 Docker 可用、node:22-alpine / nginx:1.27-alpine 基础镜像已在
cmd /c "cd /d D:\MedAiAssistant 1.0 BS\AiMedTeach\med-teach-frontend && build-and-package-wuyiyuan.bat < nul"
```

- bat 末尾有 `pause`，**后台/自动化跑必须加 `< nul`**，否则挂起等待按键。
- 流程：npm install（增量，--prefer-offline）→ `tsc && vite build` → 复制 dist → docker build
  → docker save 到 `deploy/wuyiyuan/medteach-frontend.tar` → 调 `package-zip-wuyiyuan.ps1` 打 zip。
- **产物核对**：构建前先看 `deploy/wuyiyuan/version.txt` 与 `package.json` version 是否一致；
  不一致说明产物过期（本次就遇到 wuyiyuan 还是 0.1.15、代码已 0.1.19 的情况）。

### 1.2 打包 zip（bat 内自动执行）

`package-zip-wuyiyuan.ps1` 要点（**不要改回 Compress-Archive**）：
- 必须 UTF-8 **BOM**（PowerShell 5.1 按 ANSI 解析无 BOM 中文乱码）。
- 用 `tar -a -c -f`（bsdtar）打包：正斜杠 + 保留顶层目录 `med-teach-frontend/`。
- Compress-Archive 生成反斜杠 → Linux unzip 警告；.NET ZipFile 丢顶层目录。两者都不可用。
- 产物：`deploy/medteach-frontend.zip`，顶层目录必须是 `med-teach-frontend`。

### 1.3 上传（scp 到 /tmp 再 sudo cp）

```powershell
scp "AiMedTeach\med-teach-frontend\deploy\medteach-frontend.zip" liuzh2008@100.66.1.4:/tmp/
ssh testserver "sudo cp /tmp/medteach-frontend.zip /root/docker/ && sudo cp /tmp/deploy-from-package.sh /root/docker/ && sudo chmod +x /root/docker/deploy-from-package.sh"
```

- **`/root/docker` 属 root，liuzh2008 直接写会"权限不够"**：必须 scp 到 /tmp 后 sudo cp。

### 1.4 执行部署

```powershell
# 注意：cd /root/docker 必须在 sudo bash -c 内部！ssh "cd /root/docker && sudo ..." 会先以普通用户 cd → 权限不够
ssh testserver "sudo bash -c 'cd /root/docker && bash deploy-from-package.sh'"
```

`deploy-from-package.sh` 自动完成：校验 zip → unzip -o → cd med-teach-frontend →
校验 medteach-frontend.tar → 执行 `deploy-linux.sh`：
`docker rm -f medteach-frontend` → `docker rmi` 旧镜像 → `docker load` → `docker compose up -d --no-build`
→ 健康检查 `http://localhost:8085/`（15 次 × 3s）。

### 1.5 验证

```powershell
ssh testserver "sudo docker ps --format '{{.Names}} | {{.Image}} | {{.Status}}' | grep medteach"
ssh testserver "sudo cat /root/docker/med-teach-frontend/version.txt"   # 期望 0.1.x 最新
ssh testserver "curl -s -o /dev/null -w 'HTTP %{http_code}\n' http://localhost:8085/"
# 新资源抽查（hash 随构建变化，从 index.html 提取实际文件名）
ssh testserver "curl -s -o /dev/null -w 'HTTP %{http_code}\n' http://localhost:8085/assets/Login-<hash>.js"
ssh testserver "curl -s http://localhost:8085/ | head -15"
```

**链路语义（区分"链路通"与"业务失败"）**：
- 无 `X-AIMedTeach-Key` 调教学 API → **403** = Key 鉴权生效 ✓
- 带 Key 调不存在的 GET 映射 → **404** = Key 已通过、只是无该路由 ✓
- `/api/users/login` 空/坏 body → **400/500** = 代理到主系统正常，参数校验失败 ✓

---

## 二、后端部署（med-teach-backend）

### 2.1 构建（本机 Windows）

```powershell
cmd /c "cd /d D:\MedAiAssistant 1.0 BS\AiMedTeach\med-teach-backend && build-and-export-testserver.bat < nul"
```

- 流程：`mvn package -DskipTests` → CRLF→LF 归一（deploy/docker-entrypoint.sh + deploy.sh）
  → `docker build --build-arg APP_VERSION=<revision> -t medteach-backend:latest -f Dockerfile .`
  → `docker save` 到 `deploy/testServer/medteach-backend.tar`（~198MB）。
- **CRLF 踩坑**：Windows 检出的 shell 脚本若 CRLF 进镜像，entrypoint 报
  `env: $'bash\r': No such file or directory`（容器 Restarting 127）。bat 已内置 LF 归一 + `.gitattributes`（`*.sh text eol=lf`）。

### 2.2 上传

```powershell
scp -r AiMedTeach\med-teach-backend\deploy\testServer liuzh2008@100.66.1.4:/home/liuzh2008/medai/aimedteach/
```

### 2.3 执行部署

```powershell
ssh testserver "cd /home/liuzh2008/medai/aimedteach/testServer && chmod +x deploy.sh && ./deploy.sh"
```

`deploy.sh`：docker rm/rmi 旧容器镜像 → `docker load` tar → `docker compose -f docker-compose-medteach-image.yml --env-file .env up -d` → 健康检查 `http://localhost:8083/api/health`（30 次 × 5s）。

### 2.4 验证 + 数据库

```powershell
ssh testserver "curl -s http://localhost:8083/api/health"
ssh testserver "curl -H 'X-AIMedTeach-Key: aimedteach-dev-key-2026' http://100.66.1.4:8081/api/teaching/cases"
ssh testserver "sudo docker logs medteach-backend --tail 50"
```

- **表结构升级时**（教学表不在主系统 schema 自动创建）：
  `cat sql/init-teach-schema.sql | docker exec -i med-ai-oracle sqlplus -s system/Liuzh_123@//localhost:1521/XE`（幂等，表空可重建）。
- 测试环境 `.env` 关键项：`ORACLE_SERVER_ACTIVE=local`、`ORACLE_LOCAL_IP=100.66.1.4`、`ORACLE_LOCAL_SID=XE`、
  `ORACLE_LOCAL_PASSWORD=Liuzh_123`、`MAIN_SERVER_BASE_URL=http://100.66.1.4:8081`、
  `LLM_PROXY_BASE_URL=http://100.66.1.4:8082/...`、`HOSPITAL_DEFAULT_ID=testserver`、`TEACHING_CASE_API_KEY=aimedteach-dev-key-2026`。

---

## 三、常见问题速查（避免反复试错）

| 症状 | 原因 | 处理 |
|------|------|------|
| `cd: /root/docker: 权限不够` | cd 在 sudo 外执行 | `sudo bash -c 'cd /root/docker && bash deploy-from-package.sh'` |
| bat 挂起不结束 | 末尾 `pause` | 命令尾部加 `< nul` |
| zip 里 unzip 警告反斜杠 | Compress-Archive 打包 | 用 bsdtar（`tar -a -c -f`），保留顶层目录 |
| ps1 中文乱码 | 无 BOM UTF-8，PS 5.1 按 ANSI 解析 | 存 UTF-8 BOM |
| 容器 Restarting 127 | entrypoint CRLF | bat 已自动转 LF；手动改时用 `[IO.File]::WriteAllText($f,$s,[Text.UTF8Encoding]::new($false))` |
| 部署后页面 404/白屏 | nginx 挂载旧 default.conf | compose volume 挂 `./nginx.conf`；确认 zip 顶层目录为 `med-teach-frontend` |
| 教学 API 403 | Key 不匹配 | 前端 `.env.production` 的 `VITE_AIMEDTEACH_API_KEY` 须与后端 `TEACHING_CASE_API_KEY` 一致 |
| 版本号落后 | wuyiyuan/testServer 产物未重新构建 | 构建前核对 `version.txt` vs `package.json`/`pom.xml <revision>` |
| **部署后接口 500 / `ORA-00904`（无效标识符）** | 后端实体新增列，但测试库未升级表结构（教学表不会自动建） | 先跑对应幂等脚本再重启后端。已知：`deploy/testServer/sql/clinical/28-clinical_focus_lock_columns.sql`（`FOCUS_LOCK_PLAN` ×2 + `FOCUS_LOCK_SELECTIONS`）——0.9.264 起实体读写这些列，缺列会让**任意会话读写**报 ORA-00904 |
| **不确定 8085 该用哪个前端包（wuyiyuan / testServer）** | 两个包内容不同（wuyiyuan 定制包含 `hospital.jpg`） | `ssh testserver "sudo ls /root/docker/med-teach-frontend/dist/hospital.jpg"`：**存在 → 该机跑的是 wuyiyuan 包**，用 `build-and-package-wuyiyuan.bat` → `deploy/medteach-frontend.zip` → `deploy-from-package.sh` |
| **需要在远端执行含中文的 SQL** | ssh 命令行中文参数编码不可靠（PS 5.1 → ssh 会乱码） | 本地写好 `.sql`（UTF-8 无 BOM、LF）→ `scp` 到 `/tmp/x.sql` → `ssh testserver "sudo docker exec -i med-ai-oracle bash -lc 'NLS_LANG=AMERICAN_AMERICA.AL32UTF8 sqlplus -s system/Liuzh_123@//localhost:1521/XE' < /tmp/x.sql"` |
| **需要在远端 grep 中文文案** | 同上（中文参数走命令行会乱码） | 本地 `node -e "process.stdout.write(Buffer.from('中文片段','utf8').toString('base64'))"` → 远端 `echo -n <b64> \| base64 -d > /tmp/p.txt` → **进容器 grep**（见下一行，别 grep 宿主机 dist） |
| **文案/产物"是否上线"验证 grep 错了路径（假阳性，2026-10-16 实测）** | ① 宿主机 `/root/docker/med-teach-frontend/dist` 只是**随包副本**（宿主机 vite 构建），**线上静态文件在镜像内** `/usr/share/nginx/html`（镜像 builder 阶段在容器内 `npm run build`，两次构建产物 hash 甚至不同：实测宿主机 `DiagnosisPrepareView-DGrsZIq9.js`/`index-DohAgoAk.js` vs 容器 `-CeilfbPz.js`/`index-CG1dHXWD.js`）；② 宿主机 dist 因 `unzip -o` 只覆盖同名文件而**累积历史 chunk**（实测累积到 **879 文件 / 34 个 `DiagnosisPrepareView*`**），grep 必然命中旧文件 | ① 验证一律进容器：`printf '<片段>' > /tmp/p.txt && sudo docker cp /tmp/p.txt medteach-frontend:/tmp/p.txt && sudo docker exec medteach-frontend sh -c 'grep -rl -f /tmp/p.txt /usr/share/nginx/html/assets/'`；② 也可直接核对文件名是否为本次构建产物；③ `deploy-from-package.sh` 已加"解包前 `rm -rf $EXTRACT_DIR/dist`"避免宿主机副本累积（清完 879→64，与容器一致） |
| **构建"成功"但产物是旧镜像（假绿，高危）** | 本机 **Docker Desktop 未运行**时，`build-and-package-wuyiyuan.bat` / `build-and-export-testserver.bat` 里的 `docker build/save` 失败**不会终止脚本**：前端仍会把**上一次的 `medteach-frontend.tar`** 打进 zip，只在输出里留一行 `[ERROR] Docker image build failed`（本次实测：zip 时间 08:18 而 tar 仍是前一天 09:10，版本号却显示新值） | ① 构建前 `docker info --format '{{.ServerVersion}}'` 必须返回版本；未运行则 `Start-Process 'C:\Program Files\Docker\Docker\Docker Desktop.exe'`（实测 ~12s 就绪）；② 构建后核对 `deploy/*/medteach-*.tar` 的 **LastWriteTime** 与 `version.txt`/zip 是否同一分钟——tar 落后即假绿，必须重构建 |
| **部署后「重评难度 / 难度评估」返回 `{"reason":"LLM_FAILED"}`** | 执行服务器转发上游 LLM 失败（常见 `AI服务暂时不可用（错误码503）`），**环境侧问题**，非教学服务缺陷 | 查 `sudo docker logs med-ai-execution-server --since 10m 2>&1 \| tail -40` 找 `friendlyError=`；失败按设计**保留原值**（不影响资产数据），上游恢复后重试即可 |
| **改 Prompt 模板后要证明"库里那份真的被读到"** | 运行时模板来源是数据库，仓库文件改了不等于生效 | 执行模板脚本后，看后端日志 `Prompt模板获取成功: promptId=<新ID>, promptLength=<新长度>` + `渲染完成: originalLength=…`（本次实测 651→711 / 1306→1832，即升级生效的硬证据） |
| **判断「LLM 执行服务器 8082 是否可用」探针用错路径 → 误判服务已死（2026-10-16 实测，浪费约 30 分钟）** | 8082 容器的 healthcheck 用的是 **`/api/execute/health`**；而 **`GET /api/health` 在该服务上会挂起不响应**（`curl -m 20` 仍返回 `code=000`，但 TCP 已 accept），用它探测必然得出"端口在监听但服务半死"的错误结论 —— 实测正确路径 200 / 5ms，错误路径三种地址（127.0.0.1 / `[::1]` / 100.66.1.4）全超时 | 探针一律用：`curl -s -m 15 -o /dev/null -w '%{http_code}' http://127.0.0.1:8082/api/execute/health`（期望 `200` + `{"port":8082,"service":"MedAI Execution Server","status":"healthy"}`）。**另注**：容器显示 `Up N seconds` 即刚重启，启动期要同步 143 个 Prompt 模板（逐文件拉取）+ 临床规则，`8082` 未就绪期间教学后端调用会 `Connection refused`，此时生成资产 / 提交作答必失败 —— 先等 `/api/execute/health` 应答再操作（本机 Windows 无法直连 8082，探测要走 `ssh testserver`） |

## 四、版本记录

| 日期 | 版本 | 说明 |
|------|------|------|
| 2026-09-01 | 前端 0.1.19 / 后端 0.9.226 | 前后端均已在 100.66.1.4 部署验证通过：前端走 /root/docker 生产链路（bat→ps1→zip→deploy-from-package.sh），后端走 testServer（build-and-export-testserver.bat + deploy.sh）；健康检查 8085/8083 全绿 |
| 2026-10-11 | 前端 0.1.84 / 后端 0.9.288 | 「考核成绩单」功能部署验证通过（前端统计页新增成绩单区 + 后端 2 个 `/api/admin/training-stats/batches*` 端点）。**两点新增经验已入上表**：① 后端部署前先跑 28 号表结构脚本（本次实测缺列，跑完 3 列补齐、启动日志无 ORA）；② 确认 8085 = **wuyiyuan 包**（dist 含 `hospital.jpg`）。验证要点：容器 healthy + `version.txt` + 容器内 chunk 含新 API 路径 + 403/404 语义 + nginx 8085→8083 代理 |
| 2026-10-12 | 前端 0.1.112 / 后端 0.9.316 | 「思维训练统计」拆「考核 / 训练」双标签页（均左列表 + 右详情）部署验证通过，**纯前端改动、后端未动**（8083 保持 0.9.316 未重新部署）。全流程无新坑：`build-and-package-wuyiyuan.bat < nul` → `deploy/medteach-frontend.zip`（24.9MB，顶层目录 med-teach-frontend）→ scp `/tmp` → `sudo cp` 到 `/root/docker` → `sudo bash -c 'cd /root/docker && bash deploy-from-package.sh'`（健康检查第 2 次通过）。**新增一条可复用验证手段**：页面级 UI 改动除 curl 外，用 Playwright Core + 本机 Edge headless 做真实渲染验证（见 §1.5 末），本次实测两 tab 标签、两页 `.split-layout/.list-pane/.detail-pane` 各 1、场次列表 2 项、训练记录 4 条、点击记录后 `[data-test="training-detail"]` 出现 |
| 2026-10-12 | 前端 0.1.117 / 后端 0.9.321 | 「编排：人工纳入不可考资产」（知识竞赛受控豁免）前后端同部署通过。**本次实测的环境事实（重要）**：测试库 `CLINICAL_GENERATION_TASK` **只有 1 份资产（ID 702，`HARDER`，`EXAM_ELIGIBLE=1`）**，**无任何不可考资产** → 「纳入不可考」的真实场景**在测试服无法实测**（行为由后端 7 例 + 前端 5 例单测覆盖）。改用三层验证：① 版本/容器（`0.1.117` + health `0.9.321` + healthy）；② **字段级**：`POST /batches/bulk/preview` 响应出现新字段 `overriddenCount` / `allowedIneligibleTaskIds`，且白名单里「已可考的 702」「不存在的 99999」均被忽略（`overriddenCount=0`）；③ **幂等签名**：同一资产不带白名单 → `reused:true`（复用既有批次 4），带白名单 → `reused:false` 新建批次 5/场次 6，随后 `POST /batches/5/rollback` 回滚清理（`rolledBackBatchIds:[6]`）→ 证明"带/不带豁免是两次不同操作"。**开跑前先确认 8085 包类型**（`dist/hospital.jpg` 存在 = wuyiyuan 包）。 |
| 2026-10-14 | 前端 0.1.120 / 后端 0.9.321（未变） | 「开考 / 结束场次」按钮帮助键与帮助条目 + 「执行批量设定」把"未开考学员看不到该场次"提为醒目小节。**纯前端改动 → 按既有惯例不重新部署后端**（8083 保持 0.9.321）。**新增一条内容级验证手段（推荐）**：部署后用 `sudo grep -rl '<新文案片段>' /root/docker/med-teach-frontend/dist/assets/` 直接确认新文案/帮助键已进产物——比只 `curl` 首页更贴近"功能真的上了"；本次分别命中 `index-*.js`（帮助正文）与 `TrainingStats-*.js`（按钮 `data-help-key`）。**一个新坑**：帮助条目写在**模板字符串**（反引号）里时，正文中的 Markdown 反引号会提前结束字符串 → `vitest` 不加载 `help/entries/*` 故全量测试照常全绿，**只有 `npm run build`（tsc）会报 TS1005** → 改帮助文案后必须跑 build。 |
| 2026-10-15 | 前端 0.1.127 / 后端 0.9.331 | 「生成期必须产出必选诊断清单 + 考核档只显示必须选择的诊断」前后端同部署 + **测试库模板升级**。全链路一次通过（前端健康检查第 1 次、后端第 4 次）。**新增三条经验已入上表**：① 含中文的 SQL 走「scp 脚本 → docker exec sqlplus stdin」，中文 grep 走 base64 片段；② 后端上传**只传 tar + version.txt + deploy.sh + compose，不覆盖服务器 `.env``；③ 模板类改动必须用后端日志的 `promptId/promptLength` 作为"库里那份已生效"的硬证据（本次 651/1306 → 711/1832）。**环境限制与补测**：测试服执行服务器上游 LLM 当时稳定返回 503（`med-ai-execution-server` 日志 `friendlyError=AI服务暂时不可用（错误码503）`），两次 `reevaluate-difficulty` 均 `LLM_FAILED`（**按设计保留原值，702 仍 HARDER/可考，数据未坏**）；**当日 18:0x 上游恢复后已补测通过**：① 重评成功（`reevaluated:true, criticals=6`，走"清单可用直接落库"零回归路径）；② 考核档页面级实测通过（自建带 `FOCUS_FROM_CRITICALS` 的场次 → 会话 → 提交 cat-0-hyp → Playwright 实测 `.focus-radio`=2、`.is-disabled`=0，提示「只显示本例必须排查的方向」），`focus-lock.spec.mjs` 4/4 通过。**最小复现步骤已写入 §1.6**。仅"必选诊断补跑"分支未实测（测试库无清单为空/占位的资产，由 11 例单测覆盖）。 |

| 2026-10-16 | 前端 0.1.136 / 后端 0.9.340 | 代码审查整改（覆盖态短路补跑 / 考核档提示列完整必选方向 / 补跑 Prompt 防御）前后端同部署。**本次踩到并已入上表的高危坑**：本机 Docker Desktop 停着，首次构建"看似成功"（zip 打出、version.txt 是新值）但 tar 仍是前一天旧镜像 → 若不核对时间戳就会装进旧代码造成假绿；`Start-Process 'Docker Desktop.exe'` 约 12s 就绪后重建即正常。验证：`front_version=0.1.136` / `backend_health=0.9.340` / 容器 healthy / 新文案「暂无预生成深步标准」命中 `DiagnosisThinking-*.js` / 重评 702 返回 `reevaluated:true, criticals=6, reasonOverridden=false`（无多余补跑）。 |
| 2026-10-16 | 前端 0.1.143 / 后端 0.9.347 | 备课「一键自动生成」+ 推理链**每类候选上限 8** 前后端同部署 + **测试库模板升级**（`29-clinical_teaching_hypothesis_limit8.sql`：`教学-假设生成` LENGTH **200→386**、VERSION 1.1、`CONTENT_CHECK=OK`；运行期硬证据 `promptId=561, promptLength=396`）。全链路一次通过（前端健康第 2 次、后端第 4 次）。**真实端到端实测**：`auto-generate caseId=99050801343435_2` 诊断审查 **72s** → 自动建 `taskId=2` → COMPLETED `durationMs=1,195,514`（19.9 min；旧资产 702 为 1,310,967 ms / 21.9 min → **-8.8%**）→ 树 4 类**每类候选 8 / 深步组 8**（一一对应）、库内 STEP4 各类 ≤8、**硬兜底裁剪未触发**（模板软约束已被 LLM 遵从）、后端 0 ERROR。**新增可复用脚本** `med-teach-frontend/e2e/auto-generate-real.spec.mjs`（Node 内置 fetch + 轮询 + 树断言）。**踩坑记入**：curl 在 pwsh→ssh 链路下 JSON body 的引号会被吃掉（表现为 400 JSON parse error 或 403 假象）→ 真实环境 API 验证一律用 Node fetch。**新发现**：① `diagnoses` 会混入"检查所见类"条目（如"脂蛋白(a)升高""左室收缩功能正常低限"），全部注入后把每类候选顶到上限；② 跨类别同名候选被 `getFanOutItems` 全局去重，深步记录 93=31×3（既有行为，非本次引入）；③ 测试库 `教学-归类` 仍是 v1.0（135 字符）→ **14 号归类模板升级从未在测试库执行**；三个教学模板 VERSION 恒为 `2.9.1`（模板库同步机制所写，与仓库脚本语义化版本口径不同）。页面级验证（Playwright + 本机 Edge）：一键钮 `data-help-key` 命中、切诊疗链后钮消失、右键帮助命中新键标题、产物 grep 命中 `DiagnosisPrepareView-*.js`。 |
| 2026-10-16 | 前端 0.1.155（**纯前端改动，后端 8083 未重新部署**） | 诊断思维训练「提交并对比后回显学员本人作答」修复（深步 / 假设生成补齐回显块、全局步加原文兜底、`submitRealAnswer` 提交后回写 `polishedText`）。链路一次通过（健康检查第 2 次）。验证：`version.txt=0.1.155` + 容器内 grep 命中 `DiagnosisThinking-Dq7aCUaL.js`（新文案「我的候选诊断」）。**新增可复用验证手法（推荐给所有"作答/展示类 UI 改动"）**：① 用 **mock 演示模式** 验证 UI（`/clinical/diagnosis?demo=1`，不记成绩、**不依赖后端 LLM**，避免测试服 LLM 503 干扰）；② `addInitScript` 预置 `localStorage['teachingConstraints.sequentialAnswering']='false'` 与 `'teachingConstraints.restrictPanorama'='false'` → **解锁全部树节点可自由导航**，绕开"按序作答 + 全景受限"导致深步不可达的问题（否则 `lockedKeys` 会把非 activeKey 的未提交节点全部锁住，Playwright 走不到深步）；③ 逐节点断言 `.student-answer-section` / `.student-hyp-section` 文本含学员输入。本次三处回显（核心问题 / 假设生成 / 深步）全部命中。**两个新坑**：① `.el-select-dropdown__item` 会命中**隐藏的残留 popper**（页面存在多个 select）→ 必须先点 `.case-form .el-select__wrapper` 展开、再用 `.el-select-dropdown:visible .el-select-dropdown__item`；② bat 经 `cmd /c "... < nul"` + 管道执行时**退出码为 1 但实际成功**，判据是日志 `[SUCCESS]` 与 tar/zip 时间戳（本次 tar 15:58:16 与镜像 CreatedAt 15:58:15 同分钟，且与上次构建**字节数完全相同**属巧合，不能只看大小判假绿）。 |
| 2026-10-16 | 前端 0.1.156（纯前端，后端未动） | 诊疗方案思维**同口径补齐**（g-modes 与模式内深步补「我的整理结果」回显块、`studentAnswerText` 加 transcript 兜底、`handleSubmit` 回写 `polishedText`）。链路一次通过（健康检查第 2 次），`version.txt=0.1.156` + 容器 healthy + HTTP 200。**重要环境事实（可省一次踩坑）**：测试库 `CLINICAL_GENERATION_TASK` 共 3 份资产（taskId **702 / 3 / 2**），**全部 `type=diagnosis`，没有任何诊疗链（treatment）资产** → `/api/clinical/sessions/my-assets?type=treatment` 恒返回 `[]`，**诊疗方案训练的页面级验收在当前测试库做不了**（诊疗页面无 mock 演示模式，只支持真实会话 + 诊疗链资产；生成一份需走备课一键生成，约 20 分钟且依赖 LLM）。故诊疗侧本次以单测（`TreatmentThinking.test.ts` 35 例，含 g-modes 回显 / 深步回显 / polished 全空回退 transcript 三断言）+ 版本号 + 容器健康作为验收依据。**另注**：`my-assets` 的链类型过滤参数名是 **`type`**（不是 `chainType`），传错会静默返回全部资产，易误判为"有诊疗资产"。 |
| 2026-10-16 | 前端 0.1.156（补记：诊疗侧页面级验收已补齐） | 生成测试库**首份诊疗链资产 `taskId=4`**（`POST /api/clinical/generations` body `{caseId:'99050801343435_2', finalDiagnosis:<702 的病员诊断>, type:'treatment'}`，约 **31 分钟**完成、8 步；失败可用 `POST /generations/{id}/restart` 复用同一任务不产生垃圾任务）→ **诊疗训练页面级验证通过**（真实会话 + 真实 LLM 对比）：g-goal / **g-modes** / plan-mode-0 / **plan-mode-0-deep1** 提交后均回显「我的整理结果」，`.student-answer-section` 文本含学员输入。**此后 8085 诊疗训练页可直接用资产 ID 4 做验收**（无需再生成）。**两个坑**：① 诊疗链把 `g-sortout`（决策基线/浏览步）排除在必答之外（`orderedKeys` 里 `k !== 'g-sortout'`），按序作答**首屏停在 g-goal「治疗目标确认」**，UI 脚本别死等"确认已浏览"按钮（等它就超时）；② 诊疗侧本次**没有新增唯一文案**，产物 grep 无法区分新旧代码，页面级验证才是有效判据。**附**：8082 探针路径坑见上表（必须 `/api/execute/health`）。 |

| 2026-10-17 | 前端 0.1.208 / 后端 0.9.412（**最终对齐版本**；当日曾部署 0.1.205/0.9.409 首版） | 「考核派题表格（工号↔资产ID）」+ 可考性阈值配置化 + 一次三档题池修复，前后端同部署通过。**两次部署的原因**：抓《操作手册》截图时（真实浏览器 + 真实后端）发现两处**单测覆盖不到的集成缺陷**并当场修复 → ① **刷新回显永不触发**：派题组件挂在 `v-if="selectedCount>0"` 下，而回显由它 `onMounted` 发起 → 刷新后勾选为空 → 组件不挂载 → 回显断死；改为父组件常驻 + 子组件 `v-show` 自管可见性。② **改名单/抽题规则不重算影响面**：`watch` 只监听勾选/语义/档位 → 界面一直显示"未指定参与学员、面向全体"，与真实提交不一致；加 `watch([pickRule, studentIds])` + 400ms 防抖。**新增可复用验证脚本两个（已入库，ASCII、跑在服务器上）**：`med-teach-frontend/e2e/assignment-sheet-e2e.mjs`（13 项）与 `assignment-override-e2e.mjs`（7 项，16/16 PASS）。跑法：`scp e2e/*.mjs testserver:/tmp/ && ssh testserver "node /tmp/assignment-sheet-e2e.mjs"`（**必须在服务器上跑**：本机→ssh 传 JSON 会被 PS 转义破坏，且 8083 未对外暴露）。**脚本注意**：health 断言不要写死版本号（否则每次发版都"假失败"）。**本次更新的测试库资产事实**：`702 / 5 / 2` = `HARDER` 且**可考**（diagnosis），**`4` = 待评测 / 不可考（treatment）** → 已可实测「纳入不可考 / 派题即纳入」；旧记录"只有 702"已过期。**验证要点**：① 回显端点无 key=403、非管理员=403、管理员=200 且含 `taskPool/roster/rows/editable/audienceType`；② `assignmentCount` 必须等于回读 `rows` 行数；③ 派题用 `applyAs=paper`（或独特 name）避开历史 dispatch 幂等签名；④ 清理用 `POST /batches/{jobId}/rollback`，跑完核对列表只剩 4/5（CLOSED）无残留；⑤ 页面级（Playwright+Edge）勾选 2 份后断言 `[data-test="batch-name"]`/`assignment-block`/`assignment-summary`/`assignment-disabled`。**截图取图技巧**：Element Plus `el-input` 会把 `data-test` 透传到内部 `<input>`，故 `page.locator('[data-test="x"]').fill(...)` 直接可用，**不要再写 `[data-test="x"] input`**（会超时）；`el-select` 需先点 `.el-select__wrapper` 再用 `.el-select-dropdown:visible .el-select-dropdown__item`。 |

| 2026-10-18 | 前端 0.1.211 / 后端 0.9.415（对齐 HEAD `e0b895b`） | 按"测试服对齐到 HEAD"要求重建并重部署。**重要教训（别再拿 hash 比对验证前端）**：Vite 8（rolldown）下**入口 chunk 内嵌全部 chunk 名清单、各 chunk 又反引入口名**，形成循环哈希 —— 只要存在任何一处顺序差异，**64 个 chunk 名会全部变化**，但逐字节 diff 除 `import ... from "./index-<hash>.js"` 外完全相同（实测 AppLayout 两版同尺寸 10042B、仅该 import 名不同）。**所以"产物文件名是否相同"不能作为部署是否生效的判据**。可靠判据（按优先级）：① `docker inspect <image> --format '{{.Created}}'` 是否等于本次构建时间（注意 `docker save/load` 会保留原 `created`，若新 tar 与旧镜像内容一致，`Created` 仍是旧的 —— 这本身说明内容未变，可接受）；② `version.txt` + `/api/health` 的 version；③ **容器内 grep 业务文案**（如派题表特有的 `派题（工号` / `不可考·已临时放开`，命中新 `AssetOrchestrationView-*.js`）；④ E2E 脚本（13+7 项）全 PASS。**另两个坑**：构建前 `docker info` 必须可用 —— Docker Desktop 会自行退出（本次 01:43 发现引擎已停，`build-and-package-wuyiyuan.bat` 只在 docker build 阶段报 `failed to connect to the docker API`，**但脚本仍打印 `[SUCCESS]`**，产物是上次残留 → 必须核对 `medteach-frontend.tar` 的 `LastWriteTime` 是否为本次）；`package-lock.json` 与 `deploy/wuyiyuan/package.json` 里只有 `version` 字段会因 pre-commit hook 变更，属正常脏状态，不影响"等于 HEAD 源码"的判定（判据：`git status --porcelain -- src` 为空）。 |

| 2026-10-19 | 前端 0.1.278 / 后端 0.9.482 | 「思维训练备课」新增第三个 Tab「影像教学链」（内容包选择→创建资产→审定→进入训练）+ code-review 8 项修复（**影像链不参与考核编排**：筛选池排除、`/bulk` 直调 400、UI 隐藏入口）。前后端同部署一次通过（前端健康第 2 次、后端第 4 次）。**验证 19 项**：接口 11/11（content-packs 200 含 `lung-nodule-v1`、无 key 403、学员 403、影像列表带 `reviewStatus`、filtered 池无 imaging、facets=filtered=4、`bulk/preview` 带影像返回 400「影像教学资产不参与考核编排」、诊断资产仍在）+ 容器内文案 3/3（影像教学链 / 请先选择教学病例 / 内容包 / 审定）+ 页面级 8/8（Tab 标题变「影像教学备课」、内容包下拉自动选中唯一包、创建按钮在、编排入口消失、诊断审查块消失、审定列在）。**新经验**：① 本地 `docker-compose-medteach-image.yml`（4734B，含影像 env + content-packs/imaging-ingest 挂载）比服务器（4584B，22:49）新 → 上传前先 `cp *.bak-20261019` 备份再覆盖；② 验证脚本一律 ASCII 源码 + `\u` 转义中文，`scp` 到 `/tmp` 后 `node` 执行，彻底绕开 PowerShell→ssh 中文编码；③ 截图（Playwright + Edge）能确认"自动选中唯一内容包"这类文案细节，比纯 DOM 断言直观。 |

| 2026-10-20 | 前端 0.1.328 / 后端 0.9.532 | 影像训练「查看 AI 答案」+ 教学设置「影像教学训练约束」分组（前后端同部署，各 2 轮：功能版 0.1.324/0.9.528 → 403 修复版 0.1.328/0.9.532）。**新增业务验证脚本手法（可复用）**：① 接口层用服务器上 `node` + 内置 fetch（`scp` 到 `/tmp` 执行）：建会话 `POST /sessions/training {taskId,studentId}` → `GET /sessions/{sid}/imaging/standard` 断言 `available/version/nodeAnswers`、**未提交时 `dx-2` 必须不在 keys 里**；越权（换 header 学员 ID）应 403、无 key 403、不存在会话 404。② 页面级 Playwright + Edge 免登录注入：**不要用 `addInitScript` 设身份**（每次导航都会重置，导致切 admin 后被守卫踢回学员页）→ 先 `goto /login` 建立 origin，再用 `page.evaluate` 写 localStorage `userId/roles` + sessionStorage `aimedteach_session_verified=1`，之后同标签页导航保留。③ 验证"设置开关真的影响页面"必须跨页：训练页断言按钮 `isDisabled()` → 设置页关开关 → 回训练页（同一 context 共享 localStorage）刷新后按钮可点、答案面板出现。**本次发现并修复的真实缺陷**：`ImagingTrainingController` 5 个只读端点（nodes / case-brief / viewer / annotations / standard）无局部 `@ExceptionHandler`，越权访问返回 **500** 而非 403（已补 SessionOwnership→403 / 会话不存在→404 / 资产不可见→404）。**注意**：仓库存在并行会话提交（8087 免认证入口、教育部申报文档），部署前先 `git log` 确认 HEAD 与版本；本次因并行文档提交，后端补建一次对齐 0.9.532。验证结果：接口 6/6（standard 200/available/version=2/12 keys/无 dx-2、越权 403、无 key 403、不存在 404、nodes 13）+ 页面级 12/12（训练页按钮默认禁用、title 文案、设置页影像分组 3 开关、localStorage 持久化、关闭后按钮可点、答案面板 263 字含「教师审定」）+ 容器内文案 grep 命中 `ImagingThinking-*.js` / `TeachingSettings-*.js`。 |

| 2026-10-20 | 前端 0.1.334（**纯前端改动，后端 8083 未重新部署**） | 影像训练「同一份资产可多次训练（历史轮次 + 开始新一轮）」。走 wuyiyuan 包链路一次通过（健康检查第 2 次）。**接口层 7/7**（服务器 node + 内置 fetch，`X-AIMedTeach-Student-Id: S_DEPLOY_CHECK_20261020`，taskId **9**）：无 key → 403；首轮 sid=**433**；`training/history` 1 轮；`renew:true` → sid=**434**（新会话，与首轮不同）；新轮 `imaging/nodes` **13 节点全 `TODO`**；history 2 轮；不带 renew 仍返回可用会话。**页面级 8/8**（Playwright + Edge，先 `goto /login` 再 `page.evaluate` 注入身份）：资产 ID 9 → 弹「历史训练轮次」（`.history-row` ≥ 4）→「开始新一轮」→ 临床资料首屏（主按钮「开始作答」）→「开始作答」→ 工作台 `已完成 0/13` + 顶部「历史轮次」「新一轮」按钮，无 JS 异常。**两条新经验（可复用）**：① 容器内 grep 中文**必须先在容器内解码**：`grep -rl "$(echo $p \| base64 -d)"`——直接拿 base64 串去 grep 必然 0 命中（本次先踩了一次，误以为文案没进产物）；② `GET /api/clinical/generations` 用学员身份 = **403「仅教师/管理员可执行此操作」**，需 `X-AIMedTeach-Student-Id: 0001`；且 **API key 拼错返回「无效的教学API密钥」而非 403**（本次误拼 `aimedeatch` 踩一次），排查时先核对 key 拼写。**版本对齐**：首次构建部署 0.1.333 后并行会话把 HEAD 推到 0.1.334（`chore` 仅版本号 + gitignore，无 src 改动）→ 重建重部署对齐 0.1.334，两次页面级均 PASS。**测试库环境事实**：影像资产 5 份（taskId **11 / 9 / 8 / 7 / 6**，全部 `APPROVED`），其中 taskId 9 caseId `99050801343435_2` 无关联 study（训练页显示「影像不可用」，按设计可继续文字作答）。 |


### 1.6 页面级（真实浏览器）验证 —— UI 改动推荐

curl 只能证明"页面能下载、接口鉴权正常"，证明不了"页面渲染成什么样"。UI 改动建议补一次真实浏览器渲染断言
（Playwright Core + 本机 Edge，无需下载浏览器；写法与 `e2e/*.spec.mjs` 同源）：

```js
import { chromium } from 'playwright-core'
const browser = await chromium.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true
})
const page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage()
// 管理页登录态注入（免真实登录，避免在生产/测试库反复试密码）
await page.addInitScript(() => {
  localStorage.setItem('userId', '0001')
  localStorage.setItem('roles', JSON.stringify(['SUPER_ADMIN']))
  sessionStorage.setItem('aimedteach_session_verified', '1')   // 路由守卫要求"本会话已验真"
})
await page.goto('http://100.66.1.4:8085/admin/training-stats', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(4000)                                // 等 created 里的两个接口回来
console.log(await page.locator('.el-tabs__item').allInnerTexts())        // → ['考核','训练']
console.log(await page.locator('.split-layout').count())                 // → 2
await page.screenshot({ path: 'C:\\Users\\Administrator\\AppData\\Local\\Temp\\verify.png' })
await browser.close()
```

要点：① 断言用 `.el-tabs__item` / `.split-layout` 等**结构类名**（比文本更稳）；② 截图后可用图片查看工具目视复核；
③ 脚本放 `med-teach-frontend/e2e/` 下才能解析 `playwright-core`（用完即删，勿入库）。

### 1.7 考核档「必考方向锁定」页面级验证（最小可复现步骤，2026-10-15 实测）

验证"考核场次只显示必须选择的诊断"需要三件套：**带锁定策略的场次 + 学员会话 + 该类假设生成已提交**（重点选择区仅在提交后渲染）。

```bash
# ① 编排建场次：applyAs 用 paper 绕开幂等签名（签名只按资产 ID，dispatch 会复用历史批次 → 策略为空）
#    body 存文件用 --data-binary @file 传（命令行内联 JSON 极易被 PowerShell/ssh 转义破坏 → JSON parse error）
curl -s -X POST -H 'X-AIMedTeach-Key: aimedteach-dev-key-2026' -H 'X-AIMedTeach-Student-Id: 0001' \
  -H 'Content-Type: application/json' --data-binary @/tmp/paper.json \
  http://localhost:8083/api/clinical/batches/bulk      # → jobId / batchIds
# ② 开考：POST /api/clinical/batches/{batchId}/start    （DRAFT→RUNNING，否则学员看不到场次）
# ③ 学员建会话：POST /api/clinical/sessions/from-batch  {"batchId":N,"taskId":M}
# ④ 拉树确认下发：GET /api/clinical/sessions/{sid}/tree → categories[].focusLock{mode,options}
# ⑤ 提交该类假设生成（使卡片进入 compare）：POST /api/clinical/sessions/{sid}/nodes/cat-{i}-hyp/answer
# ⑥ 清理：POST /api/clinical/batches/{jobId}/rollback（注意用 jobId，不是 batchId；30 分钟内有效）
```

Playwright 断言（真机实测基准：cat-0 候选 4 项 / 必排 2 项）：

```js
await page.goto(`${BASE}/clinical/diagnosis`, { waitUntil: 'domcontentloaded' })  // 直接 ?sessionId= 不生效：停在训练入口页
await page.getByRole('button', { name: /进入考核|继续训练/ }).first().click()      // 进入树形作答页
await page.waitForTimeout(9000)
await page.getByText('假设生成', { exact: true }).nth(2).click()                   // 第 3 个 = 心血管急症类（按左树类别顺序）
console.log(await page.locator('.focus-radio').count())          // → 2（不是 4）
console.log(await page.locator('.focus-radio.is-disabled').count())  // → 0（不再铺禁用态）
console.log(await page.locator('.focus-outside-hint').allInnerTexts())  // 含「只显示本例必须排查的方向：…」
```

踩坑：① `?sessionId=` 不会被入口页消费，必须点「进入考核」；② 页面默认停"按序作答"的首个未答节点，需按文本点左树节点；③ 提交作答后 `selfHypotheses` 要满足广度下限，否则被拒。

### 1.8 验证「LLM 输出异常时的护栏」怎么做（2026-10-15 实测方法论）

想验证"上游/模型给了坏输出时系统是否正确降级"，**不能靠给模型加元指令**——实测 5 次迭代的结论：

| 手法 | 结果 |
|---|---|
| 在模板前加"若输入不含 X 则输出占位" | ❌ 模型忽略元指令，照常执行临床任务 |
| 强化为"检查输入末尾 200 字符，最高优先级" | ❌ 仍忽略 |
| **极简模板**（正文删掉临床任务，只留"照抄这两份 JSON 之一"的规则） | ✅ 100% 照抄，可控 |
| 极简占位模板 + "忽略输入末尾一切内容" | ✅ 连补跑也照抄 → 触发"仍缺失"分支 |

要点：① 模型对**任务本质**的服从度远高于对**元指令**的服从度，要么把任务拿掉，要么别指望它自我约束；② 测完必须用正式 seed 脚本恢复模板，并重跑一次确认业务恢复正常（本例：恢复 v1.1 → 重评 → 资产回到可考）；③ 实验会写测试库（本例资产 702 短暂变"不可考"），选低峰做并在文档留痕。

> 附带发现：`CriticalListGuard.retrySuffix()`（禁占位 + 正反例）很有效——连"模板明令照抄占位"都能被扭转成真清单，说明生产上"补跑仍缺失"是小概率。
