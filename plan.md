# 诊疗计划临床经验硬约束规则注入

## Context

LLM 已内置大部分临床知识，但偶有忽略药物使用时限等关键硬约束。需要在诊疗计划表生成流程中注入少量高优先级硬约束规则，防止 AI 输出违规建议（如建议连续使用米力农超过 7 天）。

核心原则：**只注入 LLM 容易忽略的硬约束，不重复 LLM 已知的通用知识。**

## 关注点分离架构

```
┌─ Controller（编排）──────────────────────────────────────┐
│  PatientDataController.getPatientData()                  │
│  只调用 CompositionService，不含业务逻辑                    │
└────────────────────┬─────────────────────────────────────┘
                     │
┌─ Composition（组装+格式化）────────────────────────────────┐
│  PatientDataCompositionService                          │
│  appendTreatmentClinicalRules(patientId, result)        │
│  职责：调匹配服务 → 格式化为Prompt文本 → 追加到StringBuilder│
│  对齐现有 appendTreatmentPlanData() 等模式                │
└────────────────────┬─────────────────────────────────────┘
                     │
┌─ Business Logic（匹配引擎）───────────────────────────────┐
│  TreatmentClinicalRuleService                           │
│  getMatchedRules(patientId) → List<TreatmentClinicalRule>│
│  职责：扫描医嘱 → LIKE匹配 → 去重 → 返回原始Entity        │
│  不关心Prompt格式，不关心注入方式                          │
└────────────────────┬─────────────────────────────────────┘
                     │
┌─ Data Access（纯数据）───────────────────────────────────┐
│  TreatmentClinicalRuleRepository + LongTermOrderRepo     │
│  纯查询，无业务逻辑                                        │
└─────────────────────────────────────────────────────────┘
```

**关键设计决策**：
- 匹配服务返回 `List<TreatmentClinicalRule>`（原始 Entity），**不**返回 `List<String>`（已格式化文本）
- 格式化责任上移到 `PatientDataCompositionService`，对齐其 `append*()` 系列方法模式
- Controller 只做编排，不碰业务逻辑

---

## Task 1: 新建数据库表 `TREATMENT_CLINICAL_RULES`

- **文件**：`sql-scripts/004_create_treatment_clinical_rules.sql`
- 结构参照 `DIAGNOSIS_CLINICAL_RULES`，`DIAGNOSIS_CATEGORY` → `ORDER_TYPE`
- 序列：`SEQ_TREATMENT_CLINICAL_RULES`

| 列 | 类型 | 说明 |
|---|---|---|
| RULE_ID | NUMBER(19) PK | 序列生成 |
| ORDER_TYPE | VARCHAR2(50) NOT NULL | 医嘱类型：药物/护理及监测/检查及化验/手术及操作 |
| KEYWORD_MATCH | VARCHAR2(200) NOT NULL | 匹配关键词（如"米力农""新活素"） |
| RULE_NAME | VARCHAR2(200) NOT NULL | 规则名称 |
| CLINICAL_EXPERIENCE | CLOB NOT NULL | 约束描述文本 |
| PRIORITY | NUMBER(5) DEFAULT 0 | 优先级 |
| IS_ACTIVE | NUMBER(1) DEFAULT 1 | 启用标记 |
| VERSION | VARCHAR2(50) | 版本号 |
| CREATED_TIME | TIMESTAMP DEFAULT SYSTIMESTAMP | 创建时间 |
| UPDATED_TIME | TIMESTAMP DEFAULT SYSTIMESTAMP | 更新时间 |

索引：`IDX_TCR_KEYWORD` ON `KEYWORD_MATCH`、`IDX_TCR_ACTIVE` ON `IS_ACTIVE`、`IDX_TCR_ORDER_TYPE` ON `ORDER_TYPE`

**关联优化**：`longtermorders` 表需确认 `PatientID` 列已有索引。若不存在，加 `CREATE INDEX IDX_LTO_PATIENTID ON longtermorders(PatientID)`。全量扫描时走索引避免全表扫描。

---

## Task 2: 创建 Java Entity + Repository（Data Access 层）

- **Entity**：`model/TreatmentClinicalRule.java`
  - 参照 `DiagnosisClinicalRule.java`，`orderType` 替代 `diagnosisCategory`
  - `@Table(name = "TREATMENT_CLINICAL_RULES")`
  - `@GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "SEQ_TREATMENT_CLINICAL_RULES")`
  - `clinicalExperience`：`@Lob` + `columnDefinition = "LONGTEXT"`

- **Repository**：`repository/TreatmentClinicalRuleRepository.java`
  ```java
  // 全量启用规则（按优先级降序）
  List<TreatmentClinicalRule> findAllByIsActiveTrueOrderByPriorityDesc();

  // 按关键词 LIKE 匹配（用于单条医嘱匹配）
  @Query("SELECT r FROM TreatmentClinicalRule r WHERE r.isActive = 1 "
       + "AND :orderName LIKE CONCAT('%', r.keywordMatch, '%')")
  List<TreatmentClinicalRule> findMatchingRules(@Param("orderName") String orderName);

  String findMaxVersion();
  ```

---

## Task 3: 创建种子 SQL

- **文件**：`sql-scripts/005_seed_treatment_clinical_rules.sql`

| ORDER_TYPE | KEYWORD_MATCH | RULE_NAME | CLINICAL_EXPERIENCE |
|---|---|---|---|
| 药物 | 米力农 | 米力农使用时限 | 米力农注射液连续使用时间不超过 7 天，超过 7 天增加死亡风险。若患者已连续使用接近 7 天，应在诊疗计划中评估停药或替代方案（如多巴酚丁胺或左西孟旦），并标注"[需临床复核]"。 |
| 药物 | 新活素 | 新活素使用时限 | 注射用重组人脑利钠肽（新活素）连续使用时间不超过 3 天，超过 3 天存在低血压和肾功能损害风险。若患者已连续使用接近 3 天，应在诊疗计划中评估停药，并标注"[需临床复核]"。 |

---

## Task 4: 创建 TreatmentClinicalRuleService（Business Logic 层）

- **文件**：`service/TreatmentClinicalRuleService.java`

**唯一对外方法**：

```java
/**
 * 根据患者ID扫描当前医嘱，返回匹配到的临床硬约束规则列表（原始Entity）。
 *
 * <p>不负责格式化——格式化是 PatientDataCompositionService 的职责。</p>
 *
 * @param patientId 患者ID
 * @return 匹配到的规则列表（去重，按优先级降序），无匹配返回空列表
 */
public List<TreatmentClinicalRule> getMatchedRules(String patientId);
```

**内部逻辑**：
1. 调用 `longTermOrderRepository` 获取患者当前活跃医嘱（长期 + 近期临时）
2. 遍历每条医嘱的 `orderName`，调 `treatmentClinicalRuleRepository.findMatchingRules(orderName)`
3. 以 `RULE_ID` 去重，按 `priority` 降序排列
4. 返回 `List<TreatmentClinicalRule>`（原始 Entity，不格式化）

---

## Task 5: 在 PatientDataCompositionService 中追加规则（Composition 层）

- **文件**：`service/PatientDataCompositionService.java`（新增方法 + 构造器注入）
- **构造器变更**：新增 `private final TreatmentClinicalRuleService` 字段，追加到构造器参数列表

**新增方法**，对齐现有 `appendTreatmentPlanData()` / `appendAdmissionRecordOriginalContent()` 模式：

```java
/**
 * 追加临床硬约束规则到患者数据。
 *
 * <p>调用 TreatmentClinicalRuleService.getMatchedRules() 获取匹配到的规则列表，
 * 格式化为【临床硬约束规则（必须严格遵守）】块追加到 result 末尾。</p>
 *
 * <p>空安全：无匹配规则时静默跳过，异常时记录 warn 日志并继续。</p>
 *
 * @param patientId 患者ID
 * @param result    结果字符串构建器（会被直接修改）
 */
public void appendTreatmentClinicalRules(String patientId, StringBuilder result);
```

**实现要点**：
1. 调用 `treatmentClinicalRuleService.getMatchedRules(patientId)`
2. 若非空，格式化追加：
   ```
   【临床硬约束规则（必须严格遵守）】
   1. 米力农注射液连续使用时间不超过 7 天...
   2. 注射用重组人脑利钠肽（新活素）连续使用时间不超过 3 天...
   ```
3. 若为空，记录 info 日志后直接返回

**Controller 调用**（`PatientDataController.getPatientData()`）：
- 在 `promptName="诊疗计划表"` 分支中，新增一行：
  ```java
  patientDataCompositionService.appendTreatmentClinicalRules(patientId, result);
  ```
- Controller 不感知匹配逻辑、不感知格式化细节

---

## Task 6: JSON 规则文件 + manifest

- **目录**：`clinical-rules/treatment-rules/`
  - `treatment-manifest.json`
  - `rules/米力农使用时限.json`
  - `rules/新活素使用时限.json`

- 参照现有 `clinical-rules/` JSON 结构，新增 `orderType` 字段

---

## Task 7: 在 ClinicalRuleSyncService 中新增诊疗规则同步

- **文件**：`client/clinicalrule/ClinicalRuleSyncService.java`（新增方法）
- 新增 `syncTreatmentRules()` 方法，从 `treatment-rules/` 目录读取 JSON 并 UPSERT 到 `TREATMENT_CLINICAL_RULES` 表，与现有 `syncClinicalRules()` 逻辑一致

---

## 验证

| 序号 | 验证项 | 方法 |
|------|--------|------|
| 1 | 建表成功 | 执行 DDL，`DESC TREATMENT_CLINICAL_RULES` |
| 2 | 种子数据 | 执行种子 SQL，`SELECT * FROM TREATMENT_CLINICAL_RULES` → 2 条 |
| 3 | LIKE 匹配 | 单元测试：`orderName="0.9%氯化钠注射液250ml+米力农注射液5mg"` → 命中 |
| 4 | 规则注入 Prompt | 构造含米力农医嘱患者，调 `getPatientData`，确认末尾含规则文本 |
| 5 | AI 生成合规 | 实际调用诊疗计划表生成，检查输出不超时限约束 |
