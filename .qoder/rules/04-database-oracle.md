---
trigger: always_on
alwaysApply: true
---

## 数据库与 Oracle 规范

### 表与字段命名

- 表名：大写 + 下划线分隔，复数名词
- ✓ `PATIENTS`, `PATIENT_DIAGNOSES`, `DRG_GROUPS`
- ✗ `patients`, `PatientDiagnosis`, `t_drg_group`
- 字段映射必须显式声明：`@Column(name = "UPPER_CASE")`

### 特殊字段类型

- CLOB 字段：`@Lob` + `columnDefinition = "LONGTEXT"`
- JSON 数据：存为 String，前端负责解析，不使用数据库 JSON 类型
- 日期字段：`@JsonFormat(pattern = "yyyy-MM-dd", timezone = "GMT+8")`

```java
// ✓
@Column(name = "CONTENT", columnDefinition = "LONGTEXT")
@Lob
private String content;

@JsonFormat(pattern = "yyyy-MM-dd", timezone = "GMT+8")
private LocalDate admissionDate;

// ✗ 使用数据库JSON类型
@Column(name = "EXT_DATA")
private JsonObject extData;
```

### Repository 层

- 优先级：方法名派生 > `@Query` JPQL（禁止 Native SQL）
- 继承 `JpaRepository`，不继承其他框架 Repository

```java
// ✓ 方法名派生
List<Patient> findByHospitalIdAndStatus(String hospitalId, String status);

// ✗ 不必要的 Native SQL
@Query(value = "SELECT * FROM PATIENTS WHERE hospital_id = ?1", nativeQuery = true)
```

### 大数据量查询（防 OOM 强制规则）

- 状态查询、巡检、轮询、补偿任务等可能返回大量数据的查询，**必须分页**：使用 `Pageable` 参数限制每批数量（如每批 200 条），禁止无限制的全量返回
- 含 `@Lob` CLOB/BLOB 字段的实体，批量查询**必须使用投影查询**（只 select 需要的列），禁止实体查询全量加载 CLOB
- 实体查询固定 select 全部列且 `@Lob` 默认 EAGER；`@Basic(fetch = LAZY)` 需字节码增强，本项目未启用，不可依赖
- 巡检只需 ID/状态时用 JPQL 标量投影：`SELECT e.id FROM XxxEntity e WHERE ...`；需要详情字段时按需 `findById` 单条加载
- 批量任务推荐分页循环模式：`do { list = repo.findXxx(PageRequest.of(page, 200)); ...; page++; } while (list.size() == 200)`
- 定时巡检开头先用 `countByStatus` 短路：数量为 0 直接跳过

```java
// ✓ 分页 + 投影：CLOB 不进入 SQL
@Query("SELECT e.id FROM EncryptedDataTemp e WHERE e.status = :status")
List<String> findIdsByStatusPaged(@Param("status") DataStatus status, Pageable pageable);

// ✓ 分页循环
int page = 0;
List<String> batch;
do {
    batch = repo.findIdsByStatusPaged(status, PageRequest.of(page, 200));
    // ... 处理 batch
    page++;
} while (batch.size() == 200);

// ✗ 无分页全量实体查询（含 CLOB 会导致 OOM）
List<EncryptedDataTemp> findByStatus(DataStatus status);

// ✗ 全表加载后内存过滤
repo.findAll().stream().filter(e -> e.getStatus().equals(status));
```

### 序列管理

- 使用 Oracle 序列生成主键，通过 `@GeneratedValue` 配置策略
- 序列命名：`SEQ_{表名}`，如 `SEQ_PATIENTS`

### 事务

- `@Transactional` 标注在 Service 层，非 Controller
- 多数据源时必须指定 `transactionManager`
