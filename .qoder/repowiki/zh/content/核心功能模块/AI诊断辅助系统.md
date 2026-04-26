# AI诊断辅助系统

<cite>
**本文档引用的文件**
- [ARCHITECTURE_DIAGRAPH.md](file://med_ai_assistant_1.0_bs_backend/doc/其他/ARCHITECTURE_DIAGRAMS.md)
- [AI响应接口网络中断后连接失败问题分析与解决方案.md](file://med_ai_assistant_1.0_bs_backend/doc/其他/AI响应接口网络中断后连接失败问题分析与解决方案.md)
- [AI模型配置](file://med_ai_assistant_1.0_bs_backend/src/main/resources/ai-models.properties)
- [AI控制器](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/AIController.java)
- [AI响应控制器](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/AIResponseController.java)
- [AI模型配置类](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/config/AIModelConfig.java)
- [网络恢复服务](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/service/NetworkRecoveryService.java)
- [PromptList.vue](file://med_ai_assistant_1.0_bs_vue/src/components/ai/PromptList.vue)
- [AIDiagnosisTab.vue](file://med_ai_assistant_1.0_bs_vue/src/components/patient/AIDiagnosisTab.vue)
- [AIView.vue](file://med_ai_assistant_1.0_bs_vue/src/views/AIView.vue)
- [promptUtils.js](file://med_ai_assistant_1.0_bs_vue/src/utils/promptUtils.js)
- [ai.js](file://med_ai_assistant_1.0_bs_vue/src/api/ai.js)
- [PromptListDTO.java](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/dto/PromptListDTO.java)
- [PromptResultRepository.java](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/repository/PromptResultRepository.java)
</cite>

## 更新摘要
**变更内容**
- 新增病情小结模板过滤功能，前端PromptList组件在AI助手页面中排除了'病情小结'模板
- 后端AIController提供支持的API接口，包括患者综合信息获取和病情小结数据处理
- PromptResultRepository优化了病情小结、查房记录、入院记录的查询逻辑
- TimerPromptGenerator定时任务中新增病情小结生成逻辑

## 目录
1. [简介](#简介)
2. [项目结构](#项目结构)
3. [核心组件](#核心组件)
4. [架构总览](#架构总览)
5. [详细组件分析](#详细组件分析)
6. [AI诊断页面增强功能](#ai诊断页面增强功能)
7. [病情小结模板过滤功能](#病情小结模板过滤功能)
8. [依赖关系分析](#依赖关系分析)
9. [性能考虑](#性能考虑)
10. [故障排除指南](#故障排除指南)
11. [结论](#结论)
12. [附录](#附录)

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
- **新增**：AI诊断页面空状态处理与临床数据就绪提醒机制
- **新增**：病情小结模板过滤功能，优化AI助手页面的模板展示

## 项目结构
系统采用分层架构，核心围绕AI控制器、AI响应控制器、模型配置与网络恢复服务展开，配合Prompt执行引擎与数据服务模块，形成完整的AI诊断辅助闭环。

```mermaid
graph TB
subgraph "前端层"
FE[前端应用]
AIView[AI视图组件]
AIDiagnosisTab[AI诊断标签页]
PromptList[Prompt列表组件]
DiagnosisCard[诊断卡片组件]
DiagnosisEditPanel[诊断编辑面板]
end
subgraph "API网关层"
Gateway[API网关<br/>端口: 8081]
end
subgraph "业务服务层"
AI[AI服务模块<br/>AIController]
AIResp[AI响应模块<br/>AIResponseController]
Patient[患者管理模块<br/>PatientController]
User[用户管理模块<br/>UserController]
Encrypt[加密服务模块<br/>EncryptionController]
end
subgraph "核心服务层"
PromptSvc[Prompt执行引擎<br/>PromptService]
DataSvc[数据处理服务<br/>各种Service]
EncryptSvc[加密解密服务<br/>AESEncryptionUtil]
TimerSvc[定时任务服务<br/>TimerPromptGenerator]
end
subgraph "数据访问层"
Repo[Repository层<br/>JPA接口]
PromptResultRepo[PromptResultRepository]
end
subgraph "数据存储层"
MySQL[(MySQL数据库<br/>患者数据)]
Oracle[(Oracle数据库<br/>生产环境)]
end
subgraph "外部服务"
ExecutionServer[执行服务器<br/>100.66.1.2:8082]
AIModel[AI模型服务<br/>DeepSeek等]
end
FE --> AIView
AIView --> AIDiagnosisTab
AIView --> PromptList
AIDiagnosisTab --> DiagnosisCard
AIDiagnosisTab --> DiagnosisEditPanel
Gateway --> AI
Gateway --> AIResp
Gateway --> Patient
Gateway --> User
Gateway --> Encrypt
AI --> PromptSvc
AI --> TimerSvc
AIResp --> AIModel
Patient --> DataSvc
Encrypt --> EncryptSvc
PromptSvc --> Repo
PromptResultRepo --> Repo
DataSvc --> Repo
Repo --> MySQL
Repo --> Oracle
EncryptSvc --> ExecutionServer
PromptSvc --> AIModel
```

**图表来源**
- [ARCHITECTURE_DIAGRAPH.md](file://med_ai_assistant_1.0_bs_backend/doc/其他/ARCHITECTURE_DIAGRAMS.md)

**章节来源**
- [ARCHITECTURE_DIAGRAPH.md](file://med_ai_assistant_1.0_bs_backend/doc/其他/ARCHITECTURE_DIAGRAMS.md)

## 核心组件
- AI控制器：负责Prompt模板管理、患者数据聚合与格式化、对话历史保存、结果查询与状态管理。优化后直接数据库查询，消除HTTP自调用死锁与超时问题。
- AI响应控制器：面向外部AI模型的统一入口，支持流式与非流式响应，集成响应式重试、DNS与连接池优化、网络恢复自动重建。
- AI模型配置类：集中管理多模型配置（URL、密钥、超时、重试），提供配置校验与默认模型选择。
- 网络恢复服务：维护连续失败计数与恢复窗口，达到阈值自动重建WebClient，保障网络波动后的可用性。
- 加密服务与执行服务器：在加密传输模式下，主服务器将敏感数据加密后发送至执行服务器，执行服务器解密后调用AI模型，再加密返回。
- **新增**：AI诊断标签页组件：负责AI诊断结果的展示、空状态处理、诊断分析触发等功能。
- **新增**：诊断卡片组件：提供诊断列表展示、工具栏操作、诊断分析触发等交互功能。
- **新增**：Prompt列表组件：负责展示Prompt执行历史，包含病情小结模板过滤功能。
- **新增**：定时任务服务：负责定期生成诊断分析、诊疗计划、病情小结等Prompt任务。

**章节来源**
- [AI控制器](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/AIController.java)
- [AI响应控制器](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/AIResponseController.java)
- [AI模型配置类](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/config/AIModelConfig.java)
- [网络恢复服务](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/service/NetworkRecoveryService.java)
- [AIDiagnosisTab.vue](file://med_ai_assistant_1.0_bs_vue/src/components/patient/AIDiagnosisTab.vue)
- [DiagnosisCard.vue](file://med_ai_assistant_1.0_bs_vue/src/components/ai/DiagnosisCard.vue)
- [PromptList.vue](file://med_ai_assistant_1.0_bs_vue/src/components/ai/PromptList.vue)
- [TimerPromptGenerator.java](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/service/TimerPromptGenerator.java)

## 架构总览
系统整体分为前端层、API网关层、业务服务层、核心服务层、数据访问层与数据存储层，以及外部AI模型与执行服务器。AI控制器与AI响应控制器分别承担业务编排与模型调用职责，Prompt执行引擎与数据服务模块提供数据支撑，加密服务与执行服务器实现安全的远程推理。

```mermaid
graph TB
subgraph "业务编排"
AI[AI控制器]
PromptSvc[Prompt执行引擎]
TimerSvc[定时任务服务]
AIDiagnosisTab[AI诊断标签页]
PromptList[Prompt列表组件]
DiagnosisCard[诊断卡片组件]
end
subgraph "模型调用"
AIResp[AI响应控制器]
AIModel[AI模型服务]
handlePromptExecution[Prompt执行工具]
getLatestPromptResult[获取最新结果]
getPatientData[获取患者数据]
getPromptTemplate[获取模板]
addPrompt[保存Prompt]
end
subgraph "数据支撑"
DataSvc[数据处理服务]
Repo[Repository层]
MySQL[(MySQL)]
Oracle[(Oracle)]
apiAI[AI API模块]
PromptResultRepo[PromptResultRepository]
end
subgraph "安全与执行"
Encrypt[加密服务]
ExecServer[执行服务器]
end
AI --> PromptSvc
AI --> TimerSvc
AIDiagnosisTab --> DiagnosisCard
AIDiagnosisTab --> handlePromptExecution
AIDiagnosisTab --> getLatestPromptResult
AIDiagnosisTab --> apiAI
PromptList --> PromptResultRepo
handlePromptExecution --> getPatientData
handlePromptExecution --> getPromptTemplate
handlePromptExecution --> addPrompt
AIResp --> AIModel
PromptSvc --> Repo
TimerSvc --> PromptResultRepo
DataSvc --> Repo
Encrypt --> ExecServer
PromptSvc --> AIModel
```

**图表来源**
- [ARCHITECTURE_DIAGRAPH.md](file://med_ai_assistant_1.0_bs_backend/doc/其他/ARCHITECTURE_DIAGRAMS.md)

**章节来源**
- [ARCHITECTURE_DIAGRAPH.md](file://med_ai_assistant_1.0_bs_backend/doc/其他/ARCHITECTURE_DIAGRAMS.md)

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
- [网络恢复服务](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/service/NetworkRecoveryService.java)

**章节来源**
- [AI响应控制器](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/AIResponseController.java)
- [网络恢复服务](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/service/NetworkRecoveryService.java)

### AI模型配置：多模型与参数管理
- 功能要点
  - 配置绑定：以"ai"为前缀的配置属性，支持全局流式开关与多模型配置。
  - 模型配置：包含URL、密钥、连接/读取超时、最大重试次数、初始重试延迟等。
  - 配置校验：提供有效性检查与URL格式验证，支持默认模型选择与有效模型枚举。
  - 安全摘要：对外展示时隐藏密钥，便于运维审计。
- 配置示例
  - 支持DeepSeek聊天与推理模型，以及院内模型配置，便于后续扩展与替换。

**章节来源**
- [AI模型配置类](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/config/AIModelConfig.java)
- [AI模型配置](file://med_ai_assistant_1.0_bs_backend/src/main/resources/ai-models.properties)

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
- [ARCHITECTURE_DIAGRAPH.md](file://med_ai_assistant_1.0_bs_backend/doc/其他/ARCHITECTURE_DIAGRAMS.md)

**章节来源**
- [ARCHITECTURE_DIAGRAPH.md](file://med_ai_assistant_1.0_bs_backend/doc/其他/ARCHITECTURE_DIAGRAMS.md)

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
ShowDataRemind --> WaitUserAction["等待用户确认"]
CheckDataReady --> |已就绪| PrepareOptions["准备执行选项"]
PrepareOptions --> CallHandlePrompt["调用handlePromptExecution"]
CallHandlePrompt --> SubmitRequest["提交诊断分析请求"]
SubmitRequest --> ShowSuccess["显示成功消息"]
ShowSuccess --> End(["结束"])
WaitUserAction --> UserCancel{"用户取消？"}
UserCancel --> |是| End
UserCancel --> |否| PrepareOptions
```

**图表来源**
- [AIDiagnosisTab.vue](file://med_ai_assistant_1.0_bs_vue/src/components/patient/AIDiagnosisTab.vue)

**章节来源**
- [AIDiagnosisTab.vue](file://med_ai_assistant_1.0_bs_vue/src/components/patient/AIDiagnosisTab.vue)

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
- [DiagnosisCard.vue](file://med_ai_assistant_1.0_bs_vue/src/components/ai/DiagnosisCard.vue)

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
- [promptUtils.js](file://med_ai_assistant_1.0_bs_vue/src/utils/promptUtils.js)

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
- [ai.js](file://med_ai_assistant_1.0_bs_vue/src/api/ai.js)

## 病情小结模板过滤功能

### 前端过滤实现
PromptList组件实现了病情小结模板的过滤逻辑，确保AI助手页面不显示病情小结模板。

- **过滤逻辑**
  - 排除DRG分析专用模板：主要诊断、手术/操作分析，合并症或并发症分析
  - 排除质控评估模板：QC-第一阶段-AI诊断匹配，QC-第三阶段-AI质控评估
  - **新增**：排除'病情小结'模板，避免与AI诊断辅助页面重复
  - 排除包含'诊断分析'的模板，这些模板已移至AI诊断辅助标签页

- **模板分类**
  - 已执行列表：statusName === "已完成"的Prompt（有PromptResult记录）
  - 未执行列表：statusName !== "已完成"的Prompt（包括"已处理"、"待处理"等，无PromptResult）

```mermaid
flowchart TD
Start(["加载Prompt列表"]) --> FilterTemplates["过滤模板"]
FilterTemplates --> CheckExcluded{"检查是否在排除列表"}
CheckExcluded --> |是| Exclude["排除该模板"]
CheckExcluded --> |否| CheckContains{"检查是否包含'诊断分析'"}
CheckContains --> |是| Exclude
CheckContains --> |否| Include["包含该模板"]
Exclude --> Classify["分类到相应列表"]
Include --> Classify
Classify --> Sort["按执行时间排序"]
Sort --> End(["完成"])
```

**图表来源**
- [PromptList.vue](file://med_ai_assistant_1.0_bs_vue/src/components/ai/PromptList.vue)

**章节来源**
- [PromptList.vue](file://med_ai_assistant_1.0_bs_vue/src/components/ai/PromptList.vue)

### 后端数据支持
AI控制器和Repository层提供了完整的数据支持，包括病情小结的查询和处理。

- **AI控制器数据处理**
  - 病情小结数据类型处理：直接查询medicalRecordRepository
  - 过滤recordType包含"病情小结"的记录
  - 提供最新的病情小结内容，格式化输出

- **Repository查询优化**
  - PromptResultRepository优化了病情小结、查房记录、入院记录的查询
  - 使用LIKE操作符进行模板名称匹配
  - 支持多种记录类型的组合查询

- **定时任务支持**
  - TimerPromptGenerator定时任务中新增病情小结生成逻辑
  - 生成基础Prompt（诊断分析、诊疗计划、病情小结）
  - 支持每日自动化的病情小结生成

**章节来源**
- [AI控制器](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/AIController.java)
- [PromptResultRepository.java](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/repository/PromptResultRepository.java)
- [TimerPromptGenerator.java](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/service/TimerPromptGenerator.java)

## 依赖关系分析
- 组件耦合
  - AI控制器依赖Prompt执行引擎与各类数据服务，直接数据库查询降低耦合度与超时风险。
  - AI响应控制器依赖AI模型配置与网络恢复服务，通过WebClient与响应式链路实现高可用。
  - 加密服务与执行服务器形成独立的安全通道，避免敏感数据在主服务器驻留。
  - **新增**：AIDiagnosisTab组件依赖DiagnosisCard组件和DiagnosisEditPanel组件，形成完整的诊断展示体系。
  - **新增**：AI诊断页面通过handlePromptExecution工具函数与后端API进行交互。
  - **新增**：PromptList组件依赖PromptResultRepository进行数据查询，实现模板过滤功能。
  - **新增**：TimerPromptGenerator服务依赖AI控制器的定时任务生成逻辑。

- 外部依赖
  - 外部AI模型服务（如DeepSeek）与执行服务器，健康状态通过健康检查接口反馈。
  - 数据库：MySQL与Oracle双活，支持动态切换与健康检查。
  - **新增**：Element Plus组件库，提供现代化的UI组件支持。

```mermaid
graph TB
AI["AI控制器"] --> PromptSvc["Prompt执行引擎"]
AI --> TimerSvc["定时任务服务"]
AIResp["AI响应控制器"] --> AIModelCfg["AI模型配置"]
AIResp --> NetRecovery["网络恢复服务"]
Encrypt["加密服务"] --> ExecServer["执行服务器"]
PromptSvc --> Repo["Repository层"]
TimerSvc --> PromptResultRepo["PromptResultRepository"]
DataSvc --> Repo
Repo --> MySQL["MySQL"]
Repo --> Oracle["Oracle"]
PromptSvc --> AIModel["AI模型服务"]
AIDiagnosisTab["AI诊断标签页"] --> DiagnosisCard["诊断卡片组件"]
AIDiagnosisTab --> DiagnosisEditPanel["诊断编辑面板"]
AIDiagnosisTab --> handlePromptExecution["Prompt执行工具"]
PromptList["Prompt列表组件"] --> PromptResultRepo
handlePromptExecution --> getLatestPromptResult["获取最新结果"]
handlePromptExecution --> getPatientData["获取患者数据"]
handlePromptExecution --> getPromptTemplate["获取模板"]
handlePromptExecution --> addPrompt["保存Prompt"]
```

**图表来源**
- [ARCHITECTURE_DIAGRAPH.md](file://med_ai_assistant_1.0_bs_backend/doc/其他/ARCHITECTURE_DIAGRAMS.md)

**章节来源**
- [ARCHITECTURE_DIAGRAPH.md](file://med_ai_assistant_1.0_bs_backend/doc/其他/ARCHITECTURE_DIAGRAMS.md)

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
- 超时与重试参数
  - 连接超时30秒、读取超时300秒、最大重试3次，平衡用户体验与资源消耗。
- **新增**：前端组件优化
  - 空状态处理：避免不必要的API调用，提升页面响应速度
  - 并行数据获取：通过handlePromptExecution工具函数实现多接口并发请求
  - **新增**：模板过滤：前端直接过滤不需要显示的模板，减少数据传输

**章节来源**
- [AI响应接口网络中断后连接失败问题分析与解决方案.md](file://med_ai_assistant_1.0_bs_backend/doc/其他/AI响应接口网络中断后连接失败问题分析与解决方案.md)

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
- **新增**：AI诊断页面问题排查
  - 空状态按钮无响应：检查handlePromptExecution函数调用和ElMessageBox配置
  - 诊断分析确认对话框显示异常：验证HTML格式的提醒内容和dangerouslyUseHTMLString配置
  - 诊断结果不显示：检查getLatestPromptResult API调用和数据格式
  - **新增**：病情小结模板不显示：检查PromptList组件的过滤逻辑和后端模板名称匹配
  - **新增**：定时任务生成异常：检查TimerPromptGenerator的配置和数据库连接

**章节来源**
- [AI响应接口网络中断后连接失败问题分析与解决方案.md](file://med_ai_assistant_1.0_bs_backend/doc/其他/AI响应接口网络中断后连接失败问题分析与解决方案.md)

## 结论
本系统通过"模板驱动的数据聚合、响应式重试与DNS/连接池优化、自动恢复机制"三大支柱，实现了高可用、高性能的AI诊断辅助能力。AI控制器与AI响应控制器分别承担业务编排与模型调用职责，配合加密传输与执行服务器，确保敏感数据安全与推理一致性。通过完善的健康检查与运维排障机制，系统在网络波动与异常情况下仍能保持稳定运行。

**新增功能总结**
- AI诊断页面空状态处理：通过友好的空状态界面和明确的操作按钮，提升了用户体验
- 诊断分析确认机制：通过临床数据就绪提醒，确保分析质量，减少因数据不完整导致的误诊风险
- 工作流程优化：为医生提供了更清晰的诊断分析流程，提高了工作效率
- **新增**：病情小结模板过滤功能：优化AI助手页面的模板展示，避免重复显示，提升用户体验
- **新增**：完整的数据支持：后端提供病情小结的查询、处理和定时生成支持，确保数据完整性

## 附录
- 实际使用示例
  - 获取患者数据：GET /api/ai/patient-data?patientId={id}&promptType={type}&promptName={name}
  - 保存AI结果：POST /api/ai/saveAIResult（请求体包含promptId与结果内容）
  - 健康检查：GET /api/ai/health/ai-status
  - **新增**：获取最新诊断分析结果：GET /api/ai/latestPromptResult?patientId={id}&promptName=诊断分析
  - **新增**：获取患者综合信息：GET /api/ai/patient-comprehensive-info?patientId={id}
  - **新增**：获取Prompt列表详情：GET /api/ai/patientPromptDetails?patientId={id}
- 最佳实践
  - 优先使用模板驱动的数据类型配置，确保数据完整性与一致性。
  - 在网络波动环境中启用响应式重试与自动恢复，避免人工干预。
  - 定期检查DNS与连接池配置，维持最优性能与稳定性。
  - 对敏感数据采用加密传输，确保合规与安全。
  - **新增**：在进行诊断分析前，确保所有必要的临床数据已就绪，以获得准确的分析结果。
  - **新增**：利用AI诊断页面的空状态提示，及时触发诊断分析，避免遗漏重要的诊断信息。
  - **新增**：合理使用病情小结模板过滤功能，确保AI助手页面的整洁性和用户体验。
  - **新增**：定期检查定时任务的执行情况，确保病情小结等自动化功能正常运行。