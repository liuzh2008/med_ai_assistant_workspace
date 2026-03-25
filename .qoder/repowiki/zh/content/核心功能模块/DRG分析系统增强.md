# DRG分析系统增强

<cite>
**本文档引用的文件**
- [MedAiAssistantBackendApplication.java](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/MedAiAssistantBackendApplication.java)
- [HomeController.java](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/HomeController.java)
- [AIModelConfig.java](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/config/AIModelConfig.java)
- [AIRouterConfig.java](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/config/AIRouterConfig.java)
- [AIResponseController.java](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/AIResponseController.java)
- [RetryUtil.java](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/util/RetryUtil.java)
- [AIRequest.java](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/dto/AIRequest.java)
- [README.md](file://med_ai_assistant_1.0_bs_backend/deploy/README.md)
- [DRG分析接口.md](file://med_ai_assistant_1.0_bs_backend/doc/接口/DRG分析接口.md)
- [DRG分析API接口.md](file://med_ai_assistant_1.0_bs_backend/doc/系统结构/DRG分析/DRG分析API接口.md)
- [DiagnosisController.java](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/DiagnosisController.java)
- [SurgeryController.java](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/SurgeryController.java)
- [DrgAnalysisController.java](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/DrgAnalysisController.java)
- [DrgMatchingController.java](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/DrgMatchingController.java)
- [DrgCatalogController.java](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/DrgCatalogController.java)
- [DrgAiAnalysisController.java](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/DrgAiAnalysisController.java)
- [DrgProfitLossController.java](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/DrgProfitLossController.java)
- [DrgSnapshotController.java](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/DrgSnapshotController.java)
- [DrgAnalysisOrchestrator.java](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/drg/orchestrator/DrgAnalysisOrchestrator.java)
- [PrimaryDiagnosisProcedureMatcher.java](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/drg/matching/PrimaryDiagnosisProcedureMatcher.java)
- [DrgCatalogLoader.java](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/drg/catalog/DrgCatalogLoader.java)
- [DrgAiAnalysisService.java](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/service/DrgAiAnalysisService.java)
- [DrgAnalysisService.java](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/service/DrgAnalysisService.java)
- [DrgAnalysisResultRepository.java](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/repository/DrgAnalysisResultRepository.java)
- [DiagnosisRepository.java](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/repository/DiagnosisRepository.java)
- [SurgeryRepository.java](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/repository/SurgeryRepository.java)
- [Diagnosis.java](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/model/Diagnosis.java)
- [Surgery.java](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/model/Surgery.java)
- [Drg.java](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/model/Drg.java)
- [DrgAnalysisInputSnapshot.java](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/model/DrgAnalysisInputSnapshot.java)
- [DrgAnalysisRequestDTO.java](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/dto/drg/DrgAnalysisRequestDTO.java)
- [DrgAnalysisResultDTO.java](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/dto/drg/DrgAnalysisResultDTO.java)
- [DrgParsedRecord.java](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/dto/drg/DrgParsedRecord.java)
- [DiagnosisEntry.java](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/dto/drg/DiagnosisEntry.java)
- [PatientDiagnosis.java](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/dto/drg/PatientDiagnosis.java)
- [Stage2 DRG Analysis Verification Report.md](file://med_ai_assistant_1.0_bs_backend/doc/其他/阶段2-DRG分析功能完成验证.md)
- [Update Log.md](file://更新小结.md)
</cite>

## 更新摘要
**所做更改**
- 新增DRG分析页面重构相关内容，包括患者医疗信息卡片设计
- 新增诊断列表和手术列表双列表架构说明
- 新增诊断类型切换和唯一主要诊断规则说明
- 新增手术类型切换和唯一主要手术规则说明
- 新增从后端API获取真实诊断和手术数据的接口文档
- 更新DRG分析API接口文档，反映新的页面重构需求

## 目录
1. [项目概述](#项目概述)
2. [系统架构](#系统架构)
3. [核心组件分析](#核心组件分析)
4. [AI模型配置系统](#ai模型配置系统)
5. [响应式AI服务](#响应式ai服务)
6. [重试机制设计](#重试机制设计)
7. [DRG分析页面重构](#drg分析页面重构)
8. [患者医疗信息卡片](#患者医疗信息卡片)
9. [诊断列表管理](#诊断列表管理)
10. [手术列表管理](#手术列表管理)
11. [后端API接口](#后端api接口)
12. [部署架构](#部署架构)
13. [性能优化特性](#性能优化特性)
14. [故障排查指南](#故障排查指南)
15. [总结](#总结)

## 项目概述

DRG分析系统增强项目是一个基于Spring Boot的企业级医疗AI助手后端系统。该系统专门为DRG（Diagnosis Related Groups）分析场景提供智能化的医疗数据分析能力，集成了先进的AI模型调用、响应式编程和高可用性架构设计。

### 系统特性

- **多模型支持**：支持多种AI模型配置，包括DeepSeek等主流大语言模型
- **响应式编程**：采用WebFlux实现高并发的流式数据处理
- **智能重试机制**：内置指数退避和抖动算法，确保网络波动下的稳定性
- **分布式部署**：支持主服务器和执行服务器的分离部署架构
- **企业级安全**：完善的配置管理和安全防护机制
- **页面重构支持**：全新DRG分析页面设计，支持患者医疗信息卡片展示

**章节来源**
- [MedAiAssistantBackendApplication.java:1-50](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/MedAiAssistantBackendApplication.java#L1-L50)
- [README.md:1-250](file://med_ai_assistant_1.0_bs_backend/deploy/README.md#L1-L250)

## 系统架构

系统采用分层架构设计，将AI服务调用、配置管理、响应式处理和安全控制有机结合。

```mermaid
graph TB
subgraph "客户端层"
WebApp[Web应用]
MobileApp[移动应用]
API[外部API]
end
subgraph "网关层"
MainServer[主服务器]
ExecutionServer[执行服务器]
end
subgraph "AI服务层"
AIModelConfig[AI模型配置]
AIResponseController[AI响应控制器]
RetryUtil[重试工具]
end
subgraph "DRG分析服务层"
DrgAnalysisController[DRG分析控制器]
DrgMatchingController[DRG匹配控制器]
DrgCatalogController[DRG目录控制器]
DrgAiAnalysisController[DRG AI分析控制器]
end
subgraph "数据访问层"
DiagnosisRepository[诊断数据访问]
SurgeryRepository[手术数据访问]
DrgAnalysisResultRepository[分析结果数据访问]
end
subgraph "基础设施层"
Database[(数据库)]
Redis[(Redis缓存)]
HttpClient[优化HTTP客户端]
end
WebApp --> MainServer
MobileApp --> MainServer
API --> MainServer
MainServer --> ExecutionServer
ExecutionServer --> AIModelConfig
AIModelConfig --> AIResponseController
AIResponseController --> RetryUtil
RetryUtil --> HttpClient
MainServer --> DrgAnalysisController
DrgAnalysisController --> DrgMatchingController
DrgMatchingController --> DrgCatalogController
DrgCatalogController --> DrgAiAnalysisController
DrgAnalysisController --> DiagnosisRepository
DrgAnalysisController --> SurgeryRepository
DrgAnalysisController --> DrgAnalysisResultRepository
MainServer --> Database
MainServer --> Redis
ExecutionServer --> Database
```

**图表来源**
- [MedAiAssistantBackendApplication.java:26-37](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/MedAiAssistantBackendApplication.java#L26-L37)
- [AIResponseController.java:75-87](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/AIResponseController.java#L75-L87)
- [DrgAnalysisController.java:1-50](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/DrgAnalysisController.java#L1-L50)

### 核心架构组件

1. **主服务器**：处理用户请求、API网关、任务调度
2. **执行服务器**：执行AI模型调用、数据处理等耗时任务
3. **AI服务层**：提供智能的AI响应处理能力
4. **DRG分析服务层**：专门处理DRG分析相关的业务逻辑
5. **配置管理层**：统一管理AI模型配置和系统参数

**章节来源**
- [README.md:42-62](file://med_ai_assistant_1.0_bs_backend/deploy/README.md#L42-L62)

## 核心组件分析

### 应用程序入口

系统的核心入口点是`MedAiAssistantBackendApplication`类，它配置了Spring Boot应用程序的基础设置。

```mermaid
classDiagram
class MedAiAssistantBackendApplication {
+static main(args)
+SpringBootApplication
+EnableScheduling
+EnableJpaRepositories
}
class HomeController {
+home() String
+createTest(testEntity) TestEntity
+getTest(id) TestEntity
+checkDbStatus() String
+getAllUsers() Iterable~User~
}
MedAiAssistantBackendApplication --> HomeController : "组件扫描"
```

**图表来源**
- [MedAiAssistantBackendApplication.java:26-47](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/MedAiAssistantBackendApplication.java#L26-L47)
- [HomeController.java:9-50](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/HomeController.java#L9-L50)

### API路由配置

系统采用WebFlux框架实现响应式API路由，特别针对AI服务进行了优化配置。

```mermaid
sequenceDiagram
participant Client as 客户端
participant Router as 路由器
participant Controller as 控制器
participant Config as 配置管理
Client->>Router : POST /api/ai/response
Router->>Controller : 路由到AI响应控制器
Controller->>Config : 获取AI模型配置
Config-->>Controller : 返回模型配置
Controller->>Controller : 处理AI请求
Controller-->>Client : 返回响应流
```

**图表来源**
- [AIRouterConfig.java:24-34](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/config/AIRouterConfig.java#L24-L34)
- [AIResponseController.java:91-182](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/AIResponseController.java#L91-L182)

**章节来源**
- [MedAiAssistantBackendApplication.java:26-47](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/MedAiAssistantBackendApplication.java#L26-L47)
- [HomeController.java:9-50](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/HomeController.java#L9-L50)

## AI模型配置系统

### 配置架构设计

AI模型配置系统采用灵活的配置管理模式，支持多模型并存和动态配置更新。

```mermaid
classDiagram
class AIModelConfig {
-boolean stream
-Map~String,ModelConfig~ models
+isStream() boolean
+setStream(stream)
+getModelConfig(name) ModelConfig
+getDefaultModelConfig() Optional~ModelConfig~
+hasValidConfigurations() boolean
}
class ModelConfig {
-String url
-String key
-int maxRetries
-long retryDelay
-long connectTimeout
-long readTimeout
+getUrl() String
+getKey() String
+isValid() boolean
+getSummary() String
}
AIModelConfig --> ModelConfig : "管理多个模型配置"
```

**图表来源**
- [AIModelConfig.java:31-264](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/config/AIModelConfig.java#L31-L264)

### 配置验证机制

系统实现了多层次的配置验证机制，确保AI模型配置的有效性和安全性。

```mermaid
flowchart TD
Start([配置加载开始]) --> LoadConfig["加载配置文件"]
LoadConfig --> ValidateModels["验证模型配置"]
ValidateModels --> CheckURL{"URL格式验证"}
CheckURL --> |通过| CheckKey{"API密钥验证"}
CheckURL --> |失败| LogWarning["记录警告日志"]
CheckKey --> |通过| CheckTimeouts{"超时参数验证"}
CheckKey --> |失败| LogWarning
CheckTimeouts --> |通过| LogSuccess["记录成功配置"]
CheckTimeouts --> |失败| LogWarning
LogWarning --> End([配置加载完成])
LogSuccess --> End
```

**图表来源**
- [AIModelConfig.java:294-310](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/config/AIModelConfig.java#L294-L310)

**章节来源**
- [AIModelConfig.java:12-399](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/config/AIModelConfig.java#L12-L399)

## 响应式AI服务

### 流式响应处理

系统采用响应式编程模式处理AI服务的流式响应，支持实时的数据传输和处理。

```mermaid
sequenceDiagram
participant Client as 客户端
participant Controller as AI控制器
participant ModelConfig as 模型配置
participant AIModel as AI模型
participant RetryUtil as 重试工具
Client->>Controller : 发送AI请求
Controller->>ModelConfig : 获取模型配置
ModelConfig-->>Controller : 返回配置信息
Controller->>Controller : 构建请求体
Controller->>RetryUtil : 设置重试策略
RetryUtil-->>Controller : 返回重试规范
Controller->>AIModel : 发送请求
AIModel-->>Controller : 返回流式响应
Controller->>Controller : 处理响应数据
Controller-->>Client : 实时返回数据块
Client->>Controller : 请求完成
Controller-->>Client : 发送[DONE]标记
```

**图表来源**
- [AIResponseController.java:292-402](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/AIResponseController.java#L292-L402)

### 非流式响应处理

对于非流式的AI响应，系统提供完整的JSON响应处理机制。

```mermaid
flowchart TD
Request[收到非流式请求] --> BuildRequest[构建请求体]
BuildRequest --> SendRequest[发送HTTP请求]
SendRequest --> CheckResponse{检查响应状态}
CheckResponse --> |2xx成功| ParseResponse[解析响应数据]
CheckResponse --> |4xx错误| HandleClientError[处理客户端错误]
CheckResponse --> |5xx错误| RetryRequest[执行重试]
ParseResponse --> ExtractContent[提取内容和思维链]
ExtractContent --> BuildNewResponse[构建新响应格式]
BuildNewResponse --> SendResponse[发送响应]
HandleClientError --> SendErrorResponse[发送错误响应]
RetryRequest --> SendRequest
```

**图表来源**
- [AIResponseController.java:455-526](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/AIResponseController.java#L455-L526)

**章节来源**
- [AIResponseController.java:30-528](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/AIResponseController.java#L30-L528)

## 重试机制设计

### 智能重试策略

系统实现了基于指数退避和随机抖动的智能重试机制，有效应对网络波动和临时故障。

```mermaid
flowchart TD
Start([开始请求]) --> FirstAttempt[第一次尝试]
FirstAttempt --> CheckResult{检查结果}
CheckResult --> |成功| Success[处理成功]
CheckResult --> |失败| CheckException{检查异常类型}
CheckException --> |可重试异常| CheckRetryCount{检查重试次数}
CheckException --> |不可重试异常| Fail[处理失败]
CheckRetryCount --> |未达到最大次数| ApplyBackoff[应用指数退避]
CheckRetryCount --> |达到最大次数| Fail
ApplyBackoff --> Wait[等待退避时间]
Wait --> RetryAttempt[重试尝试]
RetryAttempt --> CheckResult
Success --> End([结束])
Fail --> End
```

**图表来源**
- [RetryUtil.java:49-64](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/util/RetryUtil.java#L49-L64)

### 异常分类处理

系统对不同类型的异常进行智能识别和处理，确保重试的有效性和效率。

```mermaid
classDiagram
class RetryUtil {
+createAIRetrySpec() RetryBackoffSpec
+isRetryableException(throwable) boolean
+calculateRetryDelay(retryCount) long
}
class RetryableExceptions {
<<enumeration>>
UNKNOWN_HOST
CONNECT_EXCEPTION
SOCKET_TIMEOUT
TIMEOUT_EXCEPTION
RESOURCE_ACCESS
SERVER_ERROR_5XX
}
RetryUtil --> RetryableExceptions : "识别可重试异常"
```

**图表来源**
- [RetryUtil.java:80-118](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/util/RetryUtil.java#L80-L118)

**章节来源**
- [RetryUtil.java:17-204](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/util/RetryUtil.java#L17-L204)

## DRG分析页面重构

### 页面架构变更

根据更新小结的要求，DRG分析页面进行了重大重构：

- **删除所有标签页**：移除了原有的多标签页导航结构
- **仅保留"开始分析"按钮**：简化用户操作流程，提供直接的分析入口
- **新增患者医疗信息卡片**：整合诊断和手术信息的可视化展示

### 页面布局设计

```mermaid
flowchart TD
StartPage[DRG分析开始页面] --> StartButton["开始分析按钮"]
StartButton --> PatientCard[患者医疗信息卡片]
PatientCard --> DiagnosisList[诊断列表]
PatientCard --> SurgeryList[手术列表]
DiagnosisList --> TypeSwitch[类型切换：主要/次要]
SurgeryList --> TypeSwitch
TypeSwitch --> UniqueRule[唯一规则：主要诊断/手术]
UniqueRule --> AutoSort[自动排序功能]
```

**图表来源**
- [Update Log.md:2-8](file://更新小结.md#L2-L8)

**章节来源**
- [Update Log.md:1-216](file://更新小结.md#L1-L216)

## 患者医疗信息卡片

### 卡片架构设计

患者医疗信息卡片作为DRG分析页面的核心组件，提供集中式的患者医疗信息展示。

```mermaid
classDiagram
class PatientMedicalCard {
+String patientId
+String patientName
+String patientAge
+String patientGender
+DiagnosisList diagnosisList
+SurgeryList surgeryList
+DateTime lastUpdated
+render() void
+updateData() void
}
class DiagnosisList {
+DiagnosisItem[] items
+DiagnosisType type
+boolean showSecondary
+sortItems() void
+filterItems() void
}
class SurgeryList {
+SurgeryItem[] items
+SurgeryType type
+boolean showSecondary
+sortItems() void
+filterItems() void
}
class DiagnosisItem {
+String icdCode
+String diagnosisName
+DiagnosisType type
+DateTime diagnosisDate
+String diagnosedBy
}
class SurgeryItem {
+String procedureCode
+String procedureName
+SurgeryType type
+DateTime surgeryDate
+String surgeon
}
PatientMedicalCard --> DiagnosisList
PatientMedicalCard --> SurgeryList
DiagnosisList --> DiagnosisItem
SurgeryList --> SurgeryItem
```

**图表来源**
- [DiagnosisController.java:87-108](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/DiagnosisController.java#L87-L108)
- [SurgeryController.java:32-35](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/SurgeryController.java#L32-L35)

### 卡片功能特性

1. **实时数据更新**：从后端API获取最新的诊断和手术数据
2. **双列表展示**：同时显示诊断列表和手术列表
3. **类型切换**：支持主要诊断/次要诊断和主要手术/次要手术的切换显示
4. **唯一性规则**：确保主要诊断和主要手术的唯一性
5. **自动排序**：按照时间或其他逻辑进行自动排序

**章节来源**
- [DiagnosisController.java:1-110](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/DiagnosisController.java#L1-L110)
- [SurgeryController.java:1-223](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/SurgeryController.java#L1-L223)

## 诊断列表管理

### 诊断列表架构

诊断列表作为患者医疗信息卡片的重要组成部分，提供诊断信息的集中管理。

```mermaid
classDiagram
class DiagnosisList {
+DiagnosisItem[] items
+DiagnosisType currentType
+boolean showSecondary
+boolean uniquePrimary
+DateTime lastModified
+addItem(item) void
+removeItem(itemId) void
+updateItem(itemId, item) void
+getTypeSwitch() DiagnosisType
+setTypeSwitch(type) void
+toggleSecondary() void
+applyUniqueRule() void
+autoSort() void
}
class DiagnosisItem {
+Long id
+String patientId
+String icdCode
+String diagnosisName
+DiagnosisType type
+String diagnosedBy
+DateTime diagnosisDate
+Integer diagnosisIndex
+Integer isPrimary
+Integer isDeleted
}
class DiagnosisRepository {
+findByPatientId(patientId) Diagnosis[]
+findPrimaryDiagnoses(patientId) Diagnosis[]
+findSecondaryDiagnoses(patientId) Diagnosis[]
+save(diagnosis) Diagnosis
+deleteById(id) int
}
DiagnosisList --> DiagnosisItem
DiagnosisList --> DiagnosisRepository
```

**图表来源**
- [DiagnosisController.java:87-108](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/DiagnosisController.java#L87-L108)
- [DiagnosisRepository.java:1-50](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/repository/DiagnosisRepository.java#L1-L50)

### 诊断类型管理

系统支持诊断类型的灵活切换和管理：

1. **主要诊断规则**：
   - 唯一主要诊断原则
   - 自动排序机制
   - 类型验证和冲突检测

2. **次要诊断规则**：
   - 支持多个次要诊断
   - 自动排序和去重
   - 类型切换功能

3. **数据验证**：
   - ICD编码验证
   - 诊断名称完整性检查
   - 时间戳一致性验证

**章节来源**
- [DiagnosisController.java:22-85](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/DiagnosisController.java#L22-L85)
- [DiagnosisRepository.java:1-100](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/repository/DiagnosisRepository.java#L1-L100)

## 手术列表管理

### 手术列表架构

手术列表提供患者手术信息的完整管理功能，支持复杂的手术数据处理。

```mermaid
classDiagram
class SurgeryList {
+SurgeryItem[] items
+SurgeryType currentType
+boolean showSecondary
+boolean uniquePrimary
+DateTime lastModified
+addItem(item) void
+removeItem(itemId) void
+updateItem(itemId, item) void
+getTypeSwitch() SurgeryType
+setTypeSwitch(type) void
+toggleSecondary() void
+applyUniqueRule() void
+autoSort() void
}
class SurgeryItem {
+Long id
+String patientId
+String procedureCode
+String procedureName
+SurgeryType type
+String surgeon
+DateTime surgeryDate
+Integer surgeryIndex
+Integer isPrimary
+Integer isDeleted
}
class SurgeryRepository {
+findByPatientId(patientId) Surgery[]
+findPrimarySurgeries(patientId) Surgery[]
+findSecondarySurgeries(patientId) Surgery[]
+save(surgery) Surgery
+deleteById(id) int
}
SurgeryList --> SurgeryItem
SurgeryList --> SurgeryRepository
```

**图表来源**
- [SurgeryController.java:32-35](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/SurgeryController.java#L32-L35)
- [SurgeryRepository.java:1-50](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/repository/SurgeryRepository.java#L1-L50)

### 手术类型管理

系统对手术类型提供精细的管理控制：

1. **主要手术规则**：
   - 唯一主要手术原则
   - 自动排序和时间优先
   - 类型冲突自动检测

2. **次要手术规则**：
   - 支持多个次要手术
   - 按时间顺序自动排序
   - 类型切换和过滤功能

3. **数据完整性**：
   - 手术编码验证
   - 医生信息完整性检查
   - 手术日期合理性验证

**章节来源**
- [SurgeryController.java:74-144](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/SurgeryController.java#L74-L144)
- [SurgeryRepository.java:1-100](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/repository/SurgeryRepository.java#L1-L100)

## 后端API接口

### 诊断相关API

系统提供完整的诊断数据管理API接口：

```mermaid
sequenceDiagram
participant Client as 客户端
participant DiagnosisController as 诊断控制器
participant DiagnosisRepository as 诊断仓库
participant DB as 数据库
Client->>DiagnosisController : GET /api/diagnosis/combined/{patientId}
DiagnosisController->>DiagnosisRepository : findByPatientId(patientId)
DiagnosisRepository->>DB : 查询诊断记录
DB-->>DiagnosisRepository : 返回诊断列表
DiagnosisRepository-->>DiagnosisController : 返回诊断数据
DiagnosisController->>DiagnosisController : 组合诊断文本
DiagnosisController-->>Client : 返回组合诊断字符串
```

**图表来源**
- [DiagnosisController.java:87-99](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/DiagnosisController.java#L87-L99)

### 手术相关API

系统提供全面的手术数据管理API接口：

```mermaid
sequenceDiagram
participant Client as 客户端
participant SurgeryController as 手术控制器
participant SurgeryService as 手术服务
participant SurgeryRepository as 手术仓库
Client->>SurgeryController : GET /api/surgeries/by-patient/{patientId}
SurgeryController->>SurgeryService : getSurgeriesByPatientId(patientId)
SurgeryService->>SurgeryRepository : findByPatientId(patientId)
SurgeryRepository-->>SurgeryService : 返回手术列表
SurgeryService-->>SurgeryController : 返回手术数据
SurgeryController-->>Client : 返回手术列表
```

**图表来源**
- [SurgeryController.java:32-35](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/SurgeryController.java#L32-L35)

### DRG分析API

系统提供完整的DRG分析相关API接口：

```mermaid
sequenceDiagram
participant Client as 客户端
participant DrgAnalysisController as DRG分析控制器
participant DrgAnalysisOrchestrator as 分析编排器
participant DrgAnalysisService as 分析服务
Client->>DrgAnalysisController : POST /api/drg/analyze
DrgAnalysisController->>DrgAnalysisOrchestrator : 执行分析编排
DrgAnalysisOrchestrator->>DrgAnalysisService : 执行DRG分析
DrgAnalysisService->>DrgAnalysisService : 匹配诊断和手术
DrgAnalysisService-->>DrgAnalysisOrchestrator : 返回分析结果
DrgAnalysisOrchestrator-->>DrgAnalysisController : 返回完整分析数据
DrgAnalysisController-->>Client : 返回DRG分析结果
```

**图表来源**
- [DrgAnalysisController.java:1-50](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/DrgAnalysisController.java#L1-L50)
- [DrgAnalysisOrchestrator.java:1-50](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/drg/orchestrator/DrgAnalysisOrchestrator.java#L1-L50)

**章节来源**
- [DiagnosisController.java:1-110](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/DiagnosisController.java#L1-L110)
- [SurgeryController.java:1-223](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/SurgeryController.java#L1-L223)
- [DrgAnalysisController.java:1-100](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/DrgAnalysisController.java#L1-L100)

## 部署架构

### 分布式部署模式

系统支持灵活的分布式部署模式，满足不同规模和需求的部署场景。

```mermaid
graph TB
subgraph "主服务器集群"
MainLinux[Linux + Oracle]
MainWindows[Windows服务器]
end
subgraph "执行服务器集群"
ExecWindows[Windows执行服务器]
end
subgraph "基础设施"
Redis[(Redis缓存)]
OracleDB[(Oracle数据库)]
MySQL[(MySQL数据库)]
end
subgraph "通信协议"
HTTP[HTTP API]
PushCallback[推送+回调]
end
MainLinux --> ExecWindows
MainWindows --> ExecWindows
ExecWindows --> HTTP
HTTP --> PushCallback
MainLinux --> Redis
MainWindows --> Redis
ExecWindows --> OracleDB
ExecWindows --> MySQL
```

**图表来源**
- [README.md:15-41](file://med_ai_assistant_1.0_bs_backend/deploy/README.md#L15-L41)

### 部署配置管理

系统提供完善的部署配置管理机制，支持多环境和多场景的部署需求。

**章节来源**
- [README.md:80-133](file://med_ai_assistant_1.0_bs_backend/deploy/README.md#L80-L133)

## 性能优化特性

### 连接池优化

系统采用优化的HTTP客户端配置，包括连接池管理和DNS缓存策略。

### 超时配置

- **响应超时**：300秒（5分钟），支持长时间的LLM处理
- **连接超时**：30秒
- **DNS查询超时**：30秒

### 并发处理

系统支持高并发的AI服务调用，通过响应式编程模式实现高效的异步处理。

## 故障排查指南

### 常见问题诊断

1. **容器启动失败**
   - 检查端口占用情况
   - 查看容器日志信息
   - 验证环境变量配置

2. **数据库连接问题**
   - 验证数据库可访问性
   - 检查用户名和密码
   - 确认防火墙规则

3. **AI服务调用失败**
   - 检查AI模型配置
   - 验证API密钥有效性
   - 监控网络连接状态

4. **DRG分析页面加载失败**
   - 检查后端API接口状态
   - 验证数据库连接
   - 确认缓存配置

### 日志分析

系统提供详细的日志记录机制，包括：
- 请求处理日志
- 错误追踪日志
- 性能监控日志
- 配置变更日志

**章节来源**
- [README.md:209-230](file://med_ai_assistant_1.0_bs_backend/deploy/README.md#L209-L230)

## 总结

DRG分析系统增强项目展现了现代企业级应用开发的最佳实践，通过以下关键特性实现了卓越的性能和可靠性：

### 核心优势

1. **架构先进性**：采用响应式编程和微服务架构，支持高并发和弹性扩展
2. **配置灵活性**：多模型配置管理，支持动态调整和热更新
3. **稳定性保障**：智能重试机制和异常处理，确保服务连续性
4. **部署友好性**：支持多种部署模式，简化运维管理
5. **安全性考虑**：完善的配置管理和安全防护机制
6. **页面重构支持**：全新的DRG分析页面设计，提升用户体验

### 技术创新

- **响应式AI服务**：实现真正的流式数据处理
- **智能重试算法**：基于指数退避和抖动的优化策略
- **分布式部署**：支持主执行分离的架构模式
- **企业级监控**：全面的日志记录和性能监控
- **页面重构架构**：支持患者医疗信息卡片的复杂交互
- **诊断手术管理**：提供完整的诊断和手术数据管理功能

该系统为DRG分析场景提供了强大的技术支撑，能够有效提升医疗数据分析的效率和准确性，为企业决策提供可靠的数据基础。新的页面重构设计进一步提升了用户体验，使得DRG分析过程更加直观和高效。

**章节来源**
- [Stage2 DRG Analysis Verification Report.md:1-163](file://med_ai_assistant_1.0_bs_backend/doc/其他/阶段2-DRG分析功能完成验证.md#L1-L163)
- [Update Log.md:1-216](file://更新小结.md#L1-L216)