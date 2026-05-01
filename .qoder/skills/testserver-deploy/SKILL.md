---
name: testserver-deploy
description: 测试服务器代码推送、开发模式与Docker模式的前后端及执行服务器启动调试。当用户需要推送代码到测试服务器、启动/停止/调试开发模式或Docker模式服务时使用。
---

# 测试服务器部署与调试 Skill

## 服务器信息

| 项目 | 值 |
|------|-----|
| 测试主服务器 IP | 100.66.1.4 |
| SSH 用户 | liuzh2008 |
| SSH 别名 | testserver |
| 工作区路径 | `/home/liuzh2008/公共/med_ai_assistant_workspace/` |
| 后端项目路径 | `{工作区}/med_ai_assistant_1.0_bs_backend/` |
| 前端项目路径 | `{工作区}/med_ai_assistant_1.0_bs_vue/` |
| 部署脚本目录 | `{后端}/deploy/main-linux-testServer/` |

## 双模式端口映射

| 服务 | Docker 模式 | 开发模式 |
|------|-------------|----------|
| 前端 | 8080 | 9080 |
| 主后端 | 8081 | 9081 |
| 执行服务 | 8082 | 9082 |
| Redis | 6379 (共用) | 6379 (共用) |
| Oracle | 1521 (共用) | 1521 (共用) |

两种模式完全并行运行，互不干扰。

---

## 一、代码推送到测试服务器

### 方式一：自动部署（推荐，Docker模式）

测试服务器上 crontab 每分钟执行 `auto-deploy.sh`，检测 git 变更后自动构建和部署。

```powershell
# 本地提交并推送
git add <files>
git commit -m "描述"
git push

# 查看自动部署日志（等待部署完成）
ssh testserver "tail -f /home/liuzh2008/公共/med_ai_assistant_workspace/auto-deploy.log"
```

**注意**：`deploy/` 目录的变更在 auto-deploy.sh 的跳过模式中，不会触发 Docker 重新构建，但会被 git pull 拉取到服务器。

### 方式二：手动 SCP 传输（适用于开发模式脚本/配置）

```powershell
# 传输单个文件
scp "本地文件路径" testserver:/home/liuzh2008/公共/med_ai_assistant_workspace/med_ai_assistant_1.0_bs_backend/deploy/main-linux-testServer/

# 传输后设置执行权限（仅脚本文件需要）
ssh testserver "chmod +x /home/liuzh2008/公共/med_ai_assistant_workspace/med_ai_assistant_1.0_bs_backend/deploy/main-linux-testServer/dev-mode-*.sh"
```

### 方式三：手动 git pull（服务器端）

```powershell
# 后端代码
ssh testserver "cd /home/liuzh2008/公共/med_ai_assistant_workspace/med_ai_assistant_1.0_bs_backend && git pull"

# 前端代码
ssh testserver "cd /home/liuzh2008/公共/med_ai_assistant_workspace/med_ai_assistant_1.0_bs_vue && git pull"
```

---

## 二、开发模式（端口 9080/9081/9082）

### 启动后端

```powershell
ssh testserver "cd /home/liuzh2008/公共/med_ai_assistant_workspace/med_ai_assistant_1.0_bs_backend/deploy/main-linux-testServer && bash dev-mode-start.sh --backend-only"
```

参数说明：
- `--backend-only`：只启动后端（主服务+执行服务），不启动前端容器
- `--main-only`：只启动主服务（9081）
- `--execution-only`：只启动执行服务（9082）
- `--all`：启动后端+前端容器（当前前端改用 Vue dev server，一般不用此参数）
- 无参数：等同 `--all`

### 启动前端

```powershell
ssh testserver "cd /home/liuzh2008/公共/med_ai_assistant_workspace/med_ai_assistant_1.0_bs_vue && DEV_PORT=9080 DEV_PROXY_TARGET=http://localhost:9081 VUE_APP_API_BASE_URL=/api VUE_APP_EXECUTION_SERVER_URL=http://100.66.1.4:9082 VUE_APP_DECRYPTION_SERVER_URL=http://100.66.1.4:9082 nohup npx vue-cli-service serve --port 9080 > /home/liuzh2008/公共/med_ai_assistant_workspace/dev-mode-logs/frontend-dev.log 2>&1 & echo started"
```

### 启动自动更新监控（可选）

每30秒轮询 git，发现变更自动拉取并重启后端：

```powershell
ssh testserver "cd /home/liuzh2008/公共/med_ai_assistant_workspace/med_ai_assistant_1.0_bs_backend/deploy/main-linux-testServer && nohup bash dev-mode-watch.sh > /home/liuzh2008/公共/med_ai_assistant_workspace/dev-mode.log 2>&1 & echo watch-started"
```

### 停止开发模式

```powershell
# 停止后端（主服务+执行服务）
ssh testserver "cd /home/liuzh2008/公共/med_ai_assistant_workspace/med_ai_assistant_1.0_bs_backend/deploy/main-linux-testServer && bash dev-mode-stop.sh"

# 停止前端
ssh testserver "pkill -f 'vue-cli-service serve --port 9080'"
```

### 开发模式日志

```powershell
# 主服务日志
ssh testserver "tail -f /home/liuzh2008/公共/med_ai_assistant_workspace/dev-mode-logs/main-dev.log"

# 执行服务日志
ssh testserver "tail -f /home/liuzh2008/公共/med_ai_assistant_workspace/dev-mode-logs/execution-dev.log"

# 前端日志
ssh testserver "tail -f /home/liuzh2008/公共/med_ai_assistant_workspace/dev-mode-logs/frontend-dev.log"

# watch 日志
ssh testserver "tail -f /home/liuzh2008/公共/med_ai_assistant_workspace/dev-mode.log"
```

### 开发模式健康检查

```powershell
# 主后端
ssh testserver "curl -s http://localhost:9081/api/hospital-config/health"

# 执行服务
ssh testserver "curl -s http://localhost:9082/api/execute/health"

# 前端代理到后端
ssh testserver "curl -s http://localhost:9080/api/hospital-config/health"
```

### 开发模式访问地址

浏览器访问 `http://100.66.1.4:9080`

---

## 三、Docker 模式（端口 8080/8081/8082）

### 查看容器状态

```powershell
ssh testserver "docker ps --format 'table .Names\t.Status\t.Ports' | head -10"
```

### 重启 Docker 服务

```powershell
# 重启主后端容器
ssh testserver "docker restart med-ai-main-server"

# 重启执行服务容器
ssh testserver "docker restart med-ai-execution-server"

# 重启前端容器
ssh testserver "docker restart med-ai-frontend"
```

### 手动触发完整 Docker 重新构建和部署

```powershell
ssh testserver "cd /home/liuzh2008/公共/med_ai_assistant_workspace && bash med_ai_assistant_1.0_bs_backend/deploy/main-linux-testServer/auto-deploy.sh"
```

### Docker 模式日志

```powershell
# 主后端容器日志
ssh testserver "docker logs med-ai-main-server 2>&1 | tail -50"

# 执行服务容器日志
ssh testserver "docker logs med-ai-execution-server 2>&1 | tail -50"

# 前端容器日志
ssh testserver "docker logs med-ai-frontend 2>&1 | tail -50"

# 自动部署日志
ssh testserver "tail -f /home/liuzh2008/公共/med_ai_assistant_workspace/auto-deploy.log"
```

### Docker 模式健康检查

```powershell
# 主后端
ssh testserver "curl -s http://localhost:8081/api/hospital-config/health"

# 执行服务
ssh testserver "curl -s http://localhost:8082/api/execute/health"

# 前端
ssh testserver "curl -s http://localhost:8080/"
```

### Docker 模式访问地址

浏览器访问 `http://100.66.1.4:8080`

---

## 四、通用调试命令

### 端口监听检查

```powershell
# 检查所有关键端口
ssh testserver "ss -tlnp | grep -E '8080|8081|8082|9080|9081|9082'"
```

### Java 进程检查

```powershell
ssh testserver "ps aux | grep java | grep -v grep"
```

### Node 进程检查

```powershell
ssh testserver "ps aux | grep vue-cli | grep -v grep"
```

### 内存使用情况

```powershell
ssh testserver "free -h"
```

### 磁盘使用情况

```powershell
ssh testserver "df -h / /home"
```

---

## 五、关键配置文件

| 文件 | 路径（相对后端项目根） | 用途 |
|------|------------------------|------|
| 开发模式后端配置 | `deploy/main-linux-testServer/application-devmode.properties` | 数据库、Redis、CORS、DevTools |
| 开发模式启动脚本 | `deploy/main-linux-testServer/dev-mode-start.sh` | 启动后端主服务+执行服务 |
| 开发模式停止脚本 | `deploy/main-linux-testServer/dev-mode-stop.sh` | 优雅停止所有开发模式进程 |
| 开发模式监控脚本 | `deploy/main-linux-testServer/dev-mode-watch.sh` | git 轮询+自动重启 |
| 自动部署脚本 | `deploy/main-linux-testServer/auto-deploy.sh` | Docker 模式自动构建部署 |
| Docker Compose | `deploy/main-linux-testServer/docker-compose-main.yml` | Docker 模式容器编排 |
| Docker 环境变量 | `deploy/main-linux-testServer/.env.main` | Docker 模式环境变量 |
| Vue 配置 | `med_ai_assistant_1.0_bs_vue/vue.config.js` | 前端端口和代理（支持环境变量） |

## 六、注意事项

1. **代码推送原则**：测试服务器代码变更应通过 git push + 服务器端 git pull 或自动部署完成，不在本地构建后上传 JAR
2. **CORS 配置**：开发模式需在 `application-devmode.properties` 中单独配置 `app.cors.allowed-origins`，必须包含 `http://100.66.1.4:9080`
3. **资源管理**：开发模式额外占用约 3GB 内存，不用时应执行停止脚本释放资源
4. **JDK 要求**：开发模式需要 JDK 21（测试服务器已安装 openjdk 21.0.10）
5. **Node.js 要求**：前端开发服务器需要 Node.js 18+（测试服务器已安装 v18.19.1）
6. **Maven 仓库隔离**：执行服务使用独立 Maven 本地仓库避免锁冲突
7. **auto-deploy.sh 跳过规则**：`deploy/` 目录变更不触发 Docker 构建，但 git pull 仍会拉取
