---
name: aimedteach-project
description: 对话开始的项目上下文声明——表明本次对话适用于 AiMedTeach（AI医学教学系统，AI-Assisted Medical Teaching）。在对话开头输入 /aimedteach-project，或在第一句话说明"本次针对 AiMedTeach / 教学系统"，即可锁定项目上下文，避免与同工作区的 MedAiAssistant（医疗AI辅助系统）混淆。适用场景：会话开始、从 MedAiAssistant 话题切到 AiMedTeach、开发/修改 med-teach-frontend 或 med-teach-backend、教学系统部署与排障。
---

# AiMedTeach 项目上下文声明（对话开头使用）

> 本技能用于**对话开始时声明项目身份**。一旦加载，本会话默认工作在 AiMedTeach（AI医学教学系统），
> 后续所有代码读写、命令、部署、文档均以本项目为准，不得与同工作区的 MedAiAssistant 混用。

## 加载即执行（3 步）

1. **声明锁定**：向用户确认"✅ 本次对话锁定为 **AiMedTeach（AI医学教学系统）** 项目"，本会话内不再适用 MedAiAssistant 的规则与临床技能。
2. **确认位置**：先 `pwd` 确认工作区根（预期 `D:\MedAiAssistant 1.0 BS`），本项目代码在其子目录 `AiMedTeach/` 下。
3. **请用户提出需求**：可直接说"继续 / 请开始"。

## 项目速查（事实以此为准，勿套用 MedAiAssistant 的数据）

| 维度 | 值 |
|------|----|
| 定位 | AI 辅助医学教学：病例脱敏导入、教案自动生成、临床思维教学、课后题目演练、现场教学讨论（声纹/说话人分离） |
| 代码位置 | `AiMedTeach/`（前端 `AiMedTeach/med-teach-frontend/`、后端 `AiMedTeach/med-teach-backend/`） |
| 后端 | Spring Boot 3.5 + Java 21 + LangChain4j 1.0+（包 `com.medteach`），JWT 认证 |
| 前端 | Vue 3.5 + TypeScript + Vite 6 + Element Plus + ECharts 6 |
| 数据库 | 达梦 DM8（教学库）；从医院 Oracle HIS **只读**取数，HanLP 医疗 NER + 正则规则脱敏后导入 |
| AI 服务 | DeepSeek / 通义千问、阿里云百炼 PPT、阿里云智能语音；Langfuse 3.x（PostgreSQL）可观测 |
| 测试部署 | 100.66.1.4（SSH 别名 `testserver`，用户 liuzh2008）：前端 8085（nginx 容器）、后端 8083（宿主机） |
| 部署路径 | `/root/docker/med-teach-frontend`（root 所有，需 sudo）、`/home/liuzh2008/medai/aimedteach/testServer` |
| 项目文档 | `AiMedTeach/README.md`、`AiMedTeach/Doc/整体方案/`、`AiMedTeach/.qoder/repowiki/knowledge/zh/` |
| 按钮帮助 | `AiMedTeach/med-teach-frontend/src/help/entries/`（sync-help-docs 技能维护） |

## 适用规则与知识来源

- AiMedTeach 无独立 AGENTS.md / .qoder/rules：编码规范与架构见 `AiMedTeach/.qoder/repowiki/knowledge/zh/AI医学教学系统整体技术方案/`（概述 / 架构设计 / 技术栈 / 编码规范）。
- 同工作区根的 `AGENTS.md`、`.qoder/rules/*`、`记忆库/` 属于 **MedAiAssistant**：处理 AiMedTeach 任务时，
  只把它当环境约束（编码/语言/沙箱规则），**不得**把其中 Java/Oracle/临床剧本规则当作本项目事实，默认**不写入** MedAi 的记忆库。

## 关联技能（AiMedTeach 常用）

| 技能 | 用途 |
|------|------|
| `/aimedteach-deploy` | 前后端在 100.66.1.4 的构建、打包、部署、健康检查全流程 |
| `/sync-help-docs` | git 提交前同步按钮级帮助条目（目标前端是 med-teach-frontend） |
| `/record-page-demo` | 录制教学系统页面操作演示视频 |
| `/ssh-testserver` | 连接 100.66.1.4 测试服务器 |
| `/git-commit`、`/git-push-github`、`/trigger-release-build` | 提交 / 推送 / 触发构建 |

## 防混淆红线（重要）

- ✗ 本工作区同一目录树下还有 MedAiAssistant（`med_ai_assistant_1.0_bs_backend` / `_vue` / `_panel`）——**不是本项目**。
- ✗ 临床剧本类技能（`/ward-round`、`/admission-record`、`/consultation`、`/critical-value`、`/discharge-summary`、`/handover`、`/preop-discussion`、`/medical-record-save`、`/time-limit-monitor` 等）只服务 MedAiAssistant，教学系统任务不使用。
- ✗ 部署目标勿错乱：AiMedTeach = med-teach-frontend:8085 + med-teach-backend:8083；测试服务器上的 8081/8082（MedAi 主/执行服务器）与 1521（Oracle）**已运行、勿动**。
- ✗ 不要通过修改 MedAi 后端/前端去实现教学功能；反之亦然。
- 本会话中途要切到 MedAiAssistant 时，加载 `/medai-project` 重新声明。
