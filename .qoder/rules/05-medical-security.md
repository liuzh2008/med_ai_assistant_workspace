---
trigger: always_on
alwaysApply: true
---

## 医疗数据安全规范

### 患者 PII 保护

- 患者姓名、身份证号、手机号、医保号**禁止**写入日志
- 日志中使用脱敏占位符：`patientId={}`, 不写 `patientName={}`

```java
// ✓
logger.info("查询患者诊断: patientId={}", patientId);

// ✗
logger.info("查询患者诊断: name={}, idCard={}", patient.getName(), patient.getIdCard());
```

### 硬编码禁止

- 医院 ID、文件路径、服务器地址禁止硬编码，必须配置驱动
- 多医院配置放在 `config/hospitals/` 目录，通过 `application-{profile}.properties` 加载

```java
// ✓
@Value("${hospital.id}") private String hospitalId;

// ✗
private String hospitalId = "HOSP001";
```

### AI 生成内容标识

- AI 生成内容必须标记 `source: AI_GENERATED`，与临床录入区分
- 前端展示时需有视觉标识表明为 AI 生成

```java
// ✓
diagnosis.setSource("AI_GENERATED");

// ✗ — 未标识来源
diagnosis.setSource(null);
```

### 认证与加密

- JWT 认证，Spring Security 配置白名单路径
- SQL 必须参数化查询，禁止字符串拼接

```java
// ✓ 参数化
@Query("SELECT p FROM Patient p WHERE p.idCard = :idCard")
// ✗ 拼接
@Query(value = "SELECT * FROM PATIENTS WHERE id_card = '" + idCard + "'", nativeQuery = true)
```

### 配置安全

- 密码、密钥等敏感信息**禁止**提交 Git，使用 `.env` 或环境变量
- 密码哈希使用 Argon2，禁止 MD5/SHA1
