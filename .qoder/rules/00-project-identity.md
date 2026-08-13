---
trigger: always_on
alwaysApply: true
---

# 项目身份

- **项目名称**：医疗AI辅助系统 (MedAiAssistant)
- **技术栈**：Java 21 + Spring Boot 3.5.8 + Oracle 21c / Vue 3.2.13 + Vuex 4 + Element Plus 2.10.2
- **核心包**：`com.example.medaiassistant`
- **架构**：主服务器 + 执行服务器双节点，Prompt模板驱动AI交互

## 知识库

项目自带了 Wiki 知识库（repowiki），遇到不确定的领域知识时优先查阅：

- **主项目知识库**：`.qoder/repowiki/zh/content/`
  - 涵盖：系统架构、API 参考、数据库操作、运维指南、开发环境、质控标准等
  - 使用 `Read` 工具读取具体 `.md` 文件，或用 `Glob` 列出可用文档
- **AIMedTeach 子项目知识库**：`AIMedTeach/.qoder/repowiki/knowledge/zh/`
  - 涵盖：AI 医学教学系统相关文档

## 长期记忆库（自动维护）

- 位置：`记忆库/`（索引.md + 决策与设计/踩坑与教训/环境与配置/命令与流程/会话记忆 五类主题文件）
- 机制：每会话自动读写，规则见根 `AGENTS.md`，格式规范见 `memory-manager` 技能
- 会话开始时读取 `记忆库/索引.md`；会话中出现关键信息时立即写入对应主题文件

## 全局安全约束

- ✗ 禁止日志输出患者PII（姓名、身份证号、手机号、医保号）
- ✗ 禁止硬编码医院ID，必须从配置读取
