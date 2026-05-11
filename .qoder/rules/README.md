---
trigger: manual
description: "项目规则体系说明文档，非自动加载规则"
---

# 项目规则体系建设文档

## 概述

本目录包含 MedAiAssistant 医疗AI辅助系统的完整项目规则体系，供 Qoder AI 辅助开发时自动加载遵循。

- **建设日期**：2026-05-11
- **版本**：v0.9.081
- **维护方式**：直接编辑对应规则文件，提交到根仓库

---

## 设计原则（基于行业调研）

1. **具体性** — 每条规则必须是可验证的约束，而非模糊的"写好代码"
2. **加法性** — 只写AI默认不会做的规则，避免冗余
3. **精简性** — 每个规则文件控制在300-500字以内，避免AI注意力分散
4. **正反例对比** — 用 ✗/✓ 示例让AI快速理解
5. **关注点分离** — 每个文件专注一个主题，数字前缀排序
6. **分层递进** — 主规则精简，详细示例放子目录按需加载

### 行业调研参考

- awesome-cursorrules (GitHub) — 社区规则模板库
- Cursor官方 — "始终加载规则控制在200字以内"
- 学术研究 — 有效规则的三个条件：具体性、可验证性、加法性
- 反模式警示：模糊形容词、超过500字的单文件、全部始终加载、不版本化

---

## 文件结构

```
.qoder/rules/
├── README.md                             # 本文档（规则体系说明）
├── 00-project-identity.md                # 项目身份（始终加载，<200字）
├── 01-java-backend.md                    # Java/Spring Boot后端规范
├── 01-java-backend/
│   └── examples.md                       # 命名、异常处理详细示例
├── 02-vue-frontend.md                    # Vue 3前端规范
├── 02-vue-frontend/
│   └── examples.md                       # 组件、样式详细示例
├── 03-api-design.md                      # API设计规范
├── 04-database-oracle.md                 # Oracle数据库规范
├── 05-medical-security.md                # 医疗数据安全（独立规则，便于合规审查）
├── 06-testing.md                         # 测试规范
├── 07-git-workflow.md                    # Git工作流
├── 08-deployment.md                      # 部署与环境规范
└── 09-logging-monitoring.md              # 日志与监控规范
```

---

## 各规则文件内容概要

### 00-project-identity.md（始终加载，<200字）
- 项目名称、定位、核心技术栈
- 全局安全约束（患者数据不入日志、禁止硬编码医院ID）
- 核心架构一句话说明

### 01-java-backend.md
- 包结构：controller/service/repository/model/dto/exception/config/util
- 命名：{Module}Controller / {Module}Service / Entity无后缀 / {Xxx}DTO
- 依赖注入：构造器注入，禁止@Autowired字段注入
- 日志：手动Logger声明，禁止@Slf4j
- Lombok：@Data（Entity/DTO），禁止@RequiredArgsConstructor
- 事务：仅Service层@Transactional
- Repository：方法名派生 > @Query JPQL > 禁止Native SQL
- 编码：全链路UTF-8

### 02-vue-frontend.md
- 组件结构：template → script → style scoped，Options API
- Props：始终type+default，JSDoc注释
- Vuex：namespaced:true，Mutation UPPER_SNAKE_CASE，Action camelCase
- 样式：scoped + kebab-case，禁止BEM
- API：按业务域分文件，具名函数导出
- 错误处理：Action中try-catch不抛异常
- 路由：name中文，path英文kebab-case

### 03-api-design.md
- URL：/api前缀，RESTful，复数名词，kebab-case
- 响应：ResponseEntity<T>单资源，List/Page集合，DTO工厂方法
- 错误：Map含"error"字段，HTTP状态码语义正确
- Controller方法：get*/add*/update*/delete*

### 04-database-oracle.md
- 表名：大写+下划线，复数名词
- 字段：@Column(name = "UPPER_CASE")
- CLOB：@Lob + columnDefinition
- Repository：方法名派生 > JPQL > 禁止Native SQL
- 序列：SEQ_{表名}

### 05-medical-security.md
- PII禁止入日志（姓名、身份证、手机号、医保号）
- 硬编码禁止：医院ID、路径必须配置驱动
- AI内容标识：source: AI_GENERATED
- SQL参数化，禁止拼接
- 密码Argon2，敏感信息不入Git

### 06-testing.md
- 顺序：先开发模式 → 再Docker模式（强制）
- @MockitoBean（禁止@MockBean）
- 命名：{方法}_{场景}_{期望}
- 禁止mvn test全量，用-Dtest=指定

### 07-git-workflow.md
- 三仓库协同：后端/前端/根目录独立提交
- commit格式：type(scope): 中文描述
- 版本号：前后端同步 0.9.x
- 更新日志：doc/更新日志/yyyy-MM-dd.md

### 08-deployment.md
- 三环境：开发/测试/生产
- 双节点：主服务器8080 + 执行服务器8081
- Docker：docker-compose + /api/health健康检查
- 多医院：config/hospitals/ 配置驱动

### 09-logging-monitoring.md
- SLF4J + Logback，手动Logger声明
- 级别：debug参数/info成功/warn恢复/error失败+堆栈
- 格式：中文描述 + 占位符，禁止拼接
- 禁止：System.out、PII入日志、循环内debug

---

## 建设过程记录

### 执行步骤

1. **分析现有代码风格** — 从后端79个Controller/Service和前端Vue组件中提取实际编码模式
2. **生成全部规则文件** — 基于代码分析 + 业界最佳实践，两个Coding Agent并行生成
3. **整合迁移现有规则** — 将旧NormalRules.md（33.8KB）有价值内容整合，清理5个冗余文件
4. **验证与调整** — 修复4个一致性问题（@Slf4j矛盾、Native SQL力度、frontmatter缺失、PII列表）

### 已整合的旧规则来源

| 来源文件 | 整合内容 | 目标 |
|---------|---------|------|
| NormalRules.md | 中文编码全链路配置 | 01-java-backend.md + examples.md |
| NormalRules.md | Axios charset配置 | 02-vue-frontend.md + examples.md |
| importantInfor.md | 禁止mvn test全量 | 06-testing.md |

### 已删除的冗余文件

| 文件 | 删除原因 |
|------|---------|
| backend/.qoder/rules/NormalRules.md | 内容已整合，含冗余thinking-protocol |
| backend/.clinerules/deep-thinking-protocol.md | AI工具自带思考能力，完全冗余 |
| backend/.clinerules/default-rules.md | Cline专用，与Qoder无关 |
| backend/.clinerules/importantInfor.md | 内容已整合到新规则 |
| root/.clinerules/workflows/importantInformation.md | 内容已整合到新规则 |

---

## 使用说明

这套规则的主要用途是给 AI 辅助开发（Qoder）遵循，不需要额外通知团队成员手动执行。

**当前已自动生效的机制**：
- `.qoder/rules/` 下的规则文件已提交到 Git 根仓库
- 任何使用 Qoder 的人 pull 代码后，规则会**自动加载**生效
- AI 生成的代码会自动遵循这些规范

**如果团队有其他开发人员**，建议根据情况选择：

| 场景 | 是否需要通知 | 建议方式 |
|------|-------------|----------|
| 团队成员也用 Qoder/Cursor | 不需要，自动生效 | pull 代码即可 |
| 团队成员手写代码 | 可选通知 | 分享 README.md 作为编码参考 |
| 新成员入职 | 建议了解 | 指向 `.qoder/rules/README.md` |
| 代码审查时 | 可作为依据 | 引用具体规则文件 |

---

## 维护指南

### 修改规则
直接编辑对应 `.md` 文件，保持300-500字精简，提交到根仓库。

### 新增规则
1. 按数字前缀递增命名（如 `10-new-topic.md`）
2. 遵循设计原则：具体、可验证、加法性
3. 包含 ✗/✓ 正反例

### 验证规则有效性
对比有规则和无规则时AI的输出差异，如无差异则规则冗余应删除。

### 版本标记
规则头部可加 `last-verified: Spring Boot 3.5.8` 等版本标记，库升级时提醒更新。
