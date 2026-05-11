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

### 序列管理

- 使用 Oracle 序列生成主键，通过 `@GeneratedValue` 配置策略
- 序列命名：`SEQ_{表名}`，如 `SEQ_PATIENTS`

### 事务

- `@Transactional` 标注在 Service 层，非 Controller
- 多数据源时必须指定 `transactionManager`
