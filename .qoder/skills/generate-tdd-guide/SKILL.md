---
name: generate-tdd-guide
description: 根据标准化模板生成TDD实施指南文档。包含项目概述、用户故事拆分（Given-When-Then）、红-绿-重构周期表、测试金字塔配置、质量门禁、ATDD Gherkin场景、风险矩阵和交付验收清单。适用于Java Spring Boot + Oracle项目模块的TDD规划。
---

# 生成 TDD 实施指南

## 概述

按照用户提供的 7 部分标准化模板，为指定项目模块生成完整的 TDD 实施指南文档（`.md` 格式）。

**文档生成路径**：`med_ai_assistant_1.0_bs_backend/doc/迭代/[模块名称]/TDD实施指南.md`

**参考文档**：
- [TDD实施指南结构规范](.qoder/rules/README.md)（本项目的 TDD 规范要求）
- [测试编写原则](med_ai_assistant_1.0_bs_backend/doc/测试/测试编写原则.md)
- [数据访问层测试编写原则](med_ai_assistant_1.0_bs_backend/doc/测试/数据访问层测试编写原则.md)
- [外部集成测试编写原则](med_ai_assistant_1.0_bs_backend/doc/测试/外部集成测试编写原则.md)
- [TDD与ATDD开发实践规范]（记忆中的开发实践规范）
- 项目中已有的 TDD 实施指南案例：`med_ai_assistant_1.0_bs_backend/doc/迭代/质量控制驱动的临床实践/TDD实施指南.md`

---

## 执行步骤

### 步骤一：收集信息

在编写之前，先向用户明确以下信息：

1. **项目/模块名称**：要开发的模块叫什么？
2. **项目描述**：核心功能是什么？业务价值是什么？
3. **涉及的技术栈**：后端（JPA/WebFlux/Service）、前端（Vue组件）、数据库（Oracle表）
4. **开发周期**：预计需要多少天/周？分几个迭代？
5. **质量目标**：测试覆盖率目标是多少？
6. **模块包含的功能点列表**：需要拆分为哪些用户故事？
7. **涉及的数据库表**：需要操作哪些 Oracle 表？
8. **参考方案文档**：是否有已经完成的方案设计文档可供参考？

### 步骤二：生成文档

按照以下 7 部分结构化模板生成 TDD 实施指南：

---

## 模板结构

### 1. 项目概述

> 文档头信息：
> ```
> > **文档版本**：v1.0.0
> > **创建日期**：[当前日期]
> > **关联方案**：[方案文档路径].md
> > **测试框架**：JUnit 5 + Mockito + Spring Boot Test（后端）/ Cypress（前端E2E）
> ```

#### 1.1 项目名称

**`[项目名称]`**（`[英文标识]`）

#### 1.2 项目描述

简要描述项目目标和核心功能，说明业务价值。

**核心架构/流程**（如有多个阶段/步骤）：
1. **第一阶段：** [描述]（`[Service类名]`）：[一句话说明]
2. **第二阶段：** [描述]（`[Service类名]`）：[一句话说明]
3. ...

#### 1.3 开发周期

| 迭代 | 内容范围 | 预估工期 | 对应优先级 |
|------|---------|----------|-----------|
| 迭代一 | [模块/功能范围] | [时间] | [P0/P1/P2] |
| 迭代二 | [模块/功能范围] | [时间] | [P0/P1/P2] |

**总预估工期**：[总时间]（含联调、测试、修复）

#### 1.4 质量目标

| 指标 | 目标值 |
|------|--------|
| 后端单元测试覆盖率 | ≥ 85% |
| 后端 Service 方法覆盖率 | 100% |
| 后端 Controller 接口覆盖率 | 100% |
| 前端 Cypress E2E 核心流程覆盖 | 100%（[核心流程描述]） |
| 编译零错误 | 强制 |
| SonarQube 代码异味 | 0 个 Critical/Blocker |
| API 接口文档覆盖率 | 100% |

---

### 2. 用户故事拆分

为每个模块生成用户故事，**每个用户故事必须包含三个要素**：

格式：
```
#### US-[模块缩写]-[序号]: [用户故事标题]
- **用户角色**：作为[角色]
- **需求描述**：我需要[功能]，以便[价值]
- **验收标准**：
  - Given [前置条件]
  - When [操作]
  - Then [预期结果]
  - And [附加验证，可选]
```

**用户故事编写原则**：
- 每个用户故事代表一个**可独立交付**的功能增量
- 验收标准必须使用 **Given-When-Then** 格式
- 验收标准必须**可测试**（有明确的验证方法）
- 优先按**垂直切片**拆分（端到端功能），而非按技术层（前端/后端/数据库）

---

### 3. TDD 实施计划

#### 3.1 任务分解

将每个用户故事分解为具体的开发任务，每个任务包含：

```
**任务名称**：[具体任务描述]

**红阶段**（编写失败测试用例清单）：
- [ ] 测试用例1：[描述]
- [ ] 测试用例2：[描述]
- [ ] ...

**绿阶段**（最小实现方案）：
- [ ] [实现步骤1]
- [ ] [实现步骤2]
- [ ] ...

**重构阶段**（优化方向）：
- [ ] [重构点1]
- [ ] [重构点2]
- [ ] ...
```

> 编写测试时，参考 [tdd](skill:../skills/tdd/SKILL.md) 技能的 8 步流程执行：
> - **数据访问层测试**必须使用 `@TestConfig` 注解
> - **外部集成测试**必须使用 `SystemAvailabilityChecker` API
> - **业务逻辑层测试**使用 `@ExtendWith(MockitoExtension.class)`
> - 只运行 `mvn test -Dtest=XxxTest` 单个测试，禁止全量测试

#### 3.2 红-绿-重构周期表

创建周期跟踪表格：

| 周期 | 任务描述 | 红（失败测试） | 绿（最小实现） | 重构 | 预估时间 | 状态 |
|------|---------|---------------|---------------|------|---------|------|
| C1 | [任务描述] | [测试类名] | [实现类/方法] | [重构点] | [时间] | ⬜ |
| C2 | [任务描述] | [测试类名] | [实现类/方法] | [重构点] | [时间] | ⬜ |

---

### 4. 测试策略

#### 4.1 测试金字塔配置

| 测试层级 | 比例 | 框架/工具 | 覆盖范围 |
|---------|------|----------|---------|
| **单元测试** | 70% | JUnit 5 + Mockito | Service 层业务逻辑、工具类、DTO 转换 |
| **集成测试** | 20% | @DataJpaTest（数据访问层） + JDK HttpClient（外部集成） | Repository 查询、存储过程、HTTP 接口 |
| **E2E 测试** | 10% | Cypress | 前端核心业务流程 |

#### 4.2 测试层配置参考

**数据访问层测试**（使用 `@TestConfig`）：
```java
@TestConfig(description = "[模块名]数据访问层测试")
class XxxRepositoryTest {
    @Autowired
    private XxxRepository repository;

    @BeforeEach
    void setUp() {
        // 准备测试数据（@Transactional 自动回滚）
    }

    @Test
    void testFindByXxx_ValidInput() {
        var result = repository.findByXxx(param);
        assertNotNull(result);
    }
}
```

**业务逻辑层测试**（Mockito）：
```java
@ExtendWith(MockitoExtension.class)
class XxxServiceTest {
    @Mock
    private XxxRepository repository;
    @InjectMocks
    private XxxService service;

    @Test
    void processXxx_ShouldReturnResultWhenValidInput() {
        when(repository.findById(1L)).thenReturn(Optional.of(entity));
        var result = service.process(1L);
        assertNotNull(result);
        verify(repository).findById(1L);
    }
}
```

**外部集成测试**（使用 `SystemAvailabilityChecker`）：
```java
class XxxExternalIntegrationTest {
    private static String baseUrl;
    private static final HttpClient client = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5)).build();

    @BeforeAll
    static void checkSystemAvailability() {
        baseUrl = SystemAvailabilityChecker.resolveBaseUrl();
        SystemAvailabilityChecker.ensureSystemRunning(baseUrl);
    }

    @Test
    void healthEndpointShouldBeUp() throws Exception {
        // ...
    }
}
```

---

### 5. 质量保障体系

#### 5.1 代码质量门禁

| 质量指标 | 目标值 | 检查工具 | 执行时机 |
|---------|--------|---------|---------|
| 测试覆盖率 | ≥ 85% | JaCoCo | `mvn verify` |
| 编译错误 | 0 | Java Compiler | `mvn compile` |
| Critical/Blocker 代码异味 | 0 | SonarQube | CI 流水线 |
| API 文档覆盖率 | 100% | Swagger/OpenAPI | `mvn package` |
| 代码格式规范 | 无违规 | Checkstyle | `mvn verify` |

#### 5.2 ATDD Gherkin 场景

对关键用户故事生成 Gherkin 场景描述：

```gherkin
Feature: [功能名称]
  As a [角色]
  I want [功能]
  So that [价值]

  Scenario: [场景描述]
    Given [条件]
    When [操作]
    Then [结果]

  Scenario: [边界场景描述]
    Given [条件]
    When [操作]
    Then [结果]
```

> 后端 Controller 接口的 ATDD 场景需包含 HTTP 请求方法、路径、请求体和响应体验证。

---

### 6. 风险管理

#### 6.1 风险识别与缓解

| 风险类型 | 具体风险描述 | 影响程度 | 发生概率 | 缓解措施 |
|---------|-------------|---------|---------|---------|
| **技术风险** | [如：Oracle 存储过程兼容性] | 高/中/低 | 高/中/低 | [具体措施] |
| **需求变更风险** | [如：质控规则调整] | 高/中/低 | 高/中/低 | [具体措施] |
| **集成风险** | [如：前端后端接口不一致] | 高/中/低 | 高/中/低 | [具体措施] |
| **数据风险** | [如：测试数据不充分] | 高/中/低 | 高/中/低 | [具体措施] |

#### 6.2 风险缓解策略说明

对每个高风险项提供详细缓解方案。

---

### 7. 交付与验收

#### 7.1 迭代交付计划

| 时间点 | 交付物 | 验收标准 | 负责人 |
|-------|--------|---------|-------|
| [日期] | [交付物1] | [验收标准] | [角色] |
| [日期] | [交付物2] | [验收标准] | [角色] |

#### 7.2 验收检查清单

```markdown
- [ ] **功能验收**
  - [ ] 所有用户故事的验收标准均已满足
  - [ ] 边界条件和异常场景已验证
  - [ ] API 接口文档与实际实现一致

- [ ] **测试验收**
  - [ ] 单元测试覆盖率 ≥ 85%
  - [ ] Service 方法覆盖率达到 100%
  - [ ] Controller 接口覆盖率达到 100%
  - [ ] 所有测试通过（`mvn test -Dtest=XxxTest`）
  - [ ] 测试文件无冗余（已审查清理）

- [ ] **代码质量验收**
  - [ ] 编译零错误
  - [ ] SonarQube 无 Critical/Blocker 问题
  - [ ] 遵循项目编码规范（01-java-backend / 02-vue-frontend）
  - [ ] 无患者 PII 硬编码
  - [ ] 无数据库凭据硬编码

- [ ] **文档验收**
  - [ ] TDD 实施指南文档完整
  - [ ] API 接口文档已更新
  - [ ] 更新日志已记录
```

> **测试策略**：先在测试环境**开发模式**下测试通过，再在 **Docker 模式**下验证。

---

## 注意事项

- **文档语言**：使用中文编写（技术术语和技术名词可用英文）
- **文档命名**：`TDD实施指南.md`
- **文档路径**：`med_ai_assistant_1.0_bs_backend/doc/迭代/[模块名称]/TDD实施指南.md`
- **参考案例**：项目中已有的 [`质量控制驱动的临床实践引擎 TDD实施指南.md`](med_ai_assistant_1.0_bs_backend/doc/迭代/质量控制驱动的临床实践/TDD实施指南.md) 可作为格式参考
- **方案文档关联**：如果已有方案设计文档，在"关联方案"字段引用，避免重复描述
- **用户故事数量**：每个模块建议 3-6 个用户故事，每个故事 2-4 个验收标准
- **测试用例数量**：每个用户故事的测试用例不少于 3 个（正常 + 边界 + 异常）
