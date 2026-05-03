---
name: check-test-dev-servers
description: 检查测试服务器开发模式（开发模式）下主服务器、执行服务器、前端服务的运行状态和代码版本。涵盖进程状态、端口监听、Git 代码版本、健康检查、cron 监控日志、启动日志分析。当用户询问测试服务器开发模式服务状态、代码是否为最新时使用。
---

# 检查测试服务器开发模式（开发模式）服务状态

## 概述

测试服务器开发模式（开发模式）是独立于 Docker 模式的一套服务，使用 9080-9082 端口：
- **9080** — Vue 开发服务器（`vue-cli-service serve`）
- **9081** — 主服务器（Spring Boot，profile=main）
- **9082** — 执行服务器（Spring Boot，profile=execution）

开发模式由 `dev-mode-cron.sh` 定时监控保活，前后端代码通过 `dev-mode-start-*.sh` 脚本管理更新。

## 服务器连接

所有命令通过 SSH 执行到测试服务器（`100.66.1.4`），用户 `liuzh2008`。

```powershell
ssh testserver "<command>"
```

## 检查步骤

按以下顺序执行检查，每步完成后记录结果。

---

### 1. 开发模式进程列表

查看开发模式相关 Java 和 Node.js 进程是否在运行。

```powershell
ssh testserver "ps aux | grep -E 'java|node.*vue' | grep -v grep"
```

关键进程：
- 主服务器 Java 进程（profile=main，端口 9081）
- 执行服务器 Java/Maven 进程（profile=execution，端口 9082）
- Vue CLI 开发服务器进程（端口 9080）

---

### 2. 端口监听状态

确认 9080/9081/9082 端口是否正常监听。

```powershell
ssh testserver "ss -tlnp | grep -E '908[0-9]'"
```

预期输出（三行，每行对应一个端口）：
```
LISTEN 0  511    0.0.0.0:9080   0.0.0.0:*    users:(("node",...))
LISTEN 0  100        *:9081        *:*       users:(("java",...))
LISTEN 0  100        *:9082        *:*       users:(("java",...))
```

---

### 3. 健康检查

确认各服务健康状态接口返回 UP。

**主服务器：**
```powershell
ssh testserver "curl -s http://localhost:9081/api/health | python3 -c 'import sys,json;d=json.load(sys.stdin);print(f\"主服务: {d.get(\"overallStatus\",\"未知\")}\")' 2>/dev/null || curl -s http://localhost:9081/api/health"
```

**执行服务器：**
```powershell
ssh testserver "curl -s http://localhost:9082/api/health | python3 -c 'import sys,json;d=json.load(sys.stdin);print(f\"执行服务: {d.get(\"overallStatus\",\"未知\")}\")' 2>/dev/null || curl -s http://localhost:9082/api/health"
```

**前端（检查 dev server 是否响应）：**
```powershell
ssh testserver "curl -s -o /dev/null -w '前端 dev server: HTTP %{http_code}\n' http://localhost:9080/"
```

---

### 4. 开发模式代码版本

**前端代码版本：**
```powershell
ssh testserver "cd /home/liuzh2008/公共/med_ai_assistant_workspace/med_ai_assistant_1.0_bs_vue && git log --oneline -3 && echo '---版本号---' && cat package.json | grep version | head -1"
```

**后端代码版本（注意后端是 main 分支）：**
```powershell
ssh testserver "cd /home/liuzh2008/公共/med_ai_assistant_workspace/med_ai_assistant_1.0_bs_backend && git log --oneline -3 && echo '---版本号---' && grep '<version>' pom.xml | head -1"
```

---

### 5. 开发模式日志检查

**主服务器启动日志：**
```powershell
ssh testserver "cat /home/liuzh2008/公共/med_ai_assistant_workspace/dev-mode-logs/main-dev.log 2>/dev/null"
```

**执行服务器启动日志：**
```powershell
ssh testserver "cat /home/liuzh2008/公共/med_ai_assistant_workspace/dev-mode-logs/execution-dev.log 2>/dev/null"
```

**前端启动日志（包含拉取代码、安装依赖、编译详情）：**
```powershell
ssh testserver "cat /home/liuzh2008/公共/med_ai_assistant_workspace/dev-mode-logs/frontend-startup.log 2>/dev/null"
```

**前端运行日志（webpack 编译输出）：**
```powershell
ssh testserver "tail -20 /home/liuzh2008/公共/med_ai_assistant_workspace/dev-mode-logs/frontend-dev.log 2>/dev/null"
```

---

### 6. Cron 监控日志

开发模式由 `dev-mode-cron.sh` 定时检测（约 30 秒一轮），监控各服务健康状态并自动重启。

**查看最近监控记录：**
```powershell
ssh testserver "tail -30 /tmp/dev-mode/logs/cron.log 2>/dev/null"
```

**检查是否有异常退出（exit != 0）：**
```powershell
ssh testserver "grep -v 'exit=0' /tmp/dev-mode/logs/cron.log 2>/dev/null | grep '完成' | tail -10"
```

正常输出示例（所有服务 exit=0）：
```
[2026-05-03 21:55:14] 第 4809 轮完成 — 主服务: exit=0, 执行服务: exit=0, 前端: exit=0
```

---

### 7. 各服务启动时间

检查开发模式各服务的进程启动时间。

```powershell
ssh testserver "ps -eo pid,lstart,args --sort=start_time | grep -E 'java.*908[12]|node.*vue' | grep -v grep"
```

---

### 8. 快速一键检查

汇总开发模式所有关键指标：

```powershell
ssh testserver "echo '=== 端口监听 ===' && ss -tlnp | grep -E '908[0-9]' && echo '=== 健康检查 ===' && curl -s http://localhost:9081/api/health | python3 -c 'import sys,json;print(json.load(sys.stdin).get(\"overallStatus\",\"未知\"))' 2>/dev/null && curl -s http://localhost:9082/api/health | python3 -c 'import sys,json;print(json.load(sys.stdin).get(\"overallStatus\",\"未知\"))' 2>/dev/null && curl -s -o /dev/null -w '前端: HTTP %{http_code}\n' http://localhost:9080/ && echo '=== 代码版本 ===' && cd /home/liuzh2008/公共/med_ai_assistant_workspace/med_ai_assistant_1.0_bs_vue && echo 前端: $(git log --oneline -1) && cd /home/liuzh2008/公共/med_ai_assistant_workspace/med_ai_assistant_1.0_bs_backend && echo 后端: $(git log --oneline -1) && echo '=== 最近Cron ===' && tail -5 /tmp/dev-mode/logs/cron.log 2>/dev/null"
```

---

## 开发模式端口对照

| 服务 | 开发模式端口 | Docker 模式端口 | 说明 |
|------|-------------|----------------|------|
| 前端 | **9080** | 80 (nginx) | Vue CLI dev server |
| 主服务器 | **9081** | **8081** | Spring Boot main profile |
| 执行服务器 | **9082** | **8082** | Spring Boot execution profile |
| 代理 | 无独立代理（vue.config 内置 proxy） | 8080 (nginx) | 开发模式通过 webpack-dev-server proxy |

## 启动脚本位置

```powershell
# 主服务器启动脚本
ls -la /home/liuzh2008/公共/med_ai_assistant_workspace/med_ai_assistant_1.0_bs_backend/deploy/main-linux-testServer/dev-mode-start-main.sh

# 执行服务器启动脚本
ls -la /home/liuzh2008/公共/med_ai_assistant_workspace/med_ai_assistant_1.0_bs_backend/deploy/main-linux-testServer/dev-mode-start-execution.sh

# 前端启动脚本
ls -la /home/liuzh2008/公共/med_ai_assistant_workspace/med_ai_assistant_1.0_bs_vue/dev-mode-start-frontend.sh

# Cron 监控脚本
ls -la /home/liuzh2008/公共/med_ai_assistant_workspace/med_ai_assistant_1.0_bs_backend/deploy/main-linux-testServer/dev-mode-cron.sh
```

## 开发模式配置

开发模式使用独立的配置文件：

```powershell
# 开发模式配置文件
cat /home/liuzh2008/公共/med_ai_assistant_workspace/med_ai_assistant_1.0_bs_backend/deploy/main-linux-testServer/application-devmode.properties

# 前端代理配置（vue.config.js 内置）
cat /home/liuzh2008/公共/med_ai_assistant_workspace/med_ai_assistant_1.0_bs_vue/vue.config.js | grep -A 20 'devServer'
```

---

## 诊断摘要

| 状态 | 含义 |
|------|------|
| ✅ 正常 | 端口监听正常，健康检查 UP，cron 监控 exit=0 |
| 🔶 部分异常 | 某个服务端口未监听或健康检查失败 |
| 🔴 异常 | 多个服务不可用，需查看启动日志 |

### 常见情况

1. **前端启动流程**：`dev-mode-start-frontend.sh` 启动时会自动 `git pull` 最新前端代码、检查 `package.json` 变更并重装依赖、等待 webpack 编译完成、进行健康检查和 CORS 验证。

2. **主服务器/执行服务器启动失败**：日志中显示 `setsid: 执行 ./mvnw 失败: 权限不够` 说明 `mvnw` 文件缺少执行权限，需要 `chmod +x mvnw`。

3. **Cron 监控**：`dev-mode-cron.sh` 每 30 秒检测一次各服务，如果发现服务停止会自动重启。可通过 cron 日志查看服务稳定性。
