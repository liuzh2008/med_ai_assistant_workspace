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

## 四、版本记录

| 日期 | 版本 | 说明 |
|------|------|------|
| 2026-09-01 | 前端 0.1.19 / 后端 0.9.226 | 前后端均已在 100.66.1.4 部署验证通过：前端走 /root/docker 生产链路（bat→ps1→zip→deploy-from-package.sh），后端走 testServer（build-and-export-testserver.bat + deploy.sh）；健康检查 8085/8083 全绿 |
