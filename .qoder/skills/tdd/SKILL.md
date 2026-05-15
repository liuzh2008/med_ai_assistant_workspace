---
name: tdd
description: 测试驱动开发（TDD）工作流，遵循8步红-绿-重构流程。包含测试分层策略、性能检查、测试质量评价与文件清理。支持数据访问层、外部集成、业务逻辑层和控制器层测试。
---

# TDD 测试驱动开发

## 概述

本技能实现了**8步 TDD 流程**，在经典红-绿-重构基础上增加了性能测试、测试评价、冗余清理等工程实践，适用于本项目 Java 21 + Spring Boot 3.5 + Oracle 21c 技术栈。

所有测试遵循以下核心原则：
- **最小化加载**：按测试类型选择最小化上下文，详见[测试编写原则](med_ai_assistant_1.0_bs_backend/doc/测试/测试编写原则.md)
- **测试分层**：根据测试类型选择对应的加载策略和工具
- **数据安全**：禁止日志输出患者 PII，禁止硬编码凭据

---

## 阶段零：测试类型选择

在开始 TDD 前，先根据被测代码的类型选择对应的测试策略：

| 测试类型 | 加载策略 | 注解/工具 | 适用场景 |
|---------|---------|----------|---------|
| **数据访问层** | `@DataJpaTest` 切片 | `@TestConfig` | Repository、JPA 查询、存储过程 |
| **业务逻辑层** | Mockito 扩展 | `@ExtendWith(MockitoExtension.class)` | Service 层单元测试 |
| **控制器层** | WebFlux 切片 | `@WebFluxTest` | WebFlux 控制器测试 |
| **外部集成** | 纯 HTTP 客户端 | JDK `HttpClient` | 已启动服务的 HTTP 接口验证 |
| **配置类** | `@SpringBootTest(classes={...})` | 最小化配置类加载 | 配置 Bean 验证 |

> **数据访问层测试必须使用 `@TestConfig` 注解**（位于 `src/test/java/com/example/medaiassistant/config/TestConfig.java`）
>
> **外部集成测试必须使用 `SystemAvailabilityChecker` API**（位于 `com.example.medaiassistant.testutil.SystemAvailabilityChecker`），详见[外部集成测试编写原则](med_ai_assistant_1.0_bs_backend/doc/测试/外部集成测试编写原则.md)

---

## 8 步 TDD 流程

### 步骤一 🔴 红阶段：生成会失败的测试用例

**目标**：编写一个编译失败或运行失败的测试用例。

执行要求：
1. 根据测试类型选择对应的**测试分层策略**（见阶段零）
2. 只包含本次任务**必要的导入和注解**
3. 只添加本次任务**相关的测试配置**
4. 每个测试用例只验证**一个特定场景**
5. 使用 `test[方法名]_[场景描述]` 或 `[方法名]Should[预期行为]When[条件]` 命名规范
6. 验收标准使用 **Given-When-Then** 格式
7. 测试数据准备使用 `@BeforeEach` + `@Transactional` 回滚

```java
// 示例：数据访问层测试
@TestConfig(description = "XX功能数据访问层测试")
class XxxRepositoryTest {

    @Autowired
    private XxxRepository repository;

    @BeforeEach
    void setUp() {
        // 准备测试数据
    }

    @Test
    void testFindByXxx_ValidInput() {
        // Given - 准备测试数据（已在 setUp 中完成）
        // When - 执行查询
        var result = repository.findByXxx(param);
        // Then - 验证结果
        assertNotNull(result);
        assertFalse(result.isEmpty());
    }
}
```

```java
// 示例：业务逻辑层测试
@ExtendWith(MockitoExtension.class)
class XxxServiceTest {

    @Mock
    private XxxRepository repository;

    @InjectMocks
    private XxxService service;

    @Test
    void processXxx_ShouldReturnResultWhenValidInput() {
        // Given
        when(repository.findById(1L)).thenReturn(Optional.of(entity));
        // When
        var result = service.process(1L);
        // Then
        assertNotNull(result);
        verify(repository).findById(1L);
    }
}
```

### 步骤二 🔴 运行红阶段测试

**目标**：确认测试确实会失败，验证测试的有效性。

执行要求：
1. **只运行本次任务相关的测试**，不要运行 `mvn test` 全量测试
2. Windows 环境使用过滤输出：
   ```bash
   mvn test -Dtest=XxxTest 2>&1 | findstr /C:"Tests run" /C:"BUILD"
   ```
3. 预期结果：测试编译失败或运行失败
4. **不要因为测试未通过而修改系统的配置文件**

### 步骤三 🟢 绿阶段：生成最小化代码

**目标**：编写使测试通过的最少代码。

执行要求：
1. 只实现**必要的功能**，不进行过度设计
2. 保持代码简洁
3. 在关键业务逻辑节点添加详细日志（遵循日志规范）

### 步骤四 🟢 运行绿阶段测试 + 修改注释

**目标**：确认测试通过，并完善代码注释。

执行要求：
1. 运行测试确认通过
2. 检查并完善 Javadoc/行内注释
3. 注释应说明"为什么这样做"，而非"做了什么"
4. 遵循项目注释规范：
   - Java：Javadoc 格式 `/** ... */`
   - 日志信息使用中文描述 + 参数占位符

### 步骤五 🟢 性能测试（按需）

**目标**：如果本次任务涉及对性能有较大影响的代码，在测试中嵌入轻量级性能检查。

执行要求：
1. 使用 `@Timeout` 注解控制单用例执行时间
2. HTTP 客户端设置合理的超时时间（连接超时 5s，请求超时 10s）
3. 性能断言：
   ```java
   @Test
   @Timeout(value = 1, unit = TimeUnit.SECONDS)
   void testPerformance() {
       long start = System.currentTimeMillis();
       // 执行测试逻辑
       long elapsed = System.currentTimeMillis() - start;
       assertTrue(elapsed < 1000, "响应时间应小于1秒");
   }
   ```

### 步骤六 🔵 测试评价与完善

**目标**：对本次任务的测试文件进行评价并完善。

评价维度：
1. **覆盖率**：是否覆盖了正常场景、边界条件（空值/null/无效参数）、异常场景
2. **可读性**：测试名称是否清晰描述意图，断言是否有描述性错误信息
3. **独立性**：每个测试是否只验证一个场景
4. **性能**：单个测试用例是否 < 1 秒
5. **安全性**：是否包含硬编码凭据或患者 PII

完善方式：
- 补充缺失的场景测试
- 优化断言信息
- 添加必要的注释

### 步骤七 🔵 重构模块

**目标**：优化代码结构，保持功能不变。

执行要求：
1. 消除重复代码
2. 提高代码可读性
3. 确保所有测试继续通过
4. 重构后运行完整测试验证

### 步骤八 🔵 审查与清理

**目标**：审查是否产生了多余的测试文件，如有则删除。

执行要求：
1. 检查是否创建了不必要的测试文件
2. 确认每个测试文件都有实际价值
3. 删除冗余的测试文件
4. 确保最终测试结构清晰

---

## 日志规范

在关键业务逻辑节点添加详细日志：

| 级别 | 使用场景 | 示例 |
|------|---------|------|
| `debug` | 参数值、中间步骤 | `logger.debug("查询参数: hospitalId={}", id)` |
| `info` | 业务成功、状态变更 | `logger.info("创建成功: id={}", id)` |
| `warn` | 异常但可恢复 | `logger.warn("缓存未命中, 回退查询: key={}", key)` |
| `error` | 业务失败 + 堆栈 | `logger.error("处理失败: patientId={}", id, e)` |

```java
// 正确方式
private static final Logger logger = LoggerFactory.getLogger(XxxService.class);

logger.debug("入参: patientId={}, type={}", patientId, type);
logger.info("处理完成: resultId={}, status={}", resultId, status);
logger.error("处理异常: patientId={}", patientId, exception);

// 禁止
// logger.info("处理成功: name=" + patient.getName());  // 患者PII禁止入日志
// System.out.println("处理完成");  // 禁止 System.out
```

---

## 断言设计

```java
// 结果验证
assertNotNull(result);
assertFalse(result.isEmpty());
assertEquals(expectedSize, result.size());

// 边界条件
assertTrue(result.isEmpty());     // 空结果
assertThrows(ExpectedException.class, () -> { /* ... */ });

// 分页验证
assertEquals(expectedTotalElements, page.getTotalElements());
assertEquals(expectedPageSize, page.getSize());
```

---

## 测试模板参考

### 数据访问层测试（使用 @TestConfig）

详见[数据访问层测试编写原则](med_ai_assistant_1.0_bs_backend/doc/测试/数据访问层测试编写原则.md)

```java
@TestConfig(description = "XX功能数据访问层测试")
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

### 外部集成测试（使用 SystemAvailabilityChecker）

详见[外部集成测试编写原则](med_ai_assistant_1.0_bs_backend/doc/测试/外部集成测试编写原则.md)

```java
class XxxExternalIntegrationTest {
    private static String baseUrl;
    private static final HttpClient client = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    @BeforeAll
    static void checkSystemAvailability() {
        baseUrl = SystemAvailabilityChecker.resolveBaseUrl();
        SystemAvailabilityChecker.ensureSystemRunning(baseUrl);
    }

    @Test
    void healthEndpointShouldBeUp() throws Exception {
        String url = baseUrl.endsWith("/") ? baseUrl + "actuator/health" : baseUrl + "/actuator/health";
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(10))
                .GET()
                .build();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        assertEquals(200, response.statusCode(), "HTTP状态码应为200");
    }
}
```

### 业务逻辑层测试

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

---

## 注意事项

- **严禁跳步**：不可跳过红阶段直接写实现代码
- **证据驱动**：每个阶段结论需有测试结果支撑
- **按需加载**：只加载测试所需的最小上下文
- **配置不修改**：不要因为测试未通过而修改系统配置文件
- **凭据安全**：数据库凭据通过 `${TEST_DB_URL}` 等环境变量注入，严禁硬编码
- **PII 保护**：患者姓名、身份证号、手机号、医保号禁止写入日志
- **禁止全量测试**：只运行 `mvn test -Dtest=XxxTest` 单个测试
- **Windows 兼容**：使用 `findstr` 替代 `grep` 过滤输出
