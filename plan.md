# 诊疗计划临床硬约束规则 — 手动更新补充 + 大小写对齐

## Context

诊疗计划临床硬约束规则（Task 7 同步服务已实现）的**定时任务自动更新**已通过 `ClinicalRuleUpdateScheduler` 完整覆盖——每 24 小时同时调用 `updateDiagnosisRules()` 和 `updateTreatmentRules()`。

但**手动更新**端点 `POST /api/clinical-rules/sync`（`ClinicalRuleUpdateController`）当前只同步了诊断规则，缺少诊疗规则的同步调用。此外，`TreatmentClinicalRuleRepository.findByKeywordMatch` 在 Oracle 中是大小写敏感的（用方法名派生），与诊断规则的 `UPPER()` 行为不一致。

## 问题诊断

| # | 文件 | 问题 |
|---|------|------|
| 1 | `ClinicalRuleUpdateController.java` | `triggerSync()` 第 77 行只调用 `updateFromExecutionServer()`（诊断规则），未调用 `updateTreatmentRulesFromExecutionServer()`（诊疗规则） |
| 2 | `TreatmentClinicalRuleRepository.java` | `findByKeywordMatch`（第 23 行）用方法名派生，Oracle 中大小写敏感；诊断规则用 `UPPER()` 实现大小写无关 |

## 修改计划

### Task 1: 修复 `TreatmentClinicalRuleRepository.findByKeywordMatch` 大小写

**文件**: `med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/repository/TreatmentClinicalRuleRepository.java`

将第 22-23 行的方法名派生改为 JPQL + `UPPER()`，与诊断规则一致：

```java
/** 按关键字匹配精确查找（不区分大小写，UPSERT用） */
@Query("SELECT r FROM TreatmentClinicalRule r WHERE UPPER(r.keywordMatch) = UPPER(:keywordMatch)")
TreatmentClinicalRule findByKeywordMatch(@Param("keywordMatch") String keywordMatch);
```

### Task 2: 补全手动更新端点中的诊疗规则同步

**文件**: `med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/ClinicalRuleUpdateController.java`

在 `triggerSync()` 方法的异步执行体中，补充诊疗规则的同步调用。在现有的诊断规则同步（第 77 行）之后，追加诊疗规则同步：

```java
// 现有：诊断规则同步
SyncResult syncResult = updateService.updateFromExecutionServer(baseUrl);

// 新增：诊疗规则同步
SyncResult treatmentSyncResult = updateService.updateTreatmentRulesFromExecutionServer(baseUrl);
```

同步更新进度状态和日志，区分诊断/诊疗结果。修改 `SyncProgress` 内部类以支持两类规则的独立计数。

## 验证

| 序号 | 验证项 | 方法 |
|------|--------|------|
| 1 | `findByKeywordMatch` 大小写无关 | 插入 `keyword_match='米力农'`，用 `'米力农'` / `'米力農'` 查询均命中 |
| 2 | 手动触发 `/api/clinical-rules/sync` 同时更新诊疗规则 | POST 触发后，检查日志同时有诊断和诊疗两条更新完成日志 |
| 3 | 定时任务不受影响 | 等待 `@Scheduled` 触发，确认 `updateTreatmentRules()` 正常执行 |
| 4 | 编译通过 | `mvn compile` BUILD SUCCESS |
