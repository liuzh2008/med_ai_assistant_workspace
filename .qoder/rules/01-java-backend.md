---
trigger: always_on
alwaysApply: true
---

# Java 后端编码规范

## 包结构

`controller` / `service` / `repository` / `model` / `dto` / `exception` / `config` / `util`，子模块按业务域建子包（如 `service.qc`、`dto.qc`）。

## 命名

- ✓ `{Module}Controller` / `{Module}Service` / `{Module}Repository`
- ✓ Entity 无后缀：`Patient`、`DrgAnalysisResult`
- ✓ DTO/Request/Response 后缀：`{Xxx}DTO`、`{Xxx}Request`、`{Xxx}Response`
- ✗ 禁止 `Entity`/`Model`/`Vo` 后缀

## 依赖注入

- ✓ 构造器注入，字段声明 `private final`
- ✗ 禁止 `@Autowired` 字段注入（测试类除外）

## 日志

- ✓ 手动声明：`private static final Logger logger = LoggerFactory.getLogger(Xxx.class);`
- ✗ 禁止 `@Slf4j`（与手动声明风格不一致）

## Lombok

- ✓ Entity/DTO 使用 `@Data`
- ✗ 禁止 `@RequiredArgsConstructor`（显式写构造器）

## 事务

- ✓ 仅 Service 层 `@Transactional`，多数据源须指定 `transactionManager`
- ✗ 禁止 Controller 层 `@Transactional`

## Repository

- ✓ 简单查询用方法名派生：`findByPatientId`
- ✓ 复杂查询用 `@Query` JPQL：`SELECT d FROM DrgAnalysisResult d WHERE ...`
- ✗ 禁止 Native SQL

## 异常

- ✓ 自定义 `RuntimeException` 子类，放 `exception` 包
- ✓ Controller 层 try-catch 返回 `ResponseEntity` 适配 HTTP 状态码

## 响应

- ✓ 单资源返回 `ResponseEntity<T>`
- ✓ 集合直接返回 `List<T>` / `Page<T>`
- ✓ DTO 用工厂方法转换（`static from(Entity)` 或 `static of(...)`）

## 编码

- ✓ 全链路 UTF-8：Spring Boot encoding + Controller produces + JVM `-Dfile.encoding=UTF-8`
- ✓ 字符串/文件操作显式指定 `StandardCharsets.UTF_8`
- ✗ 禁止使用平台默认编码
