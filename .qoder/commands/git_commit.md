---
description:github提交并推送。需要注意版本号。
---
请按以下步骤完成任务，严格执行每个步骤的验证检查点：

## 第0步：全仓库扫描——确认变更范围
在每个Git仓库中分别执行 `git status` 和 `git diff --name-only HEAD`，列出所有未提交的变更文件清单。
- 后端仓库：cd med_ai_assistant_1.0_bs_backend → git status
- 前端仓库：cd med_ai_assistant_1.0_bs_vue → git status
- 根仓库：在项目根目录 → git status

将所有变更文件按仓库分类汇总，明确哪些文件需要提交、哪些应忽略。

### .qoder 目录提交规则
- **需要提交**：.qoder/repowiki/（项目Wiki文档）、.qoder/skills/（自定义技能）、.qoder/rules/（项目规则）
- **禁止提交**：.qoder/agents/（AI工具临时文件）、.qoder/plans/（计划临时文件）、*.diff 文件、review_diff.txt 等临时生成文件

检查点：确认已列出三个仓库的全部变更文件（含 .qoder 目录中需提交的文件），无遗漏。

## 第1步：接口文档更新
如果后端接口有新增、修改或删除，在 `med_ai_assistant_1.0_bs_backend/doc/接口` 目录下的对应接口文档中记录。
如果本次无后端接口变更，跳过此步。

接口描述需包含以下内容（标题为正文、黑体）：
- 接口路径
- 功能说明
- 请求参数（非表格格式）
- 响应格式
- 业务逻辑
- 响应示例
- 相关文件路径

检查点：确认接口文档已更新且格式正确，或确认无接口变更可跳过。

## 第2步：清理临时文件与代码注释
1. 删除临时生成的测试文件（如 .qoder/review_diff.txt、.qoder/promptresult_fix_diff.txt、.qoder/PromptPollingService.diff 等diff文件）。
2. 检查代码中是否残留 console.log、debugger 等调试语句，如有则清除。
3. 对新增或修改的代码文件使用 JSDoc 注释进行详细注释（Java后端使用Javadoc注释）。

检查点：确认临时文件已删除，调试语句已清除，代码注释已添加。

## 第3步：更新版本号
分别在以下文件中更新版本号，在保持前缀 0.9 不变的前提下，将后面的数字整体加1
- 格式为 "version": "0.9.xxx",
- med_ai_assistant_1.0_bs_vue/package.json 中的 version 字段
- med_ai_assistant_1.0_bs_backend/pom.xml 中的 version 字段

检查点：
- 确认两个文件的版本号一致且递增正确。
- 修改后立即执行 node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'));console.log('OK')" 验证

## 第3步：生成更新日志
总结本次任务变更，生成更新日志并添加到当日日志文件的尾部：
- 前端日志：med_ai_assistant_1.0_bs_vue/docs/更新日志/{yyyy-MM-dd}.md
- 后端日志：med_ai_assistant_1.0_bs_backend/doc/更新日志/{yyyy-MM-dd}.md

要求：
- 每天只能有一个更新日志文件（同一天追加到现有文件尾部）
- 文件名格式示例：2025-12-06.md

检查点：确认前后端更新日志文件已创建或追加，且内容完整。

## 第5步：更新根目录更新小结
严格按照以下格式修改 `D:\MedAiAssistant 1.0\MedAiAssistant 1.0 BS\更新小结.md`：

### {yyyy-MM-dd} {HH:mm}
#### 版本号：{版本号}，更新：
- {简要说明更新内容}

要求：
- 不添加其他内容
- 将本次更新小结添加到文档的最前面（按时间倒序排列）

检查点：确认更新小结格式正确且位于文档最前面。

## 第6步：Git提交与推送
### 提交前检查
- 检查 package.json 中 version 字段后是否有逗号缺失
- 再次在三个仓库中分别执行 git status，确认所有应提交文件均已变更
- 对照第0步的变更清单，确认无遗漏文件

### 分仓库提交（严格执行以下顺序）

**后端仓库提交：**
cd med_ai_assistant_1.0_bs_backend
git add {后端所有应提交文件，逐个列出}
git status ← 验证暂存区文件清单
git commit -m "v{版本号}: {功能描述}"

**前端仓库提交：**
cd med_ai_assistant_1.0_bs_vue
git add {前端所有应提交文件，逐个列出}
git status ← 验证暂存区文件清单
git commit -m "v{版本号}: {功能描述}"

**根仓库提交：**
cd "D:\MedAiAssistant 1.0\MedAiAssistant 1.0 BS"
git add 更新小结.md .qoder/repowiki/ .qoder/skills/ .qoder/rules/
git status ← 验证暂存区文件清单，确认不包含 .qoder/agents/ 和 .qoder/plans/
git commit -m "v{版本号}: {功能描述}"

### 推送
三个仓库提交完成后，依次通过SSH执行 git push：
cd med_ai_assistant_1.0_bs_backend ; git push
cd med_ai_assistant_1.0_bs_vue ; git push
cd "D:\MedAiAssistant 1.0\MedAiAssistant 1.0 BS" ; git push

要求：
- 前端和后端必须分开提交
- 需要提交根目录下的更新小结.md 和 .qoder/ 下需提交的文件
- 先 git add 添加文件，再 git commit 提交
- 三个仓库使用相同的提交信息
- 提交前必须通过 git status 验证暂存区内容

### 提交后验证
在三个仓库中分别执行 git status 和 git log --oneline -1，确认：
- 工作区干净（无非预期未提交文件）
- 最新提交记录正确

## 第7步：直接查看文件
所有文件内容查看使用直接读取文件方式，不使用 git diff 等命令行方式显示文件内容，以减少人工干预。