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

## 四、版本记录

| 日期 | 版本 | 说明 |
|------|------|------|
| 2026-09-01 | 前端 0.1.19 / 后端 0.9.226 | 前后端均已在 100.66.1.4 部署验证通过：前端走 /root/docker 生产链路（bat→ps1→zip→deploy-from-package.sh），后端走 testServer（build-and-export-testserver.bat + deploy.sh）；健康检查 8085/8083 全绿 |
| 2026-10-11 | 前端 0.1.84 / 后端 0.9.288 | 「考核成绩单」功能部署验证通过（前端统计页新增成绩单区 + 后端 2 个 `/api/admin/training-stats/batches*` 端点）。**两点新增经验已入上表**：① 后端部署前先跑 28 号表结构脚本（本次实测缺列，跑完 3 列补齐、启动日志无 ORA）；② 确认 8085 = **wuyiyuan 包**（dist 含 `hospital.jpg`）。验证要点：容器 healthy + `version.txt` + 容器内 chunk 含新 API 路径 + 403/404 语义 + nginx 8085→8083 代理 |
| 2026-10-12 | 前端 0.1.112 / 后端 0.9.316 | 「思维训练统计」拆「考核 / 训练」双标签页（均左列表 + 右详情）部署验证通过，**纯前端改动、后端未动**（8083 保持 0.9.316 未重新部署）。全流程无新坑：`build-and-package-wuyiyuan.bat < nul` → `deploy/medteach-frontend.zip`（24.9MB，顶层目录 med-teach-frontend）→ scp `/tmp` → `sudo cp` 到 `/root/docker` → `sudo bash -c 'cd /root/docker && bash deploy-from-package.sh'`（健康检查第 2 次通过）。**新增一条可复用验证手段**：页面级 UI 改动除 curl 外，用 Playwright Core + 本机 Edge headless 做真实渲染验证（见 §1.5 末），本次实测两 tab 标签、两页 `.split-layout/.list-pane/.detail-pane` 各 1、场次列表 2 项、训练记录 4 条、点击记录后 `[data-test="training-detail"]` 出现 |

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
