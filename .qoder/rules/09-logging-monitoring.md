---
trigger: always_on
alwaysApply: true
---

## 日志与监控规范

### 日志框架

- 统一使用 SLF4J + Logback，禁止其他日志框架直接使用
- Logger 声明：`private static final Logger logger = LoggerFactory.getLogger(XxxService.class);`
- ✗ 禁止 `@Slf4j`（与手动声明风格不一致，见 01-java-backend）

### 日志级别

| 级别 | 使用场景 | 示例 |
|------|---------|------|
| debug | 参数值、中间步骤 | `logger.debug("查询参数: hospitalId={}", id)` |
| info | 业务成功、状态变更 | `logger.info("创建成功: id={}", id)` |
| warn | 异常但可恢复 | `logger.warn("缓存未命中, 回退查询: key={}", key)` |
| error | 业务失败 + 堆栈 | `logger.error("DRG计算失败: patientId={}", id, e)` |

### 日志格式

- 中文描述 + 关键参数占位符，禁止字符串拼接

```java
// ✓
logger.info("创建成功: id={}", id);
logger.error("质控规则执行失败: ruleId={}", ruleId, exception);

// ✗ 字符串拼接
logger.info("创建成功: id=" + id);
// ✗ 无上下文
logger.info("操作成功");
```

### 禁止项

- **禁止** `System.out.println`，一律用 logger
- **禁止** 患者PII入日志（姓名、身份证、手机号、医保号）
- **禁止** 在循环内打印 debug 日志（性能影响）

### 监控

- 健康检查端点：`/api/health`，返回服务状态、数据库连接状态
- Spring Actuator 按需开放端点，生产环境禁止暴露全部端点
