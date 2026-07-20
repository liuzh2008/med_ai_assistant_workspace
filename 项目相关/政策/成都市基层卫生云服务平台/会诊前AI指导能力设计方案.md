# 会诊前 AI 指导能力设计方案

## 一、总体架构

### 1.1 能力定位

本方案将 MedAiAssistant 现有的三大 AI 核心能力（病历质控、诊断推理、诊疗计划）封装为独立 REST API 服务，供"成都市基层卫生云服务平台"在会诊发起前调用。目标是：**让基层医师带着结构化的"会诊简报"发起会诊，而非带着原始病历和模糊疑问**，从而将专家会诊效率提升 3~5 倍。

### 1.2 服务拓扑

```
成都市基层卫生云服务平台（调用方）
    │
    ├── 会诊发起页面（微信小程序）
    │       │
    │       ├── ① 病历质控 API        → 返回质控报告
    │       ├── ② 诊断推理 API        → 返回鉴别诊断清单
    │       └── ③ 诊疗计划 API        → 返回方案草案
    │               │
    │               └── ④ 会诊简报编排层 → 三合一结构化输出
    │
    ▼
MedAiAssistant AI 能力层（本方案交付范围）
    ├── QC Engine（质控规则引擎）
    ├── Diagnosis Engine（诊断推理链）
    ├── Treatment Engine（8步诊疗推理）
    └── Brief Composer（简报编排器）

数据流向：云平台 → API Gateway → 能力层 → LLM（DeepSeek/通义千问）→ 能力层 → 云平台
```

### 1.3 关键设计原则

| 原则 | 说明 |
|------|------|
| **无状态调用** | 每个 API 独立调用，不依赖服务端会话，云平台负责上下文串联 |
| **独立容错** | 三个 API 各自独立降级，质控失败不阻塞诊断推理，诊断失败不阻塞诊疗计划 |
| **显式降级** | 任何环节失败均返回明确原因，不静默跳过，前端可据此决定是否继续发起会诊 |
| **脱敏优先** | 所有输入输出中的患者 PII（姓名、身份证号、手机号、医保号）在 API 层即完成脱敏 |
| **AI 免责** | 所有 AI 生成内容标注来源与免责声明，明确仅为"临床参考" |

---

## 二、接口一：病历质控 API

### 2.1 接口定义

```
POST /api/consultation-prep/qc-check
```

### 2.2 输入参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|:--:|------|
| `medical_record` | Object | ✅ | 结构化病历数据 |
| `medical_record.chief_complaint` | String | ✅ | 主诉 |
| `medical_record.present_illness` | String | ✅ | 现病史 |
| `medical_record.past_history` | String | ❌ | 既往史 |
| `medical_record.physical_exam` | String | ❌ | 体格检查 |
| `medical_record.auxiliary_exams` | Array | ❌ | 辅助检查结果列表 |
| `suspected_disease` | String | ❌ | 疑似诊断/病种编码（用于匹配质控标准） |
| `hospital_id` | String | ✅ | 机构标识（用于加载医院级配置） |

### 2.3 处理流程

```
输入病历
    │
    ├── 第1步：病种匹配
    │   疑似诊断 → 匹配 qc-standards/ 中对应病种的 JSON 标准
    │   无匹配 → 使用通用病历完整性标准（不阻塞流程，显式提示）
    │
    ├── 第2步：完整性检查
    │   逐项比对必填字段：主诉、现病史、既往史、体格检查、辅助检查
    │   标注缺失项 + 严重程度（阻断级 / 建议级）
    │
    ├── 第3步：规范性检查
    │   主诉格式（症状+持续时间）、现病史时序逻辑
    │   诊断术语标准化（ICD编码校验）
    │   用药记录完整性（药品名+剂量+频次+起止时间）
    │
    ├── 第4步：逻辑一致性检查
    │   主诉 ↔ 现病史 ↔ 体格检查 ↔ 诊断 跨字段矛盾检测
    │   年龄/性别与诊断的合理性校验
    │
    └── 第5步：生成质控报告
        评分（百分制）+ 缺失项清单 + 修改建议 + 能否发起会诊
```

### 2.4 输出结构

```
{
  "qc_score": 92,                        // 质控评分（0-100）
  "qc_level": "PASS",                    // PASS / WARN / BLOCK
  "can_proceed_to_consultation": true,   // 是否满足发起会诊的最低标准
  "disease_standard_matched": "CVD-HF",  // 匹配到的质控标准编码，无匹配则为 null
  "disease_standard_note": "已匹配心力衰竭质控标准 v2.3",
  "missing_items": [                     // 缺失项
    { "field": "allergy_history", "severity": "BLOCK", "suggestion": "请补充药物过敏史" }
  ],
  "compliance_issues": [                 // 规范性问题
    { "field": "chief_complaint", "issue": "主诉未包含持续时间", "suggestion": "建议修改为：胸闷气短3天" }
  ],
  "logic_conflicts": [],                 // 逻辑矛盾
  "summary": "病历整体质量良好，质控评分92分。1项阻断级缺失（过敏史），补充后可发起会诊。"
}
```

### 2.5 降级策略

| 异常场景 | 降级行为 |
|---------|---------|
| 病种质控标准未覆盖 | 使用通用标准，`disease_standard_note` 标注"该病种暂无专项质控标准，本次检查基于通用规范" |
| 质控引擎异常/超时 | 返回 `can_proceed_to_consultation: true` + `qc_level: "DEGRADED"` + 原因说明，不阻塞会诊流程 |
| LLM 不可用 | 降级为纯规则检查（完整性+规范性，不含逻辑一致性），评分仅基于规则项 |

---

## 三、接口二：诊断推理 API

### 3.1 接口定义

```
POST /api/consultation-prep/diagnosis-reasoning
```

### 3.2 输入参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|:--:|------|
| `chief_complaint` | String | ✅ | 主诉 |
| `present_illness` | String | ✅ | 现病史（含起病、演变、伴随症状） |
| `physical_exam` | Object | ❌ | 体格检查（生命体征+各系统查体发现） |
| `auxiliary_exams` | Array | ❌ | 已完成的辅助检查及结果 |
| `patient_basic_info` | Object | ❌ | 年龄、性别（脱敏后仅保留此两项） |
| `doctor_notes` | String | ❌ | 基层医师自己的初步判断或困惑 |

### 3.3 处理流程

```
输入临床信息
    │
    ├── 第1步：核心问题提炼
    │   AI 从主诉+现病史中提取核心临床问题
    │   例如："老年男性，呼吸困难伴双下肢水肿，需鉴别心源性与肺源性"
    │
    ├── 第2步：症状归类
    │   将症状按系统归类：心血管系统 / 呼吸系统 / 消化系统 / 其他
    │   标注跨系统重叠信号
    │
    ├── 第3步：假设生成
    │   基于症状归类 + 流行病学先验 + 体格检查，生成候选诊断假设
    │   每个假设包含：疾病名 / 支持依据 / 不支持依据 / 初步概率
    │
    ├── 第4步：鉴别诊断排序
    │   对假设进行鉴别排序，考虑：
    │   - 证据强度（支持+不支持）
    │   - 疾病严重性和紧急性
    │   - 基层条件下可验证性
    │
    ├── 第5步：建议补充检查
    │   列出基层条件下可执行的补充检查，标注：
    │   - 检查项目 + 目的（排除/确认哪个假设）
    │   - 基层可及性（可做 / 需外送 / 建议转诊上级检查）
    │
    └── 第6步：生成关键问题清单
        基于推理缺口，提炼需专家解答的具体问题
```

### 3.4 输出结构

```
{
  "core_problem": "老年男性，呼吸困难伴双下肢水肿3天，需鉴别急性心力衰竭、COPD急性加重、肺栓塞",
  "symptom_classification": {
    "cardiovascular": ["呼吸困难（端坐呼吸）", "双下肢对称性凹陷性水肿"],
    "respiratory": ["呼吸困难", "无发热/脓痰"],
    "overlap_signals": ["呼吸困难同时关联心血管和呼吸系统"]
  },
  "differential_diagnosis": [
    {
      "rank": 1,
      "disease": "急性心力衰竭",
      "icd_code": "I50.9",
      "confidence": "高",
      "supporting_evidence": [
        "双下肢对称性水肿（心源性水肿特征）",
        "高血压病史10年（危险因素）",
        "端坐呼吸（左心衰典型表现）"
      ],
      "contradicting_evidence": [
        "未提供BNP/NT-proBNP结果",
        "未描述颈静脉充盈情况"
      ],
      "urgency": "紧急"
    },
    {
      "rank": 2,
      "disease": "COPD急性加重",
      "icd_code": "J44.1",
      "confidence": "低",
      "supporting_evidence": ["呼吸困难"],
      "contradicting_evidence": [
        "无慢性咳嗽/咳痰史",
        "无吸烟史记录",
        "无发热/脓痰（不支持感染诱因）"
      ],
      "urgency": "亚急性"
    },
    {
      "rank": 3,
      "disease": "肺栓塞",
      "icd_code": "I26.9",
      "confidence": "中低",
      "supporting_evidence": ["突发呼吸困难", "下肢水肿（可为DVT线索）"],
      "contradicting_evidence": ["无胸痛", "无咯血"],
      "urgency": "紧急"
    }
  ],
  "suggested_exams": [
    {
      "exam": "NT-proBNP / BNP",
      "purpose": "鉴别心衰（若显著升高可确认）",
      "accessibility": "需外送（基层可能无法快检）",
      "target_hypothesis": "急性心力衰竭"
    },
    {
      "exam": "心脏超声",
      "purpose": "评估心腔大小、室壁运动、EF值",
      "accessibility": "需转诊上级医院",
      "target_hypothesis": "急性心力衰竭"
    },
    {
      "exam": "D-二聚体",
      "purpose": "排除肺栓塞（阴性预测值高）",
      "accessibility": "基层可做",
      "target_hypothesis": "肺栓塞"
    }
  ],
  "key_questions_for_specialist": [
    "肾功能CKD3期背景下，利尿剂的剂量和种类如何选择？",
    "当前血压160/95mmHg，是否应在急性心衰稳定后启动ACEI/ARB？",
    "基层医院无床旁心脏超声，是否建议转诊至上级医院进一步评估？"
  ],
  "assertion_checklist": [              // 断言清单（基层医师逐条审核）
    { "id": 1, "statement": "呼吸困难为端坐呼吸（平卧加重）", "status": "unchecked" },
    { "id": 2, "statement": "双下肢水肿为对称性凹陷性", "status": "unchecked" }
  ],
  "disclaimer": "本诊断推理由AI生成，仅供临床参考。最终诊断需由接诊医师结合临床判断确认。"
}
```

### 3.5 降级策略

| 异常场景 | 降级行为 |
|---------|---------|
| 输入信息不足（如仅有主诉，无现病史） | 跳过假设生成，仅输出症状归类和"信息不足，建议补充现病史后再推理" |
| LLM 超时（>60s） | 返回部分结果（核心问题+症状归类），标注"AI推理未完成，鉴别诊断请专家人工判断" |
| LLM 完全不可用 | 返回错误码 + "AI诊断推理服务暂不可用，建议直接发起会诊"，不阻塞会诊流程 |

---

## 四、接口三：诊疗计划 API

### 4.1 接口定义

```
POST /api/consultation-prep/treatment-plan
```

### 4.2 输入参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|:--:|------|
| `working_diagnosis` | String | ✅ | 当前工作诊断（可为诊断推理API输出的首选诊断） |
| `disease_code` | String | ❌ | ICD编码（用于匹配病种质控标准） |
| `patient_context` | Object | ✅ | 患者上下文 |
| `patient_context.age` | Number | ✅ | 年龄 |
| `patient_context.gender` | String | ✅ | 性别 |
| `patient_context.comorbidities` | Array | ❌ | 合并症列表 |
| `patient_context.medications` | Array | ❌ | 当前用药 |
| `patient_context.allergies` | Array | ❌ | 过敏史 |
| `resource_constraints` | Object | ❌ | 基层资源限制 |
| `resource_constraints.available_drugs` | Array | ❌ | 可用药物清单 |
| `resource_constraints.available_exams` | Array | ❌ | 可做检查清单 |
| `resource_constraints.can_refer` | Boolean | ❌ | 是否具备转诊条件 |

### 4.3 处理流程

```
输入诊断 + 患者上下文 + 资源限制
    │
    ├── Step 1：问题列表
    │   提取需解决的临床问题（主诊断 + 合并症 + 风险因素）
    │
    ├── Step 2：治疗目标 ⚑ 审批点
    │   注入病种质控标准，明确各问题的治疗目标
    │   多病种时合并所有质控标准
    │   无质控标准时显式提示"基于AI推理"，importanceLevel 不标"质控"
    │
    ├── Step 3-1：方案生成
    │   针对每个问题生成候选治疗方案
    │   标注证据等级 + 推荐优先级
    │
    ├── Step 3-2：方案展开 ⚑ 审批点
    │   详细展开推荐方案：药品+剂量+频次+疗程+监测
    │   根据 resource_constraints 标记基层可执行方案 vs 需转诊方案
    │
    ├── Step 4：药物相互作用检查
    │   新方案药品 × 现有用药 × 过敏史 → 冲突检测
    │
    ├── Step 5：风险预警
    │   年龄相关风险、肾功能调整、肝功能调整
    │
    ├── Step 6：患者教育要点
    │   需告知患者的病情说明、用药注意事项、危险信号
    │
    ├── Step 7：随访计划
    │   复查时间节点 + 复查项目 + 转诊指征
    │
    └── Step 8：监测指标
        疗效指标 + 安全性指标 + 频率（由质控标准驱动）
```

### 4.4 输出结构

```
{
  "problem_list": [
    { "problem": "急性心力衰竭（I50.9）", "priority": "PRIMARY", "urgency": "紧急" },
    { "problem": "高血压3级（I10）", "priority": "COMORBID", "urgency": "亚急性" },
    { "problem": "慢性肾脏病3期（N18.3）", "priority": "RISK_FACTOR", "urgency": "需关注" }
  ],
  "treatment_goals": {
    "quality_standard_injected": true,
    "standard_source": "心力衰竭质控标准 v2.3 + 高血压质控标准 v2.1",
    "goals": [
      {
        "problem": "急性心力衰竭",
        "goals": ["缓解呼吸困难、消除水肿", "维持SpO2 > 92%", "避免肾功能恶化"],
        "source": "QC_STANDARD+CVD-HF"    // 质控标准驱动
      },
      {
        "problem": "高血压3级",
        "goals": ["控制血压 < 130/80 mmHg（长期）", "急性期避免血压骤降"],
        "source": "AI_INFERRED"            // AI推理补充
      }
    ]
  },
  "treatment_plans": [
    {
      "problem_targeted": "急性心力衰竭",
      "candidate_plans": [
        {
          "name": "方案A：呋塞米 + 硝酸酯",
          "priority": "推荐（基层可执行）",
          "evidence_level": "IA",
          "drugs": [
            {
              "drug": "呋塞米",
              "dosage": "20-40mg iv（根据肾功能调整）",
              "frequency": "bid",
              "duration": "至水肿消退",
              "note": "⚠ 审批点：CKD3期需调整剂量，建议起始20mg"
            },
            {
              "drug": "硝酸异山梨酯",
              "dosage": "10mg",
              "frequency": "tid 口服",
              "duration": "持续",
              "note": "无静脉制剂时的替代方案"
            }
          ],
          "resource_match": "FEASIBLE",     // 基层可执行
          "approval_required": true,
          "approval_points": ["呋塞米剂量（CKD3期调整）", "是否需要加用ACEI/ARB"]
        },
        {
          "name": "方案B：呋塞米 + 硝酸甘油 iv",
          "priority": "次选（基层条件受限）",
          "evidence_level": "IA",
          "drugs": [
            { "drug": "硝酸甘油 iv", "note": "需微量泵，基层可能不具备" }
          ],
          "resource_match": "CONSTRAINED",  // 基层条件受限
          "constraint_detail": "硝酸甘油静脉制剂需微量泵持续输注，基层可能不具备条件"
        },
        {
          "name": "方案C：转诊上级医院",
          "priority": "备选",
          "resource_match": "REFER",
          "referral_criteria": [
            "BNP显著升高确认心衰诊断后",
            "需要心脏超声评估EF值",
            "合并CKD3期需要多学科协作"
          ]
        }
      ]
    }
  ],
  "drug_interactions": [
    { "severity": "WARNING", "detail": "呋塞米 + 当前用药中的NSAIDs → 减弱利尿效果，增加肾损伤风险", "action": "建议停用NSAIDs" }
  ],
  "risk_alerts": [
    { "type": "RENAL_DOSE", "detail": "呋塞米在CKD3期建议减量至常规剂量的50-75%并监测肾功能" },
    { "type": "ELDERLY", "detail": "65岁以上患者使用硝酸酯类注意体位性低血压风险" }
  ],
  "monitoring_indicators": [
    { "indicator": "体重", "frequency": "每日", "purpose": "评估利尿效果" },
    { "indicator": "尿量", "frequency": "每班记录", "purpose": "评估利尿效果" },
    { "indicator": "血钾、肾功能", "frequency": "每日", "purpose": "监测利尿剂安全性" },
    { "indicator": "血压", "frequency": "q4h", "purpose": "监测硝酸酯类效果" }
  ],
  "approval_gate_summary": {
    "total_approval_points": 2,
    "points": [
      { "step": "Step 2", "question": "治疗目标是否认可？是否需要调整优先级？" },
      { "step": "Step 3-2", "question": "方案A中呋塞米剂量（CKD3期）和ACEI启用时机是否合适？" }
    ]
  },
  "disclaimer": "本诊疗计划由AI生成，仅供临床参考。所有用药方案须经执业医师审核确认后方可执行。"
}
```

### 4.5 降级策略

| 异常场景 | 降级行为 |
|---------|---------|
| 质控标准匹配失败 | 治疗目标全部标注 `source: "AI_INFERRED"`，显式提示"该病种暂无质控标准，本方案完全基于AI推理" |
| Step 3-2 展开超时 | 返回至 Step 3-1（方案摘要），标注"详细方案展开未完成，请专家人工补充" |
| LLM 不可用 | 返回错误码 + 引导"AI诊疗计划生成暂不可用，建议直接发起会诊由专家制定方案" |
| 药物库查询失败 | 跳过药物相互作用检查，标注"药物相互作用未检查，请人工核对" |

---

## 五、会诊简报

### 5.1 定位

会诊简报是三个 API 输出的编排整合层，不引入新的 AI 推理，仅做**结构化聚合与格式化**。云平台依次调用三个 API 后，将结果传入简报编排器，生成统一的会诊附件。

### 5.2 编排接口

```
POST /api/consultation-prep/compose-brief
```

### 5.3 输入

三个 API 的完整输出 + 会诊元信息（申请机构、科室、发起时间等）。

### 5.4 输出结构

会诊简报为一套结构化 JSON，云平台可根据此 JSON 渲染为不同形态（小程序富文本 / PC端报告 / PDF导出）：

```
{
  "brief_id": "BRIEF-20260713-0001",
  "meta": {
    "institution": "盐亭县凤灵社区卫生服务中心",
    "department": "全科",
    "doctor": "张XX",
    "created_at": "2026-07-13T14:30:00+08:00"
  },

  // ===== 板块一：病历质控摘要 =====
  "qc_summary": {
    "score": 92,
    "level": "PASS",
    "highlights": [
      "✅ 主诉、现病史、体格检查完整",
      "⚠️ 过敏史缺失（已标注提醒）"
    ]
  },

  // ===== 板块二：诊断推理摘要 =====
  "diagnosis_summary": {
    "core_problem": "老年男性，呼吸困难伴双下肢水肿3天...",
    "top_diagnosis": "急性心力衰竭（I50.9）— 置信度：高",
    "differential_list": [
      { "rank": 1, "disease": "急性心力衰竭", "confidence": "高" },
      { "rank": 2, "disease": "COPD急性加重", "confidence": "低" },
      { "rank": 3, "disease": "肺栓塞", "confidence": "中低" }
    ],
    "pending_exams": ["NT-proBNP（建议外送）", "心脏超声（建议转诊）"]
  },

  // ===== 板块三：诊疗计划摘要 =====
  "treatment_summary": {
    "recommended_plan": "方案A：呋塞米 + 硝酸异山梨酯（基层可执行）",
    "approval_points": [
      "⚠️ 呋塞米剂量需针对CKD3期调整（审批点①）",
      "⚠️ ACEI/ARB启用时机需确认（审批点②）"
    ],
    "resource_gaps": [
      "无静脉硝酸甘油制剂",
      "无床旁心脏超声",
      "NT-proBNP需外送"
    ]
  },

  // ===== 板块四：需专家决策的关键问题 =====
  "key_questions": [
    "1. CKD3期背景下，呋塞米起始剂量建议多少？",
    "2. 当前血压160/95，是否在急性心衰稳定后启动ACEI？",
    "3. 是否建议转诊至上级医院？"
  ],

  // ===== 免责声明 =====
  "disclaimers": [
    "本简报中AI生成内容仅供临床参考，最终诊断与治疗决策由接诊医师及会诊专家共同确认。",
    "患者隐私信息已自动脱敏处理。"
  ]
}
```

### 5.5 简报生成逻辑

```
病历质控报告 ─────────┐
诊断推理报告 ─────────┼──→ 编排器 ──→ 会诊简报 JSON
诊疗计划报告 ─────────┘        │
                               ├── 提取各报告关键字段
                               ├── 生成 highlights（亮点标注）
                               ├── 汇总 approval_points（审批点）
                               ├── 汇总 resource_gaps（资源缺口）
                               └── 汇总 key_questions（关键问题）
```

编排器不调用 LLM，纯结构化规则提取：
- `qc_summary` 来自质控报告的核心字段
- `diagnosis_summary` 来自诊断推理报告的 top N 鉴别诊断
- `treatment_summary` 来自诊疗计划报告的推荐方案 + 审批点
- `key_questions` 来自诊断推理 + 诊疗计划中标注的审批点

---

## 六、实现路线

### 6.1 基于现有能力的改造清单

| 现有能力 | 位置 | 改造内容 | 工作量 |
|---------|------|---------|:--:|
| 质控规则引擎 | `med_ai_assistant_1.0_bs_backend/` QC模块 | 新增 `ConsultationPrepController` + `QcCheckService`，封装为独立 API | 小 |
| 质控标准 JSON | `qc-standards/` | 新增通用病历完整性标准（无病种匹配时的兜底标准） | 小 |
| 诊断推理链 | Prompt模板 ID 405 + LogicalDiagnosisPanel 后端逻辑 | 将 Step 1~6 推理链独立为 `DiagnosisReasoningService`，接口输入输出适配会诊前场景 | 中 |
| 8步诊疗推理 | 诊疗计划深度推理 Prompt 模板（9个JSON） | 独立为 `TreatmentPlanService`，新增 `resource_constraints` 参数 + 基层条件适配逻辑 | 中 |
| 脱敏引擎 | HanLP 医疗NER + 正则规则 | 确保 API 层入参出参均过脱敏，无需改造 | 无 |
| 会诊简报编排 | **新建** | `BriefComposerService`，纯规则编排，不调 LLM | 小 |
| API 认证 | Spring Security + JWT | 新增云平台的 service account 认证方式 | 小 |

### 6.2 新增文件结构

```
med_ai_assistant_1.0_bs_backend/
└── src/main/java/com/example/medaiassistant/
    └── consultation/                         # 新建模块
        ├── controller/
        │   └── ConsultationPrepController.java    # 三个 API 端点
        ├── service/
        │   ├── QcCheckService.java                # 会诊前质控
        │   ├── DiagnosisReasoningService.java     # 会诊前诊断推理
        │   ├── TreatmentPlanService.java          # 会诊前诊疗计划
        │   └── BriefComposerService.java          # 会诊简报编排
        ├── dto/
        │   ├── QcCheckRequest.java / QcCheckResponse.java
        │   ├── DiagnosisReasoningRequest.java / DiagnosisReasoningResponse.java
        │   ├── TreatmentPlanRequest.java / TreatmentPlanResponse.java
        │   └── ConsultationBriefResponse.java
        └── exception/
            └── AiDegradationException.java       # AI降级专用异常
```

### 6.3 Prompt 模板适配

现有诊断推理和诊疗计划 Prompt 模板针对院内教学场景设计，需做以下适配：

| 模板 | 现有场景 | 会诊前适配 |
|------|---------|-----------|
| 逻辑推理-鉴别诊断全景（ID 405） | Step 10 教学全景 | 新增"基层条件限制"上下文，输出增加 `accessibility` 字段 |
| 诊疗计划 Step 1~8（9个JSON） | 教学推理 | 新增 `resource_constraints` 变量注入，方案标注 `FEASIBLE/CONSTRAINED/REFER` |
| 质控检查 Prompt | 院内质控评估 | 无需改动，现有标准直接复用 |

适配方式：在 Prompt 模板中新增 `consultation_prep` 场景标签，服务层根据调用来源动态选择上下文注入。

### 6.4 部署架构

```
┌─────────────────────────────────────────────┐
│  MedAiAssistant 主服务器（复用现有节点）       │
│  端口 8080                                    │
│                                              │
│  /api/consultation-prep/*   ← 新增端点       │
│  /api/health                 ← 现有健康检查   │
│                                              │
│  调用：DeepSeek API / 通义千问                │
│  读取：qc-standards/ + prompt-templates/     │
└─────────────────────────────────────────────┘
```

推荐复用现有主服务器节点，不新增服务实例。理由：
- 会诊前指导是 AI 推理密集型（调用 LLM），与现有 AI 服务共享同一 LLM 连接池
- 预计调用量：日均数百次（按活跃会诊量估算），对现有服务压力可忽略
- 如未来并发增高，再将 consultation 模块独立为微服务

---

## 七、容错与降级体系

### 7.1 三层降级矩阵

| 层级 | 场景 | 行为 |
|------|------|------|
| **API 级** | 单个 API 调用失败 | 返回降级结果 + `degraded: true` + 原因，不阻塞其他 API |
| **LLM 级** | DeepSeek 不可用 | 自动切换通义千问（备用模型），切换失败则返回规则结果 |
| **全局级** | 所有 AI 服务不可用 | 返回明确错误码，云平台前端提示"AI辅助暂不可用，可直接发起会诊" |

### 7.2 各 API 独立容错

三个 API 完全独立，彼此不依赖：

- **质控 API 失败** → 不影响诊断推理和诊疗计划，会诊简报中质控板块标注"暂未完成"
- **诊断推理 API 失败** → 不影响质控和诊疗计划，会诊简报中诊断板块标注"AI推理未完成"
- **诊疗计划 API 失败** → 不影响质控和诊断推理，会诊简报中治疗板块标注"AI方案未生成"

云平台可据此灵活决定：三个都成功 → 完整简报；仅质控通过 → 基础简报；全部失败 → 直接发起传统会诊。

### 7.3 超时策略

| API | 超时时间 | 说明 |
|-----|:--:|------|
| 病历质控 | 15s | 规则检查为主（<1s），LLM逻辑一致性检查 10~15s |
| 诊断推理 | 60s | 完整推理链需多次 LLM 调用 |
| 诊疗计划 | 90s | 8步推理链 + 药物库查询，最耗时 |
| 会诊简报编排 | 5s | 纯规则编排，不调 LLM |

---

## 八、安全与合规

### 8.1 数据安全

| 环节 | 措施 |
|------|------|
| **传输** | 全链路 HTTPS + API Key 认证 |
| **输入脱敏** | API 层拦截：姓名→"患者"，身份证号→打码，手机号→打码，医保号→打码 |
| **LLM 调用** | 传入 LLM 前二次脱敏校验，确保 PII 不入大模型 |
| **日志** | 禁止记录患者 PII，日志仅含 `brief_id` + `hospital_id` |
| **存储** | 不持久化患者原始数据，仅存储脱敏后的会诊简报 JSON（保存在云平台侧） |

### 8.2 AI 合规

| 要求 | 实现 |
|------|------|
| AI 生成内容标识 | 所有输出 `source` 字段区分 `AI_INFERRED` / `QC_STANDARD` / `DOCTOR_CONFIRMED` |
| 免责声明 | 每个 API 输出 + 会诊简报均含免责声明 |
| 不可替代临床判断 | API 文档明确："AI 输出为临床参考，最终诊疗责任由接诊医师及会诊专家承担" |
| 审计追溯 | 每次 API 调用记录：调用时间、输入摘要（脱敏）、输出摘要、调用方标识 |

### 8.3 与现有安全体系的衔接

- 复用现有 Spring Security JWT 认证体系，新增 `CONSULTATION_PLATFORM` 角色
- 复用现有患者脱敏引擎（HanLP NER + 正则规则）
- 复用现有日志脱敏规范

---

## 九、交付边界

### 本方案交付范围（MedAiAssistant 侧）

- ✅ 四个 API 端点开发（质控 / 诊断推理 / 诊疗计划 / 简报编排）
- ✅ Prompt 模板适配（会诊前场景上下文注入）
- ✅ 通用病历完整性质控标准（兜底）
- ✅ API 文档（OpenAPI 3.0 规范）
- ✅ 联调测试用例

### 不在本方案交付范围（云平台侧负责）

- ❌ 微信小程序前端开发
- ❌ 会诊流程管理（申请→审核→接单→会诊→纪要）
- ❌ 用户权限体系（四级角色模型）
- ❌ 实时音视频通讯
- ❌ 专家排班 / 预约 / 加急提醒
- ❌ 统计报表 / 活跃度监测

---

## 十、工作总量评估

三个 API 均可基于 MedAiAssistant 现有能力直接改造，核心工作在于将原有教学/质控场景的推理链独立封装并适配会诊前场景的输入输出格式，以及新增一个纯规则编排的简报编排器。工作总量评估约 **2~3 周**（含联调）。
