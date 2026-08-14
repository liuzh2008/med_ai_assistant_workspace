---
name: generate-qc
description: 编写质控标准。按照质控标准编写工作流程，创建或更新病历质控标准文档。通过 /generate-qc 斜杠命令触发。
---

# 编写质控标准（Generate QC）

## 工作流来源

完整的工作流程指引定义在 `.qoder/commands/generate_qc.md`，**这是唯一的事实来源（Single Source of Truth）**。

> ⚠️ **禁止在本 SKILL.md 中复制命令文件的工作流内容**。任何流程变更都应直接修改 `.qoder/commands/generate_qc.md`。

## 调用方式

| 方式 | 触发条件 |
|------|---------|
| 斜杠命令 | 用户输入 `/generate-qc` |
| 自然语言 | 用户说"编写质控标准"、"创建质控规则"等 |

## 执行概要

技能被调用后，先读取 `med_ai_assistant_1.0_bs_backend\doc\迭代\质量控制驱动的临床实践\质控标准编写工作流程.md`，然后按该文档的流程编写质控标准。