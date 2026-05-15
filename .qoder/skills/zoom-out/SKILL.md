---
name: zoom-out
description: 当面对不熟悉的代码段时，让 Agent 退一层抽象，展示相关模块和调用者的全景图。适用于需要快速理解陌生代码在其所属模块中的位置、调用链和上下游依赖关系时。
---

# Zoom Out — 代码全景视图

## 适用情形

当你不熟悉某段代码，或者需要理解它在更大体系中的位置时使用。

典型场景：
- 接手不熟悉的代码，想快速了解上下文
- 看到一个方法/类，想知道谁调用了它、它调用了谁
- 在改动代码前，确认自己理解了完整的调用链
- 重构前，识别相关模块和边界

## 指令

以下代码区域我不熟悉。退一层抽象，给我一张**相关模块和调用者的全景地图**，使用项目文档中的术语来描述。

### 全项目级

```markdown
我不熟悉这个模块的上下文。请查阅 `med_ai_assistant_1.0_bs_backend/doc/系统结构/` 中
的架构文档，告诉我：
1. 这个模块属于哪个业务域？（病历管理/DRG分析/质控/Prompt管理/执行服务器）
2. 它的上下游模块是谁？（Controller → Service → Repository → 数据库）
3. 主要调用链是什么？（入口API → 关键方法 → 数据流向）
4. 涉及哪些核心表和字段？
```

### 方法/类级

```markdown
告诉我 [方法名/类名] 的完整全景：
1. 哪里调用了它？（Controller / 其他 Service / 定时任务）
2. 它调用了哪些方法？（Repository / 内部方法）
3. 数据流向是什么？（入参 → 处理逻辑 → 出参 → 持久化）
4. 有哪些重要边界条件？（空值、异常、锁、事务）
```

### 跨模块级

```markdown
我理解 [模块A] 的代码，但不熟悉 [模块B]。解释 [模块B] 在系统中的角色：
1. [模块B] 的职责边界是什么？
2. [模块A] 如何与 [模块B] 交互？（接口 / 事件 / 共享数据）
3. 如果修改 [模块A] 的行为，[模块B] 会受到什么影响？
4. 涉及哪些接口和数据结构？
```

## 输出格式示例

```markdown
## 模块：PatientService.getDiagnosisHistory

### 调用链
```
PatientController.getDiagnosisHistory()
  └─ PatientService.getDiagnosisHistory(patientId, pageable)
       ├─ DiagnosisRepository.findByPatientId(patientId, "AI_GENERATED", pageable)
       │    └─ SELECT * FROM PATIENT_DIAGNOSES WHERE patient_id = ?
       ├─ DiagnosisMapper.toDTOList(diagnoses)
       └─ 返回 Page<DiagnosisDTO>
```

### 上下游关系
- **上游调用者**：PatientController（`GET /api/patients/{id}/diagnoses`）
- **下游依赖**：DiagnosisRepository → PATIENT_DIAGNOSES 表
- **同级协作**：DrgAnalysisService（读取诊断数据用于DRG分组）

### 关键边界
- patientId 为空时返回空列表
- 分页默认 20 条，最大 100 条
- 仅返回 source = 'AI_GENERATED' 的记录
```
