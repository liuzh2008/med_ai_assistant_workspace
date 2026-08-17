# 项目指令（AGENTS.md）

## DSH 双实例拓扑（3080 正式 / 3081 开发，避免误会）
| 项 | 3080 —— 正式/使用实例（MedAiAssistant 关联） | 3081 —— 开发/插件沙箱实例（dev） |
|---|---|---|
| 代码 checkout | `C:\Users\Administrator\Documents\Qoder\2026-08-13\chat-1\deepseek-harness` | `C:\Users\Administrator\Documents\Qoder\2026-08-13\chat-1\deepseek-harness-dev` |
| DSH_HOME | `C:\Users\Administrator\.dsh` | `C:\Users\Administrator\.dsh-dev` |
| 启动脚本 | 根目录 `start-dsh.cmd`：`pnpm dsh web --trusted-host 100.66.1.3 --allow-remote-privileged-methods` | 根目录 `start-dsh-dev.cmd`：`pnpm dsh web --port 3081 --trusted-host 100.66.1.3 --allow-remote-privileged-methods` |
| 依赖 | MedAi 后端 MCP 网关 127.0.0.1:8081（启动前就绪检查，网关挂则闪退） | 零 MedAi 依赖，不检查 8081，后端挂了也能独立启动 |
| 状态 | 正式使用，进程可操作（重启走 start-dsh.cmd / restart-dsh.ps1） | **铁律：永远不要杀掉 3081 开发实体** |

## 铁律（最高优先级，用户明确要求，违反即违规）
- **永远不要杀掉 3081 开发实体**：端口 3081 上运行的 DSH web 实例（node / `apps/cli/src/bin.ts`，命令行含 `--port 3081`，DSH_HOME=~/.dsh-dev 的 dev 沙箱）是不可触碰的开发实体。禁止 kill / Stop-Process / taskkill / 重启其进程或子进程树，禁止修改其启动配置。需要重启 DSH 时只能操作 3080 正式实例（`start-dsh.cmd` / `restart-dsh.ps1`）；3081 永远保持运行。

## 项目身份
- 医疗AI辅助系统 (MedAiAssistant)：Java 21 + Spring Boot 3.5.8 + Oracle 21c / Vue 3.2.13 + Element Plus；主服务器 + 执行服务器双节点。
- 技术细节见 `.qoder/rules/`；领域知识查 `.qoder/repowiki/zh/content/`。

## 长期记忆协议（每会话自动执行，无需用户要求）
本项目有自动维护的长期记忆库 `记忆库/`，agent 必须：

1. **会话开始时**：read `记忆库/索引.md`，恢复项目记忆上下文。
2. **会话中**：出现关键信息（决策、踩坑、配置事实、可复用命令、会话产出）时，按 `memory-manager` 技能规范立即写入对应主题文件。
3. **会话结束时**：未落盘的产出追加到 `记忆库/会话记忆.md`（按日期分区）。

写入格式：`### YYYY-MM-DD 标题` + 可复现细节（路径/命令/原因）。已有条目则更新，不重复添加。

## 全局安全约束
- 禁止日志输出患者 PII（姓名、身份证号、手机号、医保号）。
- 禁止硬编码医院 ID，必须从配置读取。
