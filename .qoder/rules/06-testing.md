---
trigger: always_on
alwaysApply: true
---

## 测试规范

### 测试顺序（强制）

1. **先开发模式测试**：本地 `mvn spring-boot:run` + `npm run serve`
2. **开发模式通过后** → 再 Docker 模式测试
- 不可跳过开发模式直接 Docker 测试

### 后端单元测试

- 使用 `@MockitoBean`（Spring Boot 3.5+），**不用** `@MockBean`（已弃用）
- 以 Service 层测试为主，Controller 层按需

```java
// ✓
@MockitoBean
private PatientRepository patientRepository;

// ✗ 已弃用
@MockBean
private PatientRepository patientRepository;
```

### 测试命名

- 格式：`{方法名}_{场景}_{期望结果}`
- ✓ `findByName_当患者存在_返回患者对象`
- ✓ `save_当身份证重复_抛出异常`
- ✗ `testPatient`, `test1`, `testSave`

### 前端测试

- E2E 测试使用 Cypress，测试文件放在 `cypress/` 目录
- 关键业务流程（登录、病历质控、DRG 分析）必须有 E2E 覆盖

### 覆盖率策略

- **不强制覆盖率数字**，但以下核心逻辑必须有测试：
  - 病历质控规则引擎
  - DRG 分组计算
  - 患者数据解密流程
  - 多医院配置加载

### 测试执行

- 禁止运行 `mvn test` 全量测试（耗时长且可能影响环境）
- 单测运行：`mvn test -Dtest=XxxTest`
