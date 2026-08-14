---
name: save-question
description: 总结本次问题及解决方案，保存到问题修复文档目录。通过 /save-question 斜杠命令触发。
---

# 保存问题修复（Save Question）

## 工作流来源

完整的工作流程指引定义在 `.qoder/commands/save_question.md`，**这是唯一的事实来源（Single Source of Truth）**。

> ⚠️ **禁止在本 SKILL.md 中复制命令文件的工作流内容**。任何流程变更都应直接修改 `.qoder/commands/save_question.md`。

## 调用方式

| 方式 | 触发条件 |
|------|---------|
| 斜杠命令 | 用户输入 `/save-question` |
| 自然语言 | 用户说"保存问题总结"、"记录修复方案"等 |

## 执行概要

技能被调用后，总结本次问题的根因、修复方案和验证结果，保存到 `med_ai_assistant_1.0_bs_backend\doc\问题修复` 目录。