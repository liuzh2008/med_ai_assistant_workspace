---
name: trigger-release-build
description: 通过 Git 标签触发 GitHub Actions 构建，将前后端构建产物发布到 medai-builds 仓库。当用户需要触发 CI/CD 自动构建、发布新版本构建包时使用。
---

# GitHub Actions 构建触发

通过推送 Git 版本标签（`v*`）触发前后端 GitHub Actions 工作流，自动构建并发布到 `liuzh2008/medai-builds` 仓库。

## 前置条件

- 工作区根目录：`D:\MedAiAssistant 1.0\MedAiAssistant 1.0 BS`
- 版本号来源：项目根目录 `VERSION` 文件（由 `bump-version.ps1` 统一管理）
- 后端仓库：`med_ai_assistant_1.0_bs_backend/`（remote: `liuzh2008/med_ai_assistant_1.0_bs_backend`）
- 前端仓库：`med_ai_assistant_1.0_bs_vue/`（remote: `liuzh2008/med_ai_assistant_1.0_bs_vue`）
- 构建产物仓库：`liuzh2008/medai-builds`
- 需安装 `gh` CLI 并已认证

## 触发条件

| 仓库 | 工作流文件 | 触发条件 |
|------|-----------|---------|
| 后端 | `.github/workflows/release-backend.yml` | 推送 `v*` 标签 |
| 前端 | `.github/workflows/release-frontend.yml` | 推送 `v*` 标签 |

## 执行流程

### 1. 读取当前版本号

```powershell
$version = Get-Content "D:\MedAiAssistant 1.0\MedAiAssistant 1.0 BS\VERSION"
Write-Host "当前版本: $version"
```

### 2. 确认提交已推送

构建由 Git 标签触发，但标签必须指向已推送到远程的提交。先确认两个仓库的工作区干净且所有提交已推送：

```powershell
cd "med_ai_assistant_1.0_bs_backend"
git status
git push origin main

cd "..\med_ai_assistant_1.0_bs_vue"
git status
git push origin master
```

检查点：
- 两个仓库 `git status` 均为 clean
- `git push` 输出 `Everything up-to-date` 或成功推送

### 3. 创建并推送前端构建标签

```powershell
cd "med_ai_assistant_1.0_bs_vue"
git tag -a "v$version" -m "v$version: <变更描述>"
git push origin "v$version"
```

### 4. 创建并推送后端构建标签

```powershell
cd "..\med_ai_assistant_1.0_bs_backend"
git tag -a "v$version" -m "v$version: <变更描述>"
git push origin "v$version"
```

### 5. 查看构建状态

等待约 30 秒让工作流启动，然后检查：

```powershell
# 前端构建状态
gh run list --repo liuzh2008/med_ai_assistant_1.0_bs_vue --workflow release-frontend.yml --limit 1

# 后端构建状态
gh run list --repo liuzh2008/med_ai_assistant_1.0_bs_backend --workflow release-backend.yml --limit 1
```

状态说明：
- `in_progress` — 构建进行中
- `completed success` — 构建成功
- `completed failure` — 构建失败

查看具体任务步骤（将 `<job-id>` 替换为实际 ID）：

```powershell
gh run view --job=<job-id> --repo liuzh2008/med_ai_assistant_1.0_bs_vue
gh run view --job=<job-id> --repo liuzh2008/med_ai_assistant_1.0_bs_backend
```

### 6. 确认构建产物发布

构建成功后，验证 medai-builds 仓库中的 Release：

```powershell
gh release view "frontend-v$version" --repo liuzh2008/medai-builds
gh release view "backend-v$version" --repo liuzh2008/medai-builds
```

## 构建产物说明

| Release 标签 | 内容 |
|-------------|------|
| `backend-v{version}` | JAR 包、Docker 镜像 tar、部署脚本 |
| `frontend-v{version}` | 前端 dist 静态文件 zip 包 |

## 注意事项

- 前后端版本号由 `VERSION` 文件统一管理，通过 `bump-version.ps1` 同步
- 标签命名格式：`v{版本号}`（如 `v0.9.151`），与 `VERSION` 文件内容一致
- 标签必须先指向已推送到远程的提交，否则工作流无法拉取对应代码
- 后端构建约 2-3 分钟，前端构建约 2-8 分钟（含 Cypress E2E 测试）
- 后端工作流监听 `main` 分支，前端工作流监听 `master` 分支
