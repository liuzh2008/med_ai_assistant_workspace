---
trigger: always_on
alwaysApply: true
---

## Git 工作流规范

### 三仓库协同

| 仓库 | 目录 | 独立提交 |
|------|------|---------|
| 后端 | `med_ai_assistant_1.0_bs_backend/` | ✓ |
| 前端 | `med_ai_assistant_1.0_bs_vue/` | ✓ |
| 根目录 | 项目根 | ✓（含 `.qoder/`） |

- `.qoder/` 目录归**根仓库**管理，不在子仓库中提交

### Commit Message 格式

```
type(scope): 中文描述
```

| type | 用途 |
|------|------|
| feat | 新功能 |
| fix | 修复缺陷 |
| refactor | 重构（不改变行为） |
| docs | 文档 |
| chore | 构建/配置/依赖 |
| style | 格式调整 |
| test | 测试 |

- ✓ `feat(质控): 新增病种匹配规则引擎`
- ✗ `update code`, `fix bug`, `修改了接口`

### 版本号同步

- 前后端版本号必须同步更新，格式 `0.9.x`
- 后端：`pom.xml` 的 `<version>`
- 前端：`package.json` 的 `version`

### 更新日志

- 每次功能/修复提交，在 `doc/更新日志/` 下生成当日 `.md` 文件
- 文件名：`yyyy-MM-dd.md`，同日追加，不覆盖
- 内容含：修改类型、影响范围、简要描述
