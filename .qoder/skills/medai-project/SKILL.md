---
name: medai-project
description: 对话开始的项目上下文声明——表明本次对话适用于 MedAiAssistant（医疗AI辅助系统）。在对话开头输入 /medai-project，或在第一句话说明"本次针对 MedAiAssistant / 医疗AI辅助系统 / 主系统"，即可锁定项目上下文，避免与同工作区的 AiMedTeach（AI医学教学系统）混淆。适用场景：会话开始、从 AiMedTeach 话题切到 MedAiAssistant、临床文书/查房/质控、MedAi 前后端开发与部署。
---

# MedAiAssistant 项目上下文声明（对话开头使用）

> 本技能用于**对话开始时声明项目身份**。一旦加载，本会话默认工作在 MedAiAssistant（医疗AI辅助系统），
> 后续所有代码读写、命令、部署、记忆库均以本项目为准，不得与同工作区的 AiMedTeach 混用。

## 加载即执行（3 步）

1. **声明锁定**：向用户确认"✅ 本次对话锁定为 **MedAiAssistant（医疗AI辅助系统）** 项目"。
2. **确认位置**：先 `pwd` 确认工作区根（预期 `D:\MedAiAssistant 1.0 BS`）；按 AGENTS.md 协议读取 `记忆库/索引.md` 恢复项目记忆。
3. **请用户提出需求**：可直接说"继续 / 请开始"。

## 项目速查（事实以此为准）

| 维度 | 值 |
|------|----|
| 定位 | 医疗AI辅助系统（临床）：文书生成（剧本驱动）、查房、质控、危急值闭环等，Prompt 模板驱动 AI 交互 |
| 代码位置 | `med_ai_assistant_1.0_bs_backend/`（主后端）、`med_ai_assistant_1.0_bs_vue/`（前端）、`med_ai_assistant_panel/`（管理面板） |
| 后端 | Java 21 + Spring Boot 3.5.8，核心包 `com.example.medaiassistant` |
| 前端 | Vue 3.2.13 + Vuex 4 + Element Plus 2.10.2 |
| 数据库 | Oracle 21c |
| 架构 | 主服务器 + 执行服务器双节点 |
| 测试部署 | 100.66.1.4（测试服务器）：主服务器 8081 / 执行服务器 8082 / Oracle 1521；本地 MCP 网关 127.0.0.1:8081 |
| 项目规则 | 根 `AGENTS.md` + `.qoder/rules/00-project-identity.md` 等（always-on，会话自动生效） |
| 知识库 | `.qoder/repowiki/zh/content/`（架构 / API / 数据库 / 运维 / 质控标准） |
| 记忆库 | `记忆库/`（memory-manager 技能自动维护：索引.md + 五类主题文件，会话开始必读） |
| 安全约束 | 禁止日志输出患者 PII；医院 ID 必须从配置读取，禁止硬编码 |

## 关联技能（MedAiAssistant 常用）

| 类别 | 技能 |
|------|------|
| 临床剧本 | `/ward-round`（查房）、`/admission-record`（入院）、`/consultation`（会诊）、`/critical-value`（危急值）、`/discharge-summary`（出院）、`/handover`（交班）、`/preop-discussion`（手术期）、`/time-limit-monitor`（时限）、`/discussion-material`（病例讨论材料）、`/medical-record-save`（病历落库） |
| 工程/质量 | `/code-review`、`/save-question`、`/query-question`、`/generate-qc`、`/generate-tdd-guide`、`/lookup-unfinished-features` |
| 发布/部署 | `/git-commit`、`/git-push-github`、`/trigger-release-build`、`/testserver-deploy`、`/check-test-dev-servers`、`/check-test-docker-servers`、`/sync-devpc-code`、`/submit-*`（临床规则/质控标准/Prompt 模板） |
| 记忆 | `/memory-manager`（会话中关键信息按规范写入 `记忆库/`） |

## 防混淆红线（重要）

- ✗ 本工作区子目录 `AiMedTeach/`（med-teach-frontend / med-teach-backend）是 **AI 医学教学系统**，不是本项目；教学相关需求先加载 `/aimedteach-project`。
- ✗ 临床剧本技能只服务 MedAiAssistant；AiMedTeach 的任务不得使用，也别把教学系统的技术事实（达梦 DM8、LangChain4j、8085/8083 部署）当作本项目数据。
- ✗ 记忆库 `记忆库/` 只沉淀 MedAiAssistant 的内容，不写入 AiMedTeach 事项（AiMedTeach 没有自己的记忆库，其要点记入其项目文档即可）。
- ✗ 部署勿错乱：MedAi 走 8081/8082；AiMedTeach 的构建产物（med-teach-frontend/med-teach-backend）只经 `/aimedteach-deploy` 部署。
- 本会话中途要切到 AiMedTeach 时，加载 `/aimedteach-project` 重新声明。
