---
name: query-question
description: 在问题修复中查阅。查阅项目已有的问题修复文档，辅助分析当前问题的根因和解决方案。通过 /query-question 斜杠命令触发。
---

# 查阅问题修复（Query Question）

## 工作流来源

完整的工作流程指引定义在 `.qoder/commands/query_question.md`，**这是唯一的事实来源（Single Source of Truth）**。

> ⚠️ **禁止在本 SKILL.md 中复制命令文件的工作流内容**。任何流程变更都应直接修改 `.qoder/commands/query_question.md`。

## 调用方式

| 方式 | 触发条件 |
|------|---------|
| 斜杠命令 | 用户输入 `/query-question` |
| 自然语言 | 用户说"查一下历史问题"、"查阅之前的问题修复"等 |

## 执行概要

技能被调用后，查阅 `med_ai_assistant_1.0_bs_backend/doc/问题修复` 目录下的历史问题修复文档，结合当前问题进行分析。