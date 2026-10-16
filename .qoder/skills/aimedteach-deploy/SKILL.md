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
| **需要在远端 grep 中文文案** | 同上（中文参数走命令行会乱码） | 本地 `node -e "process.stdout.write(Buffer.from('中文片段','utf8').toString('base64'))"` → 远端 `echo -n <b64> \| base64 -d > /tmp/p.txt` → `sudo grep -rl -f /tmp/p.txt /root/docker/med-teach-frontend/dist/assets/` |
| **构建"成功"但产物是旧镜像（假绿，高危）** | 本机 **Docker Desktop 未运行**时，`build-and-package-wuyiyuan.bat` / `build-and-export-testserver.bat` 里的 `docker build/save` 失败**不会终止脚本**：前端仍会把**上一次的 `medteach-frontend.tar`** 打进 zip，只在输出里留一行 `[ERROR] Docker image build failed`（本次实测：zip 时间 08:18 而 tar 仍是前一天 09:10，版本号却显示新值） | ① 构建前 `docker info --format '{{.ServerVersion}}'` 必须返回版本；未运行则 `Start-Process 'C:\Program Files\Docker\Docker\Docker Desktop.exe'`（实测 ~12s 就绪）；② 构建后核对 `deploy/*/medteach-*.tar` 的 **LastWriteTime** 与 `version.txt`/zip 是否同一分钟——tar 落后即假绿，必须重构建 |
| **部署后「重评难度 / 难度评估」返回 `{"reason":"LLM_FAILED"}`** | 执行服务器转发上游 LLM 失败（常见 `AI服务暂时不可用（错误码503）`），**环境侧问题**，非教学服务缺陷 | 查 `sudo docker logs med-ai-execution-server --since 10m 2>&1 \| tail -40` 找 `friendlyError=`；失败按设计**保留原值**（不影响资产数据），上游恢复后重试即可 |
| **改 Prompt 模板后要证明"库里那份真的被读到"** | 运行时模板来源是数据库，仓库文件改了不等于生效 | 执行模板脚本后，看后端日志 `Prompt模板获取成功: promptId=<新ID>, promptLength=<新长度>` + `渲染完成: originalLength=…`（本次实测 651→711 / 1306→1832，即升级生效的硬证据） |

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
