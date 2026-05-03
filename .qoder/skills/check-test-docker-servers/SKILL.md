---
name: check-test-docker-servers
description: 检查测试服务器 Docker 环境下主服务器、执行服务器、前端服务的代码版本状态。涵盖容器状态、Git 代码版本、Docker 镜像构建时间、构建产物版本、auto-deploy 日志分析。当用户询问测试服务器 Docker 环境代码是否为最新、服务是否正常运行时使用。
---

# 检查测试服务器 Docker 环境代码版本

## 概述

测试服务器 Docker 环境的代码更新由 `auto-deploy.sh` 定时轮询管理（监控后端子模块和前端子模块的远程仓库变化）。本 Skill 提供一套完整命令，用于手动验证各服务是否运行了最新代码。

## 服务器连接

所有命令通过 SSH 执行到测试服务器（`100.66.1.4`），用户 `liuzh2008`。

```powershell
ssh testserver "<command>"
```

## 检查步骤

按以下顺序执行检查，每步完成后记录结果。

---

### 1. Docker 容器运行状态

检查所有 medai 相关容器是否正常运行。

```powershell
ssh testserver "docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'"
```

预期输出 5 个容器：
- `med-ai-main-server` — 主服务器（健康）
- `med-ai-execution-server` — 执行服务器（健康）
- `med-ai-assistant-frontend` — 前端（健康）
- `med-ai-main-redis` — Redis 缓存（健康）
- `med-ai-oracle` — Oracle 数据库（健康）

---

### 2. 容器启动时间与镜像构建时间

检查各容器最近一次启动时间，以及使用的 Docker 镜像构建时间。

**主服务器：**
```powershell
ssh testserver "docker inspect med-ai-main-server --format '容器启动: {{.State.StartedAt}}' && docker inspect med-ai-main-server --format '{{.Image}}' | xargs docker inspect --format '镜像构建: {{.Created}}'"
```

**前端：**
```powershell
ssh testserver "docker inspect med-ai-assistant-frontend --format '容器启动: {{.State.StartedAt}}' && docker inspect med-ai-assistant-frontend --format '{{.Config.Image}}' && docker images --filter reference='med-ai-assistant-frontend*' --format 'table {{.Repository}}\t{{.Tag}}\t{{.CreatedAt}}'"
```

**执行服务器：**
```powershell
ssh testserver "docker inspect med-ai-execution-server --format '容器启动: {{.State.StartedAt}}' && docker images --filter reference='med-ai-execution*' --format 'table {{.Repository}}\t{{.Tag}}\t{{.CreatedAt}}'"
```

---

### 3. 工作区主仓库代码版本

检查主仓库（`med_ai_assistant_workspace`）是否拉取了最新代码。

```powershell
ssh testserver "cd /home/liuzh2008/公共/med_ai_assistant_workspace && git fetch origin master 2>&1 && echo '=== 落后提交数 ===' && git rev-list --count HEAD..origin/master && echo '=== 本地最新 ===' && git log --oneline -5 && echo '=== 远端最新 ===' && git log origin/master --oneline -5"
```

如果 `落后提交数 > 0`，说明主仓库未同步，需要 `git pull`。

> **注意**：auto-deploy 脚本监控的是子模块目录（`med_ai_assistant_1.0_bs_backend` 和 `med_ai_assistant_1.0_bs_vue`），主仓库可能落后但子模块已同步。

---

### 4. 后端子模块代码版本

```powershell
ssh testserver "cd /home/liuzh2008/公共/med_ai_assistant_workspace/med_ai_assistant_1.0_bs_backend && git fetch origin main 2>&1 && echo '=== 落后提交数 ===' && git rev-list --count HEAD..origin/main && echo '=== 本地最新 ===' && git log --oneline -5 && echo '=== 远端最新 ===' && git log origin/main --oneline -5 && echo '=== 未暂存变更 ===' && git status -b"
```

---

### 5. 前端子模块代码版本

```powershell
ssh testserver "cd /home/liuzh2008/公共/med_ai_assistant_workspace/med_ai_assistant_1.0_bs_vue && git fetch origin master 2>&1 && echo '=== 落后提交数 ===' && git rev-list --count HEAD..origin/master && echo '=== 本地最新 ===' && git log --oneline -5 && echo '=== 远端最新 ===' && git log origin/master --oneline -5 && echo '=== 未暂存变更 ===' && git status -b"
```

---

### 6. Docker 镜像列表及构建时间

查看所有 medai 相关 Docker 镜像的构建时间，判断是否为新代码构建。

```powershell
ssh testserver "docker images --filter reference='main-linux-testserver*' --format 'table {{.Repository}}\t{{.Tag}}\t{{.CreatedAt}}\t{{.Size}}' && echo '---' && docker images --filter reference='med-ai-execution*' --format 'table {{.Repository}}\t{{.Tag}}\t{{.CreatedAt}}\t{{.Size}}' && echo '---' && docker images --filter reference='med-ai-assistant-frontend*' --format 'table {{.Repository}}\t{{.Tag}}\t{{.CreatedAt}}\t{{.Size}}'"
```

---

### 7. JAR 构建产物版本

检查后端 target 目录下有哪些版本的 JAR 包，判断本地是否有最新构建。

```powershell
ssh testserver "ls -la /home/liuzh2008/公共/med_ai_assistant_workspace/med_ai_assistant_1.0_bs_backend/target/*.jar 2>/dev/null"
```

同时也检查 build-files 目录的 JAR 是否更新：

```powershell
ssh testserver "ls -la /home/liuzh2008/medai/build-files/backend/"
```

---

### 8. auto-deploy 日志分析

查看 auto-deploy 日志尾部，确认最近是否进行了部署以及部署结果。

**查看最近部署记录：**
```powershell
ssh testserver "tail -80 /home/liuzh2008/公共/med_ai_assistant_workspace/auto-deploy.log"
```

**搜索特定事件：**
```powershell
ssh testserver "grep '包含关键代码变更\|Docker.*构建\|❌\|✅\|跳过部署' /home/liuzh2008/公共/med_ai_assistant_workspace/auto-deploy.log | tail -30"
```

**按日期过滤（例如5月3日的日志）：**
```powershell
ssh testserver "grep '2026-05-03' /home/liuzh2008/公共/med_ai_assistant_workspace/auto-deploy.log | grep '开始部署\|✅\|跳过\|无更新'"
```

---

### 9. 版本号核对

检查前后端 package.json 和 pom.xml 中的版本号是否一致。

**前端版本：**
```powershell
ssh testserver "cd /home/liuzh2008/公共/med_ai_assistant_workspace/med_ai_assistant_1.0_bs_vue && cat package.json | grep version | head -3"
```

**后端版本：**
```powershell
ssh testserver "cd /home/liuzh2008/公共/med_ai_assistant_workspace/med_ai_assistant_1.0_bs_backend && grep '<version>' pom.xml | head -1"
```

---

### 10. 快速一键检查

快速检查各组件代码是否最新（汇总关键指标）：

```powershell
ssh testserver "cd /home/liuzh2008/公共/med_ai_assistant_workspace && echo '=== 主仓库 ===' && git fetch origin master 2>&1 | tail -1 && git rev-list --count HEAD..origin/master | xargs -I{} echo '落后: {} 提交' && echo '=== 后端 ===' && cd med_ai_assistant_1.0_bs_backend && git fetch origin main 2>&1 | tail -1 && git rev-list --count HEAD..origin/main | xargs -I{} echo '落后: {} 提交' && echo '=== 前端 ===' && cd ../med_ai_assistant_1.0_bs_vue && git fetch origin master 2>&1 | tail -1 && git rev-list --count HEAD..origin/master | xargs -I{} echo '落后: {} 提交' && echo '=== Docker ===' && docker ps --format '{{.Names}} {{.Status}}' | grep med-ai && echo '=== 镜像构建 ===' && docker images --filter reference='main-linux-testserver*' --format 'main: {{.CreatedAt}}' && docker images --filter reference='med-ai-assistant-frontend*' --format 'frontend: {{.CreatedAt}}' && docker images --filter reference='med-ai-execution*' --format 'execution: {{.CreatedAt}}'"
```

---

## 诊断摘要

根据检查结果，判断各服务状态：

| 状态 | 含义 |
|------|------|
| ✅ 最新 | 代码与远端一致，Docker 镜像基于最新代码构建 |
| 🔶 代码已拉取 | 子模块代码已同步，但 Docker 镜像未重建（可能因非关键变更被跳过） |
| 🔴 落后 | 代码未拉取或 Docker 镜像使用旧代码构建 |

### 常见情况

1. **auto-deploy 跳过非关键变更**：当变更仅涉及 `pom.xml`（版本号）、`*.md`（文档）、`deploy/`（部署配置）等文件时，auto-deploy 判定为"非关键变更"，仅 pull 代码但跳过 JAR 构建和 Docker 镜像重建。此时代码已拉取但容器未更新。

2. **子模块已更新但主仓库落后**：auto-deploy 脚本直接监控子模块目录，主仓库可能未同步。如需更新主仓库子模块指针，需在主仓库执行 `git submodule update`。

3. **build-files 目录陈旧**：`/home/liuzh2008/medai/build-files/backend/medai.jar` 可能不是最新，该目录主要用于手动部署参考。
