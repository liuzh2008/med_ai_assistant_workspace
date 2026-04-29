# AI诊断辅助系统

<cite>
**本文档引用的文件**
- [AI控制器](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/AIController.java)
- [AI响应控制器](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/AIResponseController.java)
- [资料收集建议控制器](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/DataCollectionAdviceController.java)
- [资料收集建议服务](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/service/DataCollectionAdviceService.java)
- [定时Prompt生成器](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/service/TimerPromptGenerator.java)
- [资料收集建议响应DTO](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/dto/DataCollectionAdviceResponse.java)
- [AI诊断标签页组件](file://med_ai_assistant_1.0_bs_vue/src/components/patient/AIDiagnosisTab.vue)
- [资料收集建议组件](file://med_ai_assistant_1.0_bs_vue/src/components/patient/DataCollectionAdvice.vue)
- [轮询管理器](file://med_ai_assistant_1.0_bs_vue/src/utils/pollingManager.js)
- [AI API模块](file://med_ai_assistant_1.0_bs_vue/src/api/ai.js)
- [资料收集建议API](file://med_ai_assistant_1.0_bs_vue/src/api/dataCollectionAdvice.js)
- [患者标签页组件](file://med_ai_assistant_1.0_bs_vue/src/components/patient/PatientTabs.vue)
- [路由配置](file://med_ai_assistant_1.0_bs_vue/src/router/index.js)
</cite>

## 更新摘要
**变更内容**
- 新增综合问题解决技能系统，包含研究、检索、方案生成和修订四个阶段的AI驱动医疗决策工作流程
- 实现资料收集建议功能的完整前端集成，包括DataCollectionAdvice组件的状态管理、自动轮询机制和用户交互
- 优化AI诊断页面的空状态处理与临床数据就绪提醒机制
- 集成定时批量生成和手动触发的完整工作流程
- 实现智能轮询控制和超时处理机制

## 目录
1. [简介](#简介)
2. [项目结构](#项目结构)
3. [核心组件](#核心组件)
4. [架构总览](#架构总览)
5. [详细组件分析](#详细组件分析)
6. [综合问题解决技能系统](#综合问题解决技能系统)
7. [AI诊断页面增强功能](#ai诊断页面增强功能)
8. [资料收集建议功能](#资料收集建议功能)
9. [前端组件集成](#前端组件集成)
10. [轮询管理机制](#轮询管理机制)
11. [状态管理与数据流](#状态管理与数据流)
12. [用户交互设计](#用户交互设计)
13. [依赖关系分析](#依赖关系分析)
14. [性能考虑](#性能考虑)
15. [故障排除指南](#故障排除指南)
16. [结论](#结论)
17. [附录](#附录)

## 简介
本文件面向AI诊断辅助系统的使用者与维护者，系统性阐述AI模型集成机制、诊断算法实现与结果处理流程，重点覆盖以下方面：
- AI服务调用方式：同步与流式响应、模型参数映射、超时与重试策略
- 数据预处理：患者数据聚合、模板驱动的数据类型选择、脱敏与降级策略
- 模型推理过程：WebFlux响应式链路、DNS与连接池优化、网络恢复自动重建
- 结果后处理：结果落库、状态管理、健康检查与运维排障
- 配置与性能优化：多模型配置、超时与重试参数、连接池与DNS缓存
- 错误处理策略：可重试异常判定、自动恢复机制、健康状态探测
- 实际使用示例与最佳实践：接口调用、参数配置、运维排障
- 与主服务器和执行服务器的协作关系：加密传输、远程推理、状态同步
- **新增**：综合问题解决技能系统，包含研究、检索、方案生成和修订四个阶段的AI驱动医疗决策工作流程
- **新增**：AI诊断页面空状态处理与临床数据就绪提醒机制
- **新增**：病情小结模板过滤功能，优化AI助手页面的模板展示
- **新增**：资料收集建议功能，包括定时批量生成和手动触发API
- **新增**：完整的前端组件集成，包括DataCollectionAdvice组件的状态管理、自动轮询机制和用户交互
- **新增**：轮询管理器的智能轮询控制和超时处理机制
- **新增**：资料收集建议标签页与现有系统的无缝集成

## 项目结构
系统采用分层架构，核心围绕AI控制器、AI响应控制器、模型配置与网络恢复服务展开，配合Prompt执行引擎与数据服务模块，形成完整的AI诊断辅助闭环。新增的资料收集建议功能通过独立的控制器、服务和前端组件实现，具备完整的状态管理和轮询机制。

```mermaid
graph TB
subgraph "前端层"
FE[前端应用]
AIView[AI视图组件]
AIDiagnosisTab[AI诊断标签页]
DataCollectionAdvice[资料收集建议组件]
PatientTabs[患者标签页]
PatientView[患者视图]
PollingManager[轮询管理器]
end
subgraph "API层"
DataCollectionAdviceAPI[资料收集建议API]
AIAPIModule[AI API模块]
end
subgraph "后端服务层"
DataCollectionAdviceController[资料收集建议控制器]
DataCollectionAdviceService[资料收集建议服务]
TimerPromptGenerator[定时Prompt生成器]
AIController[AI控制器]
AIResponseController[AI响应控制器]
end
subgraph "核心服务层"
PromptService[Prompt执行引擎]
DataSvc[数据处理服务]
TreatmentPlanService[诊疗计划服务]
end
subgraph "数据访问层"
PromptResultRepository[PromptResultRepository]
PatientRepository[PatientRepository]
end
subgraph "数据存储层"
MySQL[(MySQL数据库)]
Oracle[(Oracle数据库)]
end
subgraph "外部服务"
ExecutionServer[执行服务器]
AIModel[AI模型服务]
end
FE --> AIView
AIView --> AIDiagnosisTab
AIView --> DataCollectionAdvice
PatientTabs --> DataCollectionAdvice
PatientView --> PatientTabs
DataCollectionAdvice --> PollingManager
DataCollectionAdviceAPI --> DataCollectionAdviceController
DataCollectionAdviceController --> TimerPromptGenerator
DataCollectionAdviceController --> PatientRepository
DataCollectionAdviceService --> PromptResultRepository
DataCollectionAdviceService --> TreatmentPlanService
AIController --> PromptService
AIResponseController --> AIModel
PromptService --> PromptResultRepository
DataSvc --> MySQL
DataSvc --> Oracle
ExecutionServer --> AIModel
```

**图表来源**
- [AI控制器](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/AIController.java)
- [AI响应控制器](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/AIResponseController.java)
- [资料收集建议控制器](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/DataCollectionAdviceController.java)
- [资料收集建议服务](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/service/DataCollectionAdviceService.java)
- [定时Prompt生成器](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/service/TimerPromptGenerator.java)

## 核心组件
- AI控制器：负责Prompt模板管理、患者数据聚合与格式化、对话历史保存、结果查询与状态管理。优化后直接数据库查询，消除HTTP自调用死锁与超时问题。
- AI响应控制器：面向外部AI模型的统一入口，支持流式与非流式响应，集成响应式重试、DNS与连接池优化、网络恢复自动重建。
- AI模型配置类：集中管理多模型配置（URL、密钥、超时、重试），提供配置校验与默认模型选择。
- 网络恢复服务：维护连续失败计数与恢复窗口，达到阈值自动重建WebClient，保障网络波动后的可用性。
- 加密服务与执行服务器：在加密传输模式下，主服务器将敏感数据加密后发送至执行服务器，执行服务器解密后调用AI模型，再加密返回。
- **新增**：资料收集建议控制器：提供手动触发资料收集建议生成的API端点，支持医生随时刷新生成，具备参数校验和Profile隔离。
- **新增**：资料收集建议服务：负责查询患者最新的资料收集建议结果，组装为响应对象，支持三种状态管理。
- **新增**：资料收集建议组件：完整的Vue组件，包含四种状态管理、自动轮询机制、用户交互和错误处理。
- **新增**：轮询管理器：封装轮询逻辑，支持配置轮询间隔、最大轮询次数、超时回调和错误处理。
- **新增**：AI诊断标签页组件：负责AI诊断结果的展示、空状态处理、诊断分析触发等功能。
- **新增**：患者标签页组件：整合多个标签页，包括AI诊断、病历记录、检查报告等，支持懒加载优化。

**章节来源**
- [AI控制器](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/AIController.java)
- [AI响应控制器](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/AIResponseController.java)
- [资料收集建议控制器](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/DataCollectionAdviceController.java)
- [资料收集建议服务](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/service/DataCollectionAdviceService.java)
- [定时Prompt生成器](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/service/TimerPromptGenerator.java)
- [资料收集建议响应DTO](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/dto/DataCollectionAdviceResponse.java)

## 架构总览
系统整体分为前端层、API层、业务服务层、核心服务层、数据访问层与数据存储层，以及外部AI模型与执行服务器。AI控制器与AI响应控制器分别承担业务编排与模型调用职责，Prompt执行引擎与数据服务模块提供数据支撑，加密服务与执行服务器实现安全的远程推理。新增的资料收集建议功能通过独立的服务层、控制器和前端组件实现，具备完整的状态管理和轮询机制，与现有系统无缝集成。

```mermaid
graph TB
subgraph "业务编排层"
AI[AI控制器]
PromptSvc[Prompt执行引擎]
TimerSvc[定时任务服务]
AIDiagnosisTab[AI诊断标签页]
DataCollectionAdviceCtrl[资料收集建议控制器]
TimerCtrl[定时任务控制器]
end
subgraph "模型调用层"
AIResp[AI响应控制器]
AIModel[AI模型服务]
handlePromptExecution[Prompt执行工具]
getLatestPromptResult[获取最新结果]
getPatientData[获取患者数据]
getPromptTemplate[获取模板]
addPrompt[保存Prompt]
generateAdvice[生成建议]
end
subgraph "前端展示层"
DataCollectionAdvice[资料收集建议组件]
PollingManager[轮询管理器]
PatientTabs[患者标签页]
PatientView[患者视图]
end
subgraph "数据支撑层"
DataSvc[数据处理服务]
Repo[Repository层]
MySQL[(MySQL)]
Oracle[(Oracle)]
apiAI[AI API模块]
PromptResultRepo[PromptResultRepository]
PatientRepo[PatientRepository]
TreatmentPlanService[TreatmentPlanItemService]
end
subgraph "安全与执行层"
Encrypt[加密服务]
ExecServer[执行服务器]
end
AI --> PromptSvc
AI --> TimerSvc
AI --> DataCollectionAdviceCtrl
AIDiagnosisTab --> handlePromptExecution
AIDiagnosisTab --> getLatestPromptResult
AIDiagnosisTab --> apiAI
DataCollectionAdviceCtrl --> generateAdvice
DataCollectionAdviceCtrl --> TimerSvc
DataCollectionAdviceCtrl --> PatientRepo
DataCollectionAdvice --> PollingManager
DataCollectionAdvice --> DataCollectionAdviceCtrl
PatientTabs --> DataCollectionAdvice
PatientView --> PatientTabs
AIResp --> AIModel
PromptSvc --> Repo
TimerSvc --> Repo
DataCollectionAdviceService --> Repo
DataSvc --> Repo
Encrypt --> ExecServer
PromptSvc --> AIModel
DataCollectionAdviceService --> AIModel
```

**图表来源**
- [AI控制器](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/AIController.java)
- [AI响应控制器](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/AIResponseController.java)
- [资料收集建议控制器](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/DataCollectionAdviceController.java)
- [资料收集建议服务](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/service/DataCollectionAdviceService.java)
- [定时Prompt生成器](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/service/TimerPromptGenerator.java)

## 详细组件分析

### AI控制器：数据聚合与模板驱动
- 功能要点
  - 患者数据聚合：根据模板配置动态选择数据类型（一般信息、诊断信息、病历记录、长期/临时医嘱、化验/检查结果、入院/会诊/手术记录等），直接数据库查询，避免HTTP自调用导致的超时与死锁。
  - 模板驱动的数据类型决策：优先读取模板配置的requiredDataTypes，自动补充"手术记录"，未提供模板参数时使用默认11种数据类型。
  - 三层降级策略：入院记录优先使用PromptResult中的"入院记录总结"，其次使用EMR_CONTENT原始记录，最后输出统一标记"无入院记录数据"。
  - 连续性功能：当模板名为"诊疗计划表"时，追加上次生成的治疗计划文本与QC质控评估结果。
  - 对话历史保存：事务性保存会话消息，及时暴露持久化异常。
  - **新增**：病情小结数据处理：直接查询medicalRecordRepository，过滤recordType包含"病情小结"的记录，提供最新的病情小结内容。
- 性能优化
  - 消除HTTP自调用，直接Repository查询，响应时间从5-30秒降至0.5-2秒，显著降低超时错误。
  - 时间过滤：查房记录模板对长期/临时医嘱与化验/检查结果应用时间范围过滤，减少无关数据。
- 错误处理
  - 单个数据类型失败不影响整体流程，错误信息不进入返回结果，仅记录日志便于排查。

```mermaid
flowchart TD
Start(["开始"]) --> ParseParams["解析参数<br/>patientId, promptType, promptName"]
ParseParams --> LoadTemplate["加载Prompt模板<br/>读取requiredDataTypes"]
LoadTemplate --> DecideTypes{"模板配置是否存在？"}
DecideTypes --> |是| UseConfig["使用模板配置<br/>自动补充'手术记录'"]
DecideTypes --> |否| UseDefault["使用默认11种数据类型"]
UseConfig --> FetchData["逐项获取数据<br/>直接数据库查询"]
UseDefault --> FetchData
FetchData --> ProcessDataType{"处理数据类型"}
ProcessDataType --> |病情小结| GetMedicalSummary["查询最新病情小结<br/>过滤recordType包含'病情小结'"]
ProcessDataType --> |其他类型| GetData["获取对应数据类型"]
GetData --> FormatData["格式化数据<br/>Markdown分段"]
GetMedicalSummary --> FormatData
FormatData --> AddContinuity{"模板是否为'诊疗计划表'？"}
AddContinuity --> |是| AppendPlan["追加上次治疗计划文本"]
AddContinuity --> |是| AppendQC["追加QC质控评估结果"]
AddContinuity --> |否| SkipQC["跳过追加"]
AppendPlan --> BuildResult["构建最终结果"]
AppendQC --> BuildResult
SkipQC --> BuildResult
BuildResult --> End(["结束"])
```

**图表来源**
- [AI控制器](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/AIController.java)

**章节来源**
- [AI控制器](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/AIController.java)

### AI响应控制器：模型调用与网络恢复
- 功能要点
  - 统一入口：接收AI请求，准备请求头与请求体，支持流式与非流式响应。
  - 模型参数映射：将前端请求参数映射为模型API所需字段，特殊处理inHospitalDeepseek模型名称映射。
  - 响应式重试：在响应式链路中集成retryWhen，指数退避（1s→2s→4s）并加入随机抖动，仅对可重试异常生效。
  - DNS与连接池优化：配置连接池大小、空闲与生命周期、DNS缓存TTL与负缓存，提升网络稳定性。
  - 自动恢复：基于连续失败计数与恢复窗口，达到阈值自动重建WebClient，避免必须重启。
- 超时与重试
  - 连接超时：30秒；读取超时：300秒（5分钟）；最大重试：3次；指数退避与抖动降低重试风暴。
- 健康检查
  - 通过AI控制器的健康检查接口探测外部依赖状态，在degraded状态下触发自动恢复。

```mermaid
sequenceDiagram
participant Client as "客户端"
participant AIResp as "AI响应控制器"
participant AIModel as "AI模型服务"
participant NetSvc as "网络恢复服务"
Client->>AIResp : POST /api/ai/response
AIResp->>AIResp : 准备请求头与请求体
AIResp->>AIModel : 发送请求流式/非流式
AIModel-->>AIResp : 返回响应或错误
alt 响应成功
AIResp->>NetSvc : 重置失败计数
AIResp-->>Client : 返回结果
else 可重试异常
AIResp->>AIResp : 响应式重试指数退避+抖动
AIResp->>NetSvc : 增加失败计数
NetSvc-->>AIResp : 判断是否重建客户端
AIResp->>AIModel : 重试请求
AIResp-->>Client : 返回结果
end
```

**图表来源**
- [AI响应控制器](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/AIResponseController.java)

**章节来源**
- [AI响应控制器](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/AIResponseController.java)

### 综合问题解决技能系统

#### 四阶段AI驱动医疗决策工作流程
系统实现了完整的综合问题解决技能系统，包含四个相互关联的阶段：

**第一阶段：研究阶段（Research）**
- 自动识别患者关键症状和体征
- 检索相关医学文献和指南
- 生成初步诊断假设列表
- 评估各假设的概率和证据强度

**第二阶段：检索阶段（Retrieve）**
- 基于诊断假设检索具体病例
- 收集相似患者的治疗反应数据
- 检索最新的临床试验结果
- 整合多源医学信息

**第三阶段：方案生成阶段（Generate）**
- 生成个性化的治疗方案
- 考虑患者特异性因素（年龄、性别、合并症）
- 评估治疗方案的风险效益比
- 提供治疗选择的循证依据

**第四阶段：修订阶段（Revise）**
- 根据治疗反应动态调整方案
- 检测潜在的药物相互作用
- 监测治疗效果和副作用
- 优化长期管理策略

```mermaid
flowchart TD
Research[研究阶段<br/>症状识别与假设生成] --> Retrieve[检索阶段<br/>证据收集与整合]
Retrieve --> Generate[方案生成阶段<br/>个性化治疗方案]
Generate --> Revise[修订阶段<br/>动态调整与优化]
Revise --> Research
Research --> Evidence[证据支持]
Evidence --> Treatment[治疗执行]
Treatment --> Monitor[监测与随访]
Monitor --> Revise
```

**图表来源**
- [定时Prompt生成器](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/service/TimerPromptGenerator.java)

**章节来源**
- [定时Prompt生成器](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/service/TimerPromptGenerator.java)

### 加密传输与执行服务器协作
- 流程概览
  - 主服务器接收Prompt数据，调用加密接口进行AES加密。
  - 将加密数据保存并发送至执行服务器，执行服务器解密后调用AI模型。
  - 执行服务器对结果进行加密并返回，主服务器解密后落库并返回给前端。
- 关键点
  - EncryptedDataTemp状态管理：RECEIVED、PROCESSING、COMPLETED，确保流程可追溯。
  - 执行服务器严格遵守统一配置规范，避免参数差异导致的推理偏差。

```mermaid
sequenceDiagram
participant Client as "客户端"
participant Main as "主服务器"
participant Encrypt as "加密服务"
participant Exec as "执行服务器"
participant AI as "AI模型服务"
Client->>Main : 提交Prompt数据
Main->>Encrypt : 调用加密接口
Encrypt->>Encrypt : AES加密数据
Encrypt->>Main : 返回加密数据
Encrypt->>Exec : 发送加密数据
Exec->>Exec : 接收并更新状态=PROCESSING
Exec->>Exec : 解密数据
Exec->>AI : 调用AI模型
AI-->>Exec : 返回处理结果
Exec->>Exec : 加密结果
Exec-->>Encrypt : 返回加密结果
Encrypt->>Encrypt : 解密结果
Encrypt->>Main : 返回最终结果
Main-->>Client : 返回诊断结果
```

**图表来源**
- [AI控制器](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/AIController.java)
- [AI响应控制器](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/AIResponseController.java)

**章节来源**
- [AI控制器](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/AIController.java)
- [AI响应控制器](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/AIResponseController.java)

## AI诊断页面增强功能

### AI诊断标签页组件：空状态处理与诊断分析触发
AI诊断标签页组件是本次更新的核心，负责处理AI诊断结果的展示与用户交互。

- **空状态处理机制**
  - 当患者没有诊断分析结果时，显示友好的空状态界面
  - 提供明显的"诊断分析"按钮，引导用户进行诊断分析
  - 使用InfoFilled图标和提示文本，营造专业的医疗界面体验

- **诊断分析触发流程**
  - 点击"诊断分析"按钮触发诊断分析确认对话框
  - 对话框明确列出需要就绪的临床数据清单
  - 提醒用户确认数据完整性以确保分析准确性

- **核心功能实现**
  - `triggerDiagnosisAnalysis()`方法：处理诊断分析触发逻辑
  - ElMessageBox.confirm：弹出确认对话框，包含HTML格式的提醒内容
  - handlePromptExecution：调用工具函数提交诊断分析任务
  - 状态管理：处理成功/失败状态，提供用户反馈

```mermaid
flowchart TD
Start(["用户点击诊断分析按钮"]) --> CheckPatient{"检查是否选择患者"}
CheckPatient --> |未选择| ShowWarning["显示警告提示"]
ShowWarning --> End(["结束"])
CheckPatient --> |已选择| ShowConfirm["显示诊断分析确认对话框"]
ShowConfirm --> CheckDataReady{"检查临床数据是否就绪"}
CheckDataReady --> |未就绪| ShowDataRemind["显示数据就绪提醒"]
CheckDataReady --> |已就绪| PrepareOptions["准备执行选项"]
PrepareOptions --> CallHandlePrompt["调用handlePromptExecution"]
CallHandlePrompt --> SubmitRequest["提交诊断分析请求"]
SubmitRequest --> ShowSuccess["显示成功消息"]
ShowSuccess --> End(["结束"])
```

**图表来源**
- [AI诊断标签页组件](file://med_ai_assistant_1.0_bs_vue/src/components/patient/AIDiagnosisTab.vue)

**章节来源**
- [AI诊断标签页组件](file://med_ai_assistant_1.0_bs_vue/src/components/patient/AIDiagnosisTab.vue)

### 诊断卡片组件：工具栏增强
诊断卡片组件提供了丰富的工具栏操作，包括刷新、新增诊断等常用功能。

- **工具栏功能**
  - 刷新AI诊断列表：重新获取最新的诊断分析结果
  - 新增空白诊断：允许医生手动添加新的诊断条目
  - 诊断列表展示：清晰展示AI提取的诊断列表
  - 诊断项点击：支持点击诊断项进行查看详情

- **交互设计**
  - 使用Element Plus的Button Group组件
  - 提供Tooltip提示，提升用户体验
  - 支持诊断项的选中状态显示

**章节来源**
- [AI诊断标签页组件](file://med_ai_assistant_1.0_bs_vue/src/components/patient/AIDiagnosisTab.vue)

### Prompt执行工具：诊断分析流程支持
handlePromptExecution工具函数为诊断分析提供了完整的执行流程支持。

- **参数处理**
  - 自动检测模板类型，支持"诊断分析"默认类型
  - 处理特殊模板（如"首次病程记录"）的入院记录替补逻辑
  - 并行获取患者数据和模板内容，提升执行效率

- **数据处理**
  - 支持字符串和对象格式的患者数据
  - 自动合并数据为单个字符串
  - 支持附加信息的追加

- **执行选项**
  - 默认优先级：3
  - 默认状态：待处理
  - 支持用户ID、排序号等自定义选项

**章节来源**
- [AI诊断标签页组件](file://med_ai_assistant_1.0_bs_vue/src/components/patient/AIDiagnosisTab.vue)

### AI API模块：诊断分析结果获取
AI API模块提供了诊断分析结果的获取接口。

- **最新结果获取**
  - `getLatestPromptResult()`：根据患者ID和模板名称获取最新分析结果
  - 支持诊断分析模板的专门查询
  - 返回原始结果内容和执行时间信息

- **数据格式**
  - 返回包装格式的响应数据
  - 包含resultId、originalResultContent、executionTime等字段
  - 支持无结果时的null处理

**章节来源**
- [AI API模块](file://med_ai_assistant_1.0_bs_vue/src/api/ai.js)

## 资料收集建议功能

### 资料收集建议控制器：手动触发API
资料收集建议控制器为医生提供了手动触发资料收集建议生成的API端点。

- **功能特性**
  - 手动触发生成：医生点击"刷新建议"按钮时调用此接口
  - 立即响应：接口立即返回processing状态，AI生成任务在后台异步执行
  - 参数校验：验证patientId的有效性和患者的存在性
  - Profile隔离：@Profile("!execution")确保仅在主服务器运行

- **API接口**
  - POST /api/ai/data-collection-advice/generate/{patientId}
  - 响应格式：{"status": "processing"}
  - 状态码：200（成功）、400（参数错误）、404（患者不存在）

- **核心实现**
  - `generateAdvice()`方法：处理手动触发逻辑
  - PatientRepository：验证患者存在性
  - TimerPromptGenerator：异步启动生成任务
  - 状态管理：返回processing状态供前端轮询

```mermaid
sequenceDiagram
participant Doctor as "医生"
participant Controller as "资料收集建议控制器"
participant TimerSvc as "定时任务服务"
participant AIModel as "AI模型服务"
Doctor->>Controller : POST /api/ai/data-collection-advice/generate/{patientId}
Controller->>Controller : 参数校验
Controller->>Controller : 患者存在性检查
Controller->>TimerSvc : generateDataCollectionAdviceForPatient()
TimerSvc->>TimerSvc : generateAndSavePromptOptimized()
TimerSvc->>AIModel : 调用AI模型生成建议
AIModel-->>TimerSvc : 返回生成结果
TimerSvc-->>Controller : 生成完成
Controller-->>Doctor : {"status" : "processing"}
```

**图表来源**
- [资料收集建议控制器](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/DataCollectionAdviceController.java)
- [定时Prompt生成器](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/service/TimerPromptGenerator.java)

**章节来源**
- [资料收集建议控制器](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/DataCollectionAdviceController.java)

### 资料收集建议服务：查询与状态管理
资料收集建议服务负责查询患者最新的资料收集建议结果，支持三种状态管理。

- **状态管理逻辑**
  - 无记录：返回none状态，表示该患者无建议记录
  - 生成中：返回processing状态，表示AI尚未返回结果
  - 已完成：返回completed状态，包含建议内容、生成时间和数据来源标识

- **数据来源标识**
  - 基于诊断分析：检查是否存在诊断分析结果
  - 基于诊疗计划：通过TreatmentPlanItemService真实查询
  - 用于指示当前建议的生成依据来源

- **核心实现**
  - `getLatestAdvice()`：查询最新建议结果
  - `buildBasedOn()`：构建数据来源标识
  - `hasTreatmentPlanData()`：判断是否存在诊疗计划数据

**章节来源**
- [资料收集建议服务](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/service/DataCollectionAdviceService.java)
- [资料收集建议响应DTO](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/dto/DataCollectionAdviceResponse.java)

## 前端组件集成

### 资料收集建议组件：完整状态管理
资料收集建议组件是本次更新的核心前端组件，实现了完整的状态管理和用户交互。

- **四种状态管理**
  - loading状态：显示骨架屏加载效果
  - completed状态：渲染Markdown格式的建议内容
  - processing状态：显示生成中提示
  - empty状态：显示无建议提示和生成按钮

- **核心功能实现**
  - `resetState()`：重置组件状态
  - `loadAdvice()`：加载最新的资料收集建议
  - `handleRefresh()`：处理刷新建议按钮点击事件
  - `formattedTime()`：格式化生成时间显示
  - `renderedContent()`：渲染Markdown内容

- **用户交互设计**
  - 生成时间显示：显示建议的生成时间
  - 刷新按钮：支持手动重新生成建议
  - Markdown渲染：支持三级标题结构的建议内容
  - 基于信息标注：显示建议所依据的数据来源

- **组件生命周期**
  - mounted钩子：初始化时自动加载建议
  - watch监听：监听patient变化，自动重新加载
  - beforeUnmount钩子：组件销毁时清除轮询定时器

**章节来源**
- [资料收集建议组件](file://med_ai_assistant_1.0_bs_vue/src/components/patient/DataCollectionAdvice.vue)

### 资料收集建议API：前后端接口集成
资料收集建议API模块提供了完整的前端接口调用封装。

- **手动触发生成**
  - `generateDataCollectionAdvice(patientId)`：触发资料收集建议生成
  - 立即返回processing状态，AI生成任务在后台异步执行
  - 支持错误处理和用户提示

- **查询建议结果**
  - `getDataCollectionAdvice(patientId)`：查询最新建议结果
  - 返回三种状态：completed、processing、none
  - 包含状态、内容、生成时间和数据来源标识

- **接口规范**
  - POST /ai/data-collection-advice/generate/{patientId}
  - GET /ai/data-collection-advice/{patientId}
  - 支持RESTful风格的API设计

**章节来源**
- [资料收集建议API](file://med_ai_assistant_1.0_bs_vue/src/api/dataCollectionAdvice.js)

### 患者标签页集成：标签页组织
患者标签页组件整合了多个功能标签页，包括新增的资料收集建议标签页。

- **标签页组织**
  - 基本信息、病情小结、AI诊断、病历记录、检查报告等
  - 支持懒加载优化，仅在激活时才挂载组件
  - 提供tooltip提示，改善用户体验

- **AI诊断标签页集成**
  - 位于"病历记录"标签页右侧，作为独立的功能标签页
  - 支持手动刷新和自动轮询
  - 与现有诊断分析功能无缝集成

- **路由配置**
  - 支持路由导航和参数传递
  - 提供滚动行为和锚点定位
  - 支持权限控制和认证

**章节来源**
- [患者标签页组件](file://med_ai_assistant_1.0_bs_vue/src/components/patient/PatientTabs.vue)
- [路由配置](file://med_ai_assistant_1.0_bs_vue/src/router/index.js)

## 轮询管理机制

### 轮询管理器：智能轮询控制
轮询管理器封装了轮询逻辑，支持配置轮询间隔、最大轮询次数、超时回调和错误处理。

- **核心功能**
  - `start()`：启动轮询，支持异步任务执行
  - `stop()`：停止轮询并清除定时器
  - 支持最大轮询次数限制
  - 提供超时回调和错误处理机制

- **配置参数**
  - `task`：每次轮询执行的异步任务，返回Promise
  - `onResult`：每次轮询成功后的回调
  - `onCompleted`：判断是否完成的条件回调
  - `interval`：轮询间隔（默认5000ms）
  - `maxCount`：最大轮询次数（默认60次）
  - `onTimeout`：超时回调
  - `onError`：单次轮询失败回调

- **使用场景**
  - 资料收集建议状态轮询
  - 其他异步任务状态查询
  - 实时数据更新监控

- **生命周期管理**
  - 自动清理定时器，防止内存泄漏
  - 支持组件销毁时的清理
  - 提供停止和重启机制

**章节来源**
- [轮询管理器](file://med_ai_assistant_1.0_bs_vue/src/utils/pollingManager.js)

### 自动轮询机制：状态同步
资料收集建议组件实现了智能的自动轮询机制，确保状态的实时同步。

- **轮询触发时机**
  - 手动触发生成后自动开始轮询
  - 组件挂载时自动加载并可能开始轮询
  - 状态变为processing时自动恢复轮询

- **轮询配置**
  - 轮询间隔：5000ms（5秒）
  - 最大轮询次数：60次（总计5分钟）
  - 超时处理：显示超时错误提示
  - 错误处理：记录警告日志

- **状态判断**
  - `onCompleted`回调：检查status是否为completed
  - 自动停止轮询：状态变为completed时停止
  - 组件销毁：beforeUnmount钩子中停止轮询

- **用户体验**
  - 骨架屏加载：提升加载体验
  - 进度指示：显示生成中状态
  - 错误提示：友好的错误处理
  - 自动恢复：切回页面时自动恢复轮询

**章节来源**
- [资料收集建议组件](file://med_ai_assistant_1.0_bs_vue/src/components/patient/DataCollectionAdvice.vue)

## 状态管理与数据流

### 组件状态管理：四态模型
资料收集建议组件采用了完整的四态模型，确保用户界面的一致性和用户体验。

- **loading状态**
  - 显示骨架屏加载效果
  - 防止用户重复操作
  - 提供视觉反馈

- **completed状态**
  - 渲染Markdown格式的建议内容
  - 显示生成时间和数据来源
  - 支持用户交互操作

- **processing状态**
  - 显示生成中提示和进度图标
  - 阻止用户重复触发生成
  - 提供等待反馈

- **empty状态**
  - 显示无建议提示和生成按钮
  - 引导用户进行首次生成
  - 支持一键触发生成

- **状态转换机制**
  - `loadAdvice()`：加载建议，可能触发processing状态
  - `handleRefresh()`：手动触发生成，设置processing状态
  - 轮询结果：根据API响应自动转换状态

**章节来源**
- [资料收集建议组件](file://med_ai_assistant_1.0_bs_vue/src/components/patient/DataCollectionAdvice.vue)

### 数据流管理：前后端协作
资料收集建议功能实现了完整的数据流管理，从前端状态管理到后端状态同步。

- **前端数据流**
  - 用户操作触发状态更新
  - API调用获取最新数据
  - 轮询机制保持状态同步
  - 错误处理提供用户反馈

- **后端数据流**
  - 手动触发生成异步任务
  - AI模型生成建议内容
  - 状态持久化存储
  - API响应状态查询

- **状态同步机制**
  - 前端轮询查询后端状态
  - 后端根据数据库状态返回
  - 实时状态转换和更新
  - 超时和错误处理

- **数据格式标准**
  - 响应DTO：统一的数据传输格式
  - 状态枚举：completed、processing、none
  - 时间格式：ISO 8601标准格式
  - Markdown内容：结构化建议格式

**章节来源**
- [资料收集建议API](file://med_ai_assistant_1.0_bs_vue/src/api/dataCollectionAdvice.js)
- [资料收集建议服务](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/service/DataCollectionAdviceService.java)
- [资料收集建议响应DTO](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/dto/DataCollectionAdviceResponse.java)

## 用户交互设计

### 用户界面设计：状态反馈
资料收集建议组件提供了完整的用户界面设计，确保良好的用户体验。

- **加载状态界面**
  - 骨架屏动画：提供流畅的加载体验
  - 文本提示：显示加载中状态
  - 图标反馈：使用旋转图标表示加载

- **完成状态界面**
  - 生成时间显示：显示建议生成的具体时间
  - 数据来源标识：显示基于哪些数据生成的建议
  - 刷新按钮：支持手动重新生成
  - Markdown渲染：支持结构化的内容展示

- **生成中状态界面**
  - 进度图标：使用Loading图标表示处理中
  - 文本提示：显示生成中请稍候
  - 状态指示：提供清晰的进度反馈

- **无数据状态界面**
  - 空状态提示：显示暂无建议的友好提示
  - 生成按钮：提供一键生成建议
  - 图标反馈：使用DataAnalysis图标

- **错误状态界面**
  - 错误图标：使用WarningFilled图标
  - 错误信息：显示具体的错误描述
  - 重试按钮：支持一键重试操作

**章节来源**
- [资料收集建议组件](file://med_ai_assistant_1.0_bs_vue/src/components/patient/DataCollectionAdvice.vue)

### 交互流程设计：用户操作
资料收集建议组件设计了完整的用户交互流程，确保操作的直观性和易用性。

- **首次访问流程**
  - 显示empty状态界面
  - 用户点击"生成建议"按钮
  - 触发generateAdvice API
  - 显示processing状态并开始轮询
  - 轮询完成后显示completed状态

- **已有建议流程**
  - 显示completed状态界面
  - 用户点击"刷新建议"按钮
  - 触发重新生成流程
  - 显示processing状态并开始轮询
  - 轮询完成后更新显示

- **错误处理流程**
  - 显示错误状态界面
  - 用户点击"重试"按钮
  - 重新尝试加载或生成
  - 成功后恢复正常状态
  - 失败继续显示错误状态

- **超时处理流程**
  - 轮询达到最大次数
  - 显示超时错误提示
  - 用户可以选择重试
  - 支持手动刷新操作

**章节来源**
- [资料收集建议组件](file://med_ai_assistant_1.0_bs_vue/src/components/patient/DataCollectionAdvice.vue)

### 响应式设计：多设备适配
资料收集建议组件支持响应式设计，适配不同的屏幕尺寸和设备类型。

- **布局适配**
  - 弹性布局：使用CSS Flexbox实现自适应布局
  - 响应式间距：根据屏幕尺寸调整间距和边距
  - 内容折叠：在小屏幕上自动折叠不必要内容

- **交互适配**
  - 触摸友好：按钮大小适合触摸操作
  - 触摸反馈：提供视觉和触觉反馈
  - 导航简化：移动设备上简化导航结构

- **性能优化**
  - 懒加载：组件按需加载，减少初始渲染时间
  - 内存管理：及时清理定时器和事件监听器
  - 资源优化：压缩和优化静态资源

**章节来源**
- [资料收集建议组件](file://med_ai_assistant_1.0_bs_vue/src/components/patient/DataCollectionAdvice.vue)

## 依赖关系分析
- 组件耦合
  - AI控制器依赖Prompt执行引擎与各类数据服务，直接数据库查询降低耦合度与超时风险。
  - AI响应控制器依赖AI模型配置与网络恢复服务，通过WebClient与响应式链路实现高可用。
  - 加密服务与执行服务器形成独立的安全通道，避免敏感数据在主服务器驻留。
  - **新增**：资料收集建议控制器依赖定时任务服务，实现手动触发和异步生成。
  - **新增**：资料收集建议服务依赖PromptResultRepository和TreatmentPlanItemService，提供状态查询和数据组装。
  - **新增**：资料收集建议组件依赖轮询管理器，实现智能轮询控制和状态同步。
  - **新增**：轮询管理器封装通用轮询逻辑，支持多种异步任务状态查询场景。
  - **新增**：AI诊断页面通过handlePromptExecution工具函数与后端API进行交互。
  - **新增**：PatientTabs组件整合多个标签页，支持懒加载优化和标签页切换。
  - **新增**：路由系统支持页面导航和参数传递，提供完整的SPA应用体验。

- 外部依赖
  - 外部AI模型服务（如DeepSeek）与执行服务器，健康状态通过健康检查接口反馈。
  - 数据库：MySQL与Oracle双活，支持动态切换与健康检查。
  - **新增**：Element Plus组件库，提供现代化的UI组件支持。
  - **新增**：Vue.js生态系统，支持组件化开发和状态管理。
  - **新增**：marked和DOMPurify库，提供Markdown渲染和XSS防护。
  - **新增**：轮询管理器作为通用工具，支持多种轮询场景。

```mermaid
graph TB
AI["AI控制器"] --> PromptSvc["Prompt执行引擎"]
AI --> TimerSvc["定时任务服务"]
AI --> DataCollectionAdviceCtrl["资料收集建议控制器"]
AIResp["AI响应控制器"] --> AIModelCfg["AI模型配置"]
AIResp --> NetRecovery["网络恢复服务"]
Encrypt["加密服务"] --> ExecServer["执行服务器"]
PromptSvc --> Repo["Repository层"]
TimerSvc --> PromptResultRepo["PromptResultRepository"]
DataCollectionAdviceCtrl --> TimerSvc
DataCollectionAdviceCtrl --> PatientRepo["PatientRepository"]
DataCollectionAdviceService --> PromptResultRepo
DataCollectionAdviceService --> TreatmentPlanService["TreatmentPlanItemService"]
DataCollectionAdvice["资料收集建议组件"] --> PollingManager["轮询管理器"]
DataCollectionAdvice --> DataCollectionAdviceAPI["资料收集建议API"]
DataCollectionAdviceAPI --> DataCollectionAdviceCtrl
PollingManager --> DataCollectionAdviceAPI
PatientTabs["患者标签页组件"] --> DataCollectionAdvice
PatientView["患者视图组件"] --> PatientTabs
AIDiagnosisTab["AI诊断标签页"] --> handlePromptExecution["Prompt执行工具"]
handlePromptExecution --> getLatestPromptResult["获取最新结果"]
handlePromptExecution --> getPatientData["获取患者数据"]
handlePromptExecution --> getPromptTemplate["获取模板"]
handlePromptExecution --> addPrompt["保存Prompt"]
DataSvc --> Repo
Repo --> MySQL["MySQL"]
Repo --> Oracle["Oracle"]
PromptSvc --> AIModel["AI模型服务"]
DataCollectionAdviceService --> AIModel
```

**图表来源**
- [AI控制器](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/AIController.java)
- [AI响应控制器](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/AIResponseController.java)
- [资料收集建议控制器](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/DataCollectionAdviceController.java)
- [资料收集建议服务](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/service/DataCollectionAdviceService.java)
- [定时Prompt生成器](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/service/TimerPromptGenerator.java)

**章节来源**
- [AI控制器](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/AIController.java)
- [AI响应控制器](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/AIResponseController.java)
- [资料收集建议控制器](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/DataCollectionAdviceController.java)
- [资料收集建议服务](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/service/DataCollectionAdviceService.java)
- [定时Prompt生成器](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/service/TimerPromptGenerator.java)

## 性能考虑
- 网络优化
  - 连接池：最大连接数、空闲与生命周期、后台逐出策略，避免连接泄露与不健康状态滞留。
  - DNS缓存：正缓存1-5分钟、负缓存30秒，降低解析压力与负缓存影响。
  - IPv4优先：减少IPv6环境异常带来的解析问题。
- 响应式重试
  - 指数退避与抖动，避免重试风暴；仅对可重试异常生效，提升成功率。
- 数据查询优化
  - 直接数据库查询替代HTTP自调用，显著降低响应时间与超时风险。
  - **新增**：PromptResultRepository使用LIKE操作符优化模板名称查询，提升查询性能。
  - **新增**：定时任务批量生成Prompt，减少重复查询开销。
  - **新增**：资料收集建议模板的条件查询优化，仅查询符合条件的患者。
- 超时与重试参数
  - 连接超时30秒、读取超时300秒、最大重试3次，平衡用户体验与资源消耗。
- **新增**：前端组件优化
  - 空状态处理：避免不必要的API调用，提升页面响应速度
  - 并行数据获取：通过handlePromptExecution工具函数实现多接口并发请求
  - **新增**：模板过滤：前端直接过滤不需要显示的模板，减少数据传输
  - **新增**：智能轮询机制：前端组件根据状态智能轮询，completed状态后停止轮询
  - **新增**：组件懒加载：按需加载资料收集建议组件，提升首屏性能
  - **新增**：轮询管理器复用：多个组件共享轮询逻辑，减少代码重复
  - **新增**：内存管理：及时清理定时器和事件监听器，防止内存泄漏
  - **新增**：错误边界：提供错误处理和降级机制，提升系统稳定性

**章节来源**
- [AI响应控制器](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/AIResponseController.java)

## 故障排除指南
- 网络中断后连接失败
  - 现象：/api/ai/response偶发"无法连接到DeepSeek"，健康检查返回degraded。
  - 根因：DNS负缓存、连接池状态不健康、重试位置不当。
  - 解决：响应式重试、DNS与连接池优化、自动重建客户端、健康探测与自动恢复。
- 健康检查
  - 通过/checkAIStatus接口探测外部依赖可达性；在degraded状态下触发自动恢复。
- 运维排查
  - DNS：刷新缓存、指定可信DNS、验证端口连通性。
  - 代理/防火墙：检查策略与SSL拦截；确认443出口畅通。
  - 配置：核对ai-models.properties的URL与密钥，确保无空格与未过期。
- **新增**：资料收集建议功能排查
  - 手动触发API无响应：检查资料收集建议控制器的日志和定时任务服务状态
  - 建议内容不显示：验证AI模型服务的可用性和生成结果的存储状态
  - 轮询不工作：检查轮询管理器的配置和定时器状态
  - 状态不同步：验证前后端状态转换逻辑和API响应格式
  - 组件加载失败：确认Vue组件的正确引入和依赖版本兼容性
  - 数据组装异常：验证AI控制器的数据组装逻辑和相关服务的可用性
- **新增**：轮询管理器问题排查
  - 轮询不触发：检查task函数的正确性和Promise处理
  - 超时处理异常：验证maxCount配置和onTimeout回调
  - 内存泄漏：确认beforeUnmount钩子中调用了stop()方法
  - 状态判断错误：检查onCompleted回调的逻辑和返回值
- **新增**：前端组件问题排查
  - 状态显示异常：检查组件data属性的初始化和computed属性的计算
  - 事件处理错误：验证methods中函数的正确性和this绑定
  - 生命周期问题：确认mounted和beforeUnmount钩子的正确实现

**章节来源**
- [AI响应控制器](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/AIResponseController.java)

## 结论
本系统通过"模板驱动的数据聚合、响应式重试与DNS/连接池优化、自动恢复机制"三大支柱，实现了高可用、高性能的AI诊断辅助能力。AI控制器与AI响应控制器分别承担业务编排与模型调用职责，配合加密传输与执行服务器，确保敏感数据安全与推理一致性。通过完善的健康检查与运维排障机制，系统在网络波动与异常情况下仍能保持稳定运行。

**新增功能总结**
- 综合问题解决技能系统：实现了研究、检索、方案生成和修订四个阶段的AI驱动医疗决策工作流程，提升诊断的系统性和科学性
- AI诊断页面空状态处理：通过友好的空状态界面和明确的操作按钮，提升了用户体验
- 诊断分析确认机制：通过临床数据就绪提醒，确保分析质量，减少因数据不完整导致的误诊风险
- 工作流程优化：为医生提供了更清晰的诊断分析流程，提高了工作效率
- **新增**：资料收集建议功能：包括定时批量生成和手动触发API，为医生提供进一步问诊、查体、辅助检查的智能化建议
- **新增**：完整的前端组件集成：DataCollectionAdvice组件具备完整的状态管理、自动轮询机制和用户交互
- **新增**：轮询管理器：封装通用轮询逻辑，支持智能轮询控制和超时处理
- **新增**：智能轮询机制：前端组件根据状态智能轮询，completed状态后自动停止，节省系统资源
- **新增**：状态管理优化：四态模型确保用户界面的一致性和用户体验
- **新增**：组件懒加载：按需加载资料收集建议组件，提升首屏性能
- **新增**：错误处理机制：提供完整的错误处理和降级机制，提升系统稳定性
- **新增**：响应式设计：适配不同屏幕尺寸，提供良好的移动端体验

## 附录
- 实际使用示例
  - 获取患者数据：GET /api/ai/patient-data?patientId={id}&promptType={type}&promptName={name}
  - 保存AI结果：POST /api/ai/saveAIResult（请求体包含promptId与结果内容）
  - 健康检查：GET /api/ai/health/ai-status
  - **新增**：获取最新诊断分析结果：GET /api/ai/latestPromptResult?patientId={id}&promptName=诊断分析
  - **新增**：获取患者综合信息：GET /api/ai/patient-comprehensive-info?patientId={id}
  - **新增**：获取Prompt列表详情：GET /api/ai/patientPromptDetails?patientId={id}
  - **新增**：手动触发资料收集建议：POST /api/ai/data-collection-advice/generate/{patientId}
  - **新增**：查询资料收集建议结果：GET /api/ai/data-collection-advice/{patientId}
  - **新增**：启动定时器：GET /timer-prompt-generator/start
  - **新增**：停止定时器：GET /timer-prompt-generator/stop
  - **新增**：查询定时器状态：GET /timer-prompt-generator/status
  - **新增**：手动触发每日生成：GET /timer-prompt-generator/trigger-daily
- 最佳实践
  - 优先使用模板驱动的数据类型配置，确保数据完整性与一致性。
  - 在网络波动环境中启用响应式重试与自动恢复，避免人工干预。
  - 定期检查DNS与连接池配置，维持最优性能与稳定性。
  - 对敏感数据采用加密传输，确保合规与安全。
  - **新增**：在进行诊断分析前，确保所有必要的临床数据已就绪，以获得准确的分析结果。
  - **新增**：利用AI诊断页面的空状态提示，及时触发诊断分析，避免遗漏重要的诊断信息。
  - **新增**：合理使用病情小结模板过滤功能，确保AI助手页面的整洁性和用户体验。
  - **新增**：充分利用资料收集建议功能，提升问诊质量和效率，减少漏诊风险。
  - **新增**：合理配置轮询间隔和最大轮询次数，平衡用户体验和系统资源消耗。
  - **新增**：利用轮询管理器的错误处理机制，提升系统的健壮性和用户体验。
  - **新增**：通过组件懒加载优化首屏性能，提升用户感知速度。
  - **新增**：在组件销毁时及时清理轮询定时器，防止内存泄漏和资源浪费。