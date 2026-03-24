# 医学记录操作指南

<cite>
**本文档引用的文件**
- [更新小结.md](file://更新小结.md)
- [API文档.md](file://med_ai_assistant_1.0_bs_backend/doc/其他/API_DOCUMENTATION.md)
- [架构图.md](file://med_ai_assistant_1.0_bs_backend/doc/其他/ARCHITECTURE_DIAGRAMS.md)
- [主服务器部署指南.md](file://med_ai_assistant_1.0_bs_backend/deploy/main-linux-oracle/README.md)
- [前端README.md](file://med_ai_assistant_1.0_bs_vue/README.md)
- [前端package.json](file://med_ai_assistant_1.0_bs_vue/deploy/med_ai_assistant_1.0_bs_vue/package.json)
- [医疗术语知识库.json](file://med_ai_assistant_1.0_bs_backend/memory-bank/knowledge-base/medical-terms/common-medical-terms.json)
- [内存配置.json](file://med_ai_assistant_1.0_bs_backend/memory-bank/config/memory-config.json)
- [根据日期和科室获取待办事项列表接口.md](file://med_ai_assistant_1.0_bs_backend/doc/接口/根据日期和科室获取待办事项列表接口.md)
- [根据患者ID获取待办事项列表接口.md](file://med_ai_assistant_1.0_bs_backend/doc/接口/根据患者ID获取待办事项列表接口.md)
- [实时语音识别接口.md](file://med_ai_assistant_1.0_bs_backend/doc/接口/实时语音识别接口.md)
- [语音识别与LLM整理解耦接口.md](file://med_ai_assistant_1.0_bs_backend/doc/接口/语音识别与LLM整理解耦接口.md)
</cite>

## 更新摘要
**所做更改**
- 全面重构医学记录操作指南，新增语音识别功能章节
- 新增待办事项生成功能详细说明和接口文档
- 新增智录系统详细操作说明和配置指南
- 扩展操作按钮功能表格和浏览器兼容性配置
- 更新数据管理机制说明和版本更新记录

## 目录
1. [项目概述](#项目概述)
2. [系统架构](#系统架构)
3. [核心功能模块](#核心功能模块)
4. [API接口规范](#api接口规范)
5. [部署配置](#部署配置)
6. [数据管理](#数据管理)
7. [AI辅助功能](#ai辅助功能)
8. [系统监控](#系统监控)
9. [故障排查](#故障排查)
10. [版本更新记录](#版本更新记录)

## 项目概述

医疗AI助手系统是一个基于现代Web技术栈的综合性医疗信息系统，专注于为医护人员提供智能化的病历记录管理和AI辅助诊断功能。该系统采用前后端分离架构，后端基于Spring Boot，前端基于Vue.js，实现了完整的医疗数据管理闭环。

### 系统特性

- **智能病历管理**：支持多种类型的病历记录创建、编辑、查询和管理
- **AI辅助诊断**：基于Prompt模板的智能诊断建议生成
- **语音识别集成**：实时语音转文字功能，支持多种识别模式
- **待办事项生成**：智能化的医疗任务自动生成和管理
- **智录系统**：智能录入助手，提升病历记录效率
- **多模态数据支持**：化验结果、检查报告、医嘱管理等
- **安全加密**：采用AES加密保护敏感医疗数据
- **分布式部署**：支持主服务器和执行服务器分离架构

## 系统架构

系统采用分层架构设计，包含前端应用层、API网关层、业务服务层、核心服务层、数据访问层和数据存储层。

```mermaid
graph TB
subgraph "前端层"
FE[Vue.js前端应用]
UI[Element Plus UI组件]
Router[Vue Router路由]
VoiceUI[语音识别界面]
TodoUI[待办事项界面]
SmartInput[智录系统界面]
end
subgraph "API网关层"
Gateway[API Gateway]
Auth[认证授权]
Cache[缓存管理]
end
subgraph "业务服务层"
AI[AI服务模块]
Patient[患者管理模块]
User[用户管理模块]
Encrypt[加密服务模块]
Medical[病历管理模块]
Voice[语音识别模块]
Todo[待办事项模块]
SmartInput[智录系统模块]
end
subgraph "核心服务层"
PromptSvc[Prompt执行引擎]
DataSvc[数据处理服务]
TaskScheduler[任务调度器]
MemoryBank[内存银行]
VoiceEngine[语音识别引擎]
TodoEngine[待办事项引擎]
end
subgraph "数据访问层"
Repo[Repository层]
CacheRepo[缓存Repository]
TempRepo[临时数据Repository]
end
subgraph "数据存储层"
MySQL[(MySQL数据库)]
Oracle[(Oracle数据库)]
Redis[(Redis缓存)]
Storage[(文件存储)]
end
subgraph "外部服务"
ExecServer[执行服务器]
AIService[AI模型服务]
VoiceService[语音识别服务]
TodoService[待办事项服务]
end
FE --> UI
FE --> Router
Router --> Gateway
UI --> Gateway
Gateway --> Auth
Auth --> Cache
Cache --> AI
Cache --> Patient
Cache --> User
Cache --> Encrypt
Cache --> Medical
Cache --> Voice
Cache --> Todo
Cache --> SmartInput
AI --> PromptSvc
Patient --> DataSvc
Encrypt --> MemoryBank
Medical --> DataSvc
Voice --> VoiceEngine
Todo --> TodoEngine
PromptSvc --> Repo
DataSvc --> Repo
MemoryBank --> CacheRepo
CacheRepo --> Redis
Repo --> MySQL
Repo --> Oracle
CacheRepo --> Redis
Encrypt --> ExecServer
PromptSvc --> AIService
Voice --> VoiceService
Todo --> TodoService
```

**图表来源**
- [架构图.md:5-60](file://med_ai_assistant_1.0_bs_backend/doc/其他/ARCHITECTURE_DIAGRAMS.md#L5-L60)

### 数据模型关系

```mermaid
erDiagram
PATIENTS {
string patient_id PK
string name
int age
string gender
date birth_date
string contact_info
}
MEDICAL_RECORDS {
int record_id PK
string patient_id FK
datetime record_time
string recording_doctor
text medical_content
string record_type
int is_deleted
}
DIAGNOSIS {
int diagnosis_id PK
string patient_id FK
int diagnosis_type
string icd10_code
string diagnosis_text
string diagnosed_by
datetime diagnosis_time
}
LAB_RESULT {
int lab_result_id PK
string patient_id FK
string item_name
string result
string unit
datetime test_date
}
EXAMINATION_RESULT {
int examination_result_id PK
string patient_id FK
string item_name
text result
datetime examination_date
}
PROMPTS {
int prompt_id PK
string patient_id FK
text objective_content
text daily_records
string status_name
datetime execution_time
int retry_count
text execution_result
}
PROMPT_TEMPLATE {
int prompt_id PK
string prompt_type
string prompt_name
text prompt
text filter_rules
boolean is_active
}
PROMPT_RESULTS {
int result_id PK
int prompt_id FK
text original_result_content
string status
datetime created_time
}
USERS {
string user_id PK
string username
string password_hash
string name
int is_active
datetime created_at
}
DEPARTMENT {
int department_id PK
string department_name
string description
}
USER_DEPARTMENT {
string user_id PK,FK
int department_id PK,FK
int is_primary
}
ENCRYPTED_DATA_TEMP {
string id PK
clob encrypted_data
clob decrypted_data
string status
timestamp received_time
timestamp processed_time
}
TODO_ITEM {
long id PK
string patient_id FK
string bed_number
string patient_name
string department
int medical_record_id
clob todo_item
string reason
string status
datetime created_time
datetime completed_time
string source_type
string source_desc
string created_by
}
VOICE_RECOGNITION_LOG {
long id PK
string patient_id FK
string recording_content
string recognized_text
string recognition_status
datetime recognition_time
int duration_seconds
string model_used
}
SMART_INPUT_DICT {
long dic_id PK
string content1
string content2
string content3
int sort_order
string category
}
PATIENTS ||--o{ MEDICAL_RECORDS : "has"
PATIENTS ||--o{ DIAGNOSIS : "has"
PATIENTS ||--o{ LAB_RESULT : "has"
PATIENTS ||--o{ EXAMINATION_RESULT : "has"
PATIENTS ||--o{ PROMPTS : "analyzed by"
PATIENTS ||--o{ TODO_ITEM : "has"
PATIENTS ||--o{ VOICE_RECOGNITION_LOG : "has"
PATIENTS ||--o{ SMART_INPUT_DICT : "has"
PROMPTS ||--|| PROMPT_RESULTS : "generates"
PROMPT_TEMPLATE ||--o{ PROMPTS : "uses"
USERS ||--o{ USER_DEPARTMENT : "belongs to"
DEPARTMENT ||--o{ USER_DEPARTMENT : "contains"
```

**图表来源**
- [架构图.md:64-181](file://med_ai_assistant_1.0_bs_backend/doc/其他/ARCHITECTURE_DIAGRAMS.md#L64-L181)

## 核心功能模块

### 病历记录管理

系统提供完整的病历记录生命周期管理，支持多种类型的病历记录创建、编辑、查询和删除操作。

#### 病历记录类型

| 记录类型 | 用途 | 特点 |
|---------|------|------|
| 入院记录 | 患者入院时的基础信息记录 | 包含入院时间、主诉、现病史等 |
| 病情小结 | 患者病情的阶段性总结 | 每日或定期生成 |
| 查房记录 | 医生查房时的临床观察记录 | 包含体征、诊断、治疗计划 |
| 病程记录 | 患者住院期间的详细医疗记录 | 连续性的病情变化记录 |

#### 病历记录操作流程

```mermaid
flowchart TD
Start([开始操作]) --> CheckAuth{用户认证}
CheckAuth --> |通过| LoadPatient[加载患者信息]
CheckAuth --> |失败| AuthError[认证失败]
LoadPatient --> SelectAction{选择操作}
SelectAction --> |新建| CreateRecord[创建新记录]
SelectAction --> |编辑| EditRecord[编辑现有记录]
SelectAction --> |查询| QueryRecord[查询记录]
SelectAction --> |删除| DeleteRecord[删除记录]
CreateRecord --> ValidateData[验证输入数据]
EditRecord --> ValidateData
DeleteRecord --> ConfirmDelete{确认删除}
ValidateData --> |有效| SaveRecord[保存记录]
ValidateData --> |无效| ShowError[显示错误信息]
ConfirmDelete --> |确认| SaveRecord
ConfirmDelete --> |取消| SelectAction
SaveRecord --> UpdateUI[更新界面显示]
UpdateUI --> End([操作完成])
ShowError --> End
AuthError --> End
```

**图表来源**
- [架构图.md:185-232](file://med_ai_assistant_1.0_bs_backend/doc/其他/ARCHITECTURE_DIAGRAMS.md#L185-L232)

### 语音识别功能

系统支持多种语音识别模式，包括实时语音识别和录音文件识别，为医生提供便捷的语音输入方式。

#### 语音识别架构

```mermaid
graph LR
subgraph "语音采集层"
Mic[麦克风]
AudioProc[音频处理]
MobileAudio[移动端音频]
end
subgraph "数据传输层"
WebSocket[WebSocket连接]
Buffer[音频缓冲]
FileUpload[文件上传]
end
subgraph "识别处理层"
ASR[语音识别引擎]
Transcriber[文本转录器]
VoiceEngine[语音识别服务]
end
subgraph "结果输出层"
TextDisplay[文本显示]
AutoInsert[自动插入]
ManualTrigger[手动触发]
end
Mic --> AudioProc
AudioProc --> WebSocket
MobileAudio --> FileUpload
WebSocket --> Buffer
Buffer --> ASR
FileUpload --> VoiceEngine
ASR --> Transcriber
VoiceEngine --> Transcriber
Transcriber --> TextDisplay
TextDisplay --> AutoInsert
TextDisplay --> ManualTrigger
```

**图表来源**
- [架构图.md:268-306](file://med_ai_assistant_1.0_bs_backend/doc/其他/ARCHITECTURE_DIAGRAMS.md#L268-L306)

#### 语音识别模式

| 模式类型 | 传输方式 | 识别方式 | 适用场景 |
|---------|---------|---------|---------|
| 实时语音识别 | WebSocket | 实时流式识别 | 医生现场语音输入，实时转文字 |
| 录音文件识别 | HTTP上传 | 批量文件识别 | 录音后识别，支持长音频文件 |
| 智录系统识别 | 智录引擎 | 智能识别 | 结合智录系统，智能识别和整理 |

#### 语音识别操作流程

```mermaid
sequenceDiagram
participant Doctor as 医生
participant VoiceUI as 语音界面
participant VoiceEngine as 语音引擎
participant AIService as AI服务
participant MedicalUI as 病历界面
Doctor->>VoiceUI : 点击语音识别按钮
VoiceUI->>VoiceEngine : 开始录音
VoiceEngine->>VoiceEngine : 音频采集和处理
VoiceEngine->>VoiceEngine : 语音识别
VoiceEngine-->>VoiceUI : 返回识别结果
VoiceUI->>MedicalUI : 自动插入识别内容
Doctor->>VoiceUI : 点击文字整理按钮
VoiceUI->>AIService : 调用AI整理
AIService-->>VoiceUI : 返回整理结果
VoiceUI->>MedicalUI : 替换整理后的内容
```

**图表来源**
- [语音识别与LLM整理解耦接口.md:97-143](file://med_ai_assistant_1.0_bs_backend/doc/接口/语音识别与LLM整理解耦接口.md#L97-L143)

### 待办事项生成功能

系统提供智能化的待办事项生成功能，基于病历内容自动生成医疗任务清单。

#### 待办事项生成流程

```mermaid
flowchart TD
Start([开始生成]) --> CheckRecord{检查病历记录}
CheckRecord --> |有效| AnalyzeContent[分析病历内容]
CheckRecord --> |无效| Error[生成失败]
AnalyzeContent --> ExtractTasks[提取医疗任务]
ExtractTasks --> GeneratePrompt[生成LLM提示]
GeneratePrompt --> CallAI[调用AI生成]
CallAI --> ProcessResult[处理生成结果]
ProcessResult --> FilterTasks[过滤有效任务]
FilterTasks --> CreateTodo[创建待办事项]
CreateTodo --> UpdateStatus[更新状态]
UpdateStatus --> End([生成完成])
Error --> End
```

**图表来源**
- [架构图.md:185-232](file://med_ai_assistant_1.0_bs_backend/doc/其他/ARCHITECTURE_DIAGRAMS.md#L185-L232)

#### 待办事项类型

| 任务类型 | 生成规则 | 状态管理 |
|---------|---------|---------|
| 医疗检查 | 病历中提及的检查项目 | 自动生成，医生确认 |
| 药物治疗 | 病历中的药物处方记录 | 自动生成，执行状态跟踪 |
| 诊断分析 | 病历中的诊断相关信息 | 自动生成，AI辅助分析 |
| 病情观察 | 病历中的病情变化记录 | 自动生成，定期提醒 |

### 智录系统

智录系统是医疗记录的智能助手，提供智能录入、模板匹配和内容优化功能。

#### 智录系统架构

```mermaid
graph TB
subgraph "智录输入层"
SmartInput[智录输入框]
TemplateMatch[模板匹配]
AutoComplete[自动补全]
end
subgraph "智录处理层"
DictEngine[字典引擎]
PatternEngine[模式引擎]
OptimizationEngine[优化引擎]
end
subgraph "智录输出层"
FormattedContent[格式化内容]
SuggestionBox[建议框]
AutoApply[自动应用]
end
SmartInput --> TemplateMatch
TemplateMatch --> DictEngine
AutoComplete --> PatternEngine
DictEngine --> OptimizationEngine
PatternEngine --> OptimizationEngine
OptimizationEngine --> FormattedContent
FormattedContent --> SuggestionBox
SuggestionBox --> AutoApply
```

**图表来源**
- [架构图.md:268-306](file://med_ai_assistant_1.0_bs_backend/doc/其他/ARCHITECTURE_DIAGRAMS.md#L268-L306)

#### 智录字典管理

| 字典类型 | 字典内容 | 使用场景 |
|---------|---------|---------|
| 常用术语 | 医学常用词汇和缩写 | 病历记录中的术语标准化 |
| 检查项目 | 各种医学检查项目的标准表述 | 检查项目的规范化描述 |
| 治疗方案 | 常见疾病的治疗方案模板 | 治疗方案的标准化表述 |
| 诊断模板 | 各种诊断的标准化模板 | 诊断内容的规范化生成 |

## API接口规范

系统提供完整的RESTful API接口，支持病历记录管理、AI诊断、用户管理、语音识别、待办事项等功能。

### 病历记录管理API

#### 获取病历记录列表

- **路径**: `/api/medicalrecords/emr-by-patient`
- **方法**: GET
- **参数**: `patientId` (必需)
- **响应**: EmrContent对象数组
- **特点**: 自动过滤已删除记录，按时间降序排列

#### 新增病历记录

- **路径**: `/api/medicalrecords/save`
- **方法**: POST
- **请求体**:
```json
{
  "patientId": "患者ID",
  "recordTime": "记录时间",
  "recordingDoctor": "记录医生",
  "medicalContent": "病历内容"
}
```

#### 获取格式化病历记录

- **路径**: `/api/medicalrecords/formatted`
- **方法**: GET
- **参数**: `patientId` (必需)
- **响应**: 格式化后的病历记录字符串

### 语音识别API

#### 实时语音识别

- **路径**: `ws://localhost:8081/api/voice/realtime`
- **方法**: WebSocket
- **特点**: 支持实时音频流传输，识别结果实时返回
- **音频格式**: PCM 16kHz 单声道 16bit

#### 录音文件识别

- **路径**: `POST /api/voice/recognize-file`
- **方法**: POST
- **特点**: 支持音频文件上传识别，支持长音频文件
- **文件大小**: 最大500MB

### 待办事项API

#### 根据患者ID获取待办事项

- **路径**: `GET /api/medicalrecords/patient/{patientId}/todos`
- **方法**: GET
- **参数**: `patientId` (路径参数)
- **响应**: 待办事项列表，按创建时间降序排列

#### 根据日期和科室获取待办事项

- **路径**: `GET /api/medicalrecords/todos/by-date-department`
- **方法**: GET
- **参数**: 
  - `date` (必需): 查询日期，格式：yyyy-MM-dd
  - `department` (必需): 科室名称
- **响应**: 按床号升序排列的待办事项列表

#### 根据病历记录ID获取待办事项

- **路径**: `GET /api/medicalrecords/todo/{medicalRecordId}`
- **方法**: GET
- **参数**: `medicalRecordId` (路径参数)
- **响应**: 指定病历记录的所有待办事项

### AI服务API

#### 获取患者综合信息

- **路径**: `/api/ai/patient-comprehensive-info`
- **方法**: GET
- **参数**: `patientId` (必需)
- **响应**: 格式化后的患者综合信息字符串
- **包含内容**: 基本信息、诊断、病历记录、化验结果、检查结果等

#### AI响应服务

- **路径**: `/api/ai/response`
- **方法**: POST
- **请求体**:
```json
{
  "model": "deepseek-chat",
  "messages": [
    {
      "role": "user",
      "content": "解释心脏病症状"
    }
  ],
  "stream": false,
  "temperature": 0.7,
  "max_tokens": 2048
}
```

**图表来源**
- [API文档.md:1-800](file://med_ai_assistant_1.0_bs_backend/doc/其他/API_DOCUMENTATION.md#L1-L800)

### Prompt模板管理API

#### 获取激活状态的Prompt模板

- **路径**: `/api/ai/activePromptTemplates`
- **方法**: GET
- **响应**: 激活状态的Prompt模板数组

#### 更新Prompt模板状态

- **路径**: `/api/ai/updatePromptActiveStatus`
- **方法**: PUT
- **参数**:
  - `promptId`: 模板ID (必需)
  - `isActive`: 激活状态 (必需)
- **响应**: 更新状态信息

## 部署配置

系统支持多种部署环境，包括开发环境、测试环境和生产环境。

### 主服务器部署

#### 环境要求

- **操作系统**: Linux 64位 (Ubuntu 20.04+, CentOS 7+, Debian 10+)
- **硬件要求**: CPU 2核+, 内存 4GB+, 磁盘 20GB可用空间
- **软件要求**: Docker 20.10+, Docker Compose 1.29+

#### 配置文件

**环境变量配置** (`main/.env`):
```properties
# Redis配置
REDIS_PASSWORD=your-secure-redis-password

# 执行服务器配置
EXECUTION_SERVER_HOST=100.66.1.2
EXECUTION_SERVER_PORT=8082
EXECUTION_SERVER_URL=http://100.66.1.2:8082

# AI模型配置
DEEPSEEK_API_KEY=your-deepseek-api-key-here
AI_MODEL_TIMEOUT=300000

# 加密配置
ENCRYPTION_AES_KEY=your-32-character-encryption-key
ENCRYPTION_AES_SALT=your-encryption-salt

# JVM配置
JAVA_OPTS=-Xms1g -Xmx2g -XX:+UseG1GC -XX:MaxGCPauseMillis=200
```

**应用配置** (`config/main/application.properties`):
```properties
# 数据库配置
spring.datasource.url=jdbc:oracle:thin:@//localhost:1521/orcl
spring.datasource.username=medai_user
spring.datasource.password=secure_password

# 日志配置
logging.level.com.example.medaiassistant=INFO
logging.level.org.springframework.web=INFO

# 缓存配置
spring.redis.host=localhost
spring.redis.port=6379
spring.redis.password=your-redis-password
```

### 执行服务器部署

执行服务器负责处理敏感数据的加密解密和AI模型调用，确保医疗数据的安全性。

#### 部署步骤

1. **准备环境**:
   ```bash
   # 安装Docker和Docker Compose
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   
   # 验证安装
   docker --version
   docker-compose --version
   ```

2. **配置环境变量**:
   ```bash
   # 编辑 .env.execution
   vim .env.execution
   
   # 设置执行服务器专用配置
   EXECUTION_SERVER_MODE=production
   ENCRYPTION_KEY=your-secure-encryption-key
   ```

3. **启动服务**:
   ```bash
   # 构建并启动
   docker-compose -f docker-compose-execution.yml up -d --build
   
   # 查看日志
   docker-compose -f docker-compose-execution.yml logs -f
   ```

**图表来源**
- [主服务器部署指南.md:1-396](file://med_ai_assistant_1.0_bs_backend/deploy/main-linux-oracle/README.md#L1-L396)

## 数据管理

系统采用多层数据管理策略，确保医疗数据的完整性、安全性和可追溯性。

### 数据存储策略

#### 缓存策略

系统配置了智能的缓存策略，平衡内存使用和访问性能：

```json
{
  "maxMemoryUsageMB": 1024,
  "cleanupThresholdMB": 800,
  "cleanupIntervalMinutes": 30,
  "cacheEnabled": true,
  "knowledgeBaseEnabled": true,
  "retentionDays": {
    "patientData": 30,
    "aiResponses": 7,
    "sessionData": 1,
    "systemLogs": 90,
    "errorLogs": 180,
    "interactionLogs": 30,
    "voiceRecognitionLogs": 30,
    "todoItems": 7
  }
}
```

#### 数据加密

所有敏感医疗数据在传输和存储过程中都经过AES加密：

- **加密算法**: AES-256-CBC
- **密钥管理**: 环境变量配置
- **盐值处理**: 随机生成的16字节盐值
- **数据范围**: 患者姓名、诊断信息、病历内容等

### 数据同步机制

系统支持多数据源的实时同步，确保不同环境间的数据一致性。

#### 同步流程

```mermaid
flowchart TD
Start([开始同步]) --> CheckSource{检查数据源}
CheckSource --> |主服务器| MainServer[主服务器数据]
CheckSource --> |执行服务器| ExecServer[执行服务器数据]
CheckSource --> |外部系统| ExtSystem[外部医疗系统]
MainServer --> TransformData[数据转换]
ExecServer --> TransformData
ExtSystem --> TransformData
TransformData --> ValidateData{数据验证}
ValidateData --> |通过| EncryptData[数据加密]
ValidateData --> |失败| LogError[记录错误]
EncryptData --> SyncToTarget[同步到目标系统]
SyncToTarget --> UpdateStatus[更新同步状态]
UpdateStatus --> End([同步完成])
LogError --> End
```

**图表来源**
- [架构图.md:234-264](file://med_ai_assistant_1.0_bs_backend/doc/其他/ARCHITECTURE_DIAGRAMS.md#L234-L264)

### 语音识别数据管理

#### 语音识别日志

系统提供完整的语音识别数据管理功能：

```mermaid
graph LR
subgraph "语音识别数据流"
VoiceData[语音数据]
RecognitionLog[识别日志]
ProcessingLog[处理日志]
ResultData[结果数据]
end
subgraph "数据存储"
VoiceDB[(语音识别数据库)]
LogDB[(日志数据库)]
ResultDB[(结果数据库)]
end
VoiceData --> RecognitionLog
RecognitionLog --> ProcessingLog
ProcessingLog --> ResultData
ResultData --> ResultDB
RecognitionLog --> LogDB
VoiceData --> VoiceDB
```

**图表来源**
- [语音识别与LLM整理解耦接口.md:28-51](file://med_ai_assistant_1.0_bs_backend/doc/接口/语音识别与LLM整理解耦接口.md#L28-L51)

## AI辅助功能

系统集成了先进的AI辅助诊断功能，通过机器学习和自然语言处理技术为医生提供智能化的医疗决策支持。

### AI模型配置

#### 支持的AI模型

| 模型名称 | 用途 | 配置参数 |
|---------|------|----------|
| deepseek-chat | 通用对话和诊断分析 | temperature: 0.7, max_tokens: 2048 |
| inHospitalDeepseek | 医院内部专用模型 | temperature: 0.5, max_tokens: 4096 |
| qwen3-asr-flash | 语音识别 | 模型版本: qwen3-asr-flash |

#### AI参数调优

```mermaid
graph LR
subgraph "AI参数调优"
Temperature[温度参数<br/>0.0-2.0]
MaxTokens[最大令牌数<br/>1-4096]
TopP[核采样参数<br/>0.0-1.0]
FrequencyPenalty[频率惩罚<br/>-2.0-2.0]
PresencePenalty[存在惩罚<br/>-2.0-2.0]
end
subgraph "应用场景"
General[通用诊断<br/>temperature: 0.7]
Critical[重症分析<br/>temperature: 0.5]
Consultation[会诊分析<br/>max_tokens: 4096]
end
Temperature --> General
Temperature --> Critical
Temperature --> Consultation
MaxTokens --> Consultation
```

**图表来源**
- [API文档.md:400-424](file://med_ai_assistant_1.0_bs_backend/doc/其他/API_DOCUMENTATION.md#L400-L424)

### Prompt模板管理

系统提供了灵活的Prompt模板管理系统，支持自定义模板的创建、编辑和版本控制。

#### 模板类型

| 模板类型 | 用途 | 示例 |
|---------|------|------|
| 诊断分析 | 疾病诊断建议 | "基于患者的症状和检查结果，分析可能的诊断..." |
| 治疗方案 | 治疗计划制定 | "为该患者制定个性化的治疗方案..." |
| 病情小结 | 病情总结报告 | "总结患者三天内的病情变化和治疗效果..." |
| 查房记录 | 医生查房记录 | "记录今日查房时患者的体征和病情观察..." |

#### 模板参数

```mermaid
classDiagram
class PromptTemplate {
+int promptId
+string promptType
+string promptName
+string prompt
+string filterRules
+string specialContent
+string requiredDataTypes
+string scope
+int departmentId
+boolean isActive
+validateTemplate() boolean
+generatePromptContent() string
+applyFilterRules() boolean
}
class RequiredDataType {
+string dataType
+string description
+boolean mandatory
+validateData(data) boolean
}
class FilterRule {
+string ruleExpression
+string description
+evaluate(patientData) boolean
}
PromptTemplate --> RequiredDataType : "requires"
PromptTemplate --> FilterRule : "applies"
```

**图表来源**
- [API文档.md:686-782](file://med_ai_assistant_1.0_bs_backend/doc/其他/API_DOCUMENTATION.md#L686-L782)

### 待办事项AI分析

#### AI生成待办事项流程

```mermaid
sequenceDiagram
participant Doctor as 医生
participant TodoEngine as 待办事项引擎
participant AIService as AI服务
participant TodoDB as 待办事项数据库
Doctor->>TodoEngine : 触发待办事项生成
TodoEngine->>TodoEngine : 分析病历内容
TodoEngine->>TodoEngine : 提取医疗任务
TodoEngine->>AIService : 调用AI生成
AIService-->>TodoEngine : 返回生成结果
TodoEngine->>TodoDB : 保存待办事项
TodoEngine-->>Doctor : 显示生成的待办事项
```

**图表来源**
- [架构图.md:185-232](file://med_ai_assistant_1.0_bs_backend/doc/其他/ARCHITECTURE_DIAGRAMS.md#L185-L232)

## 系统监控

系统内置了完善的监控和告警机制，确保服务的稳定运行和及时发现问题。

### 性能监控

#### 监控指标

| 监控类别 | 指标名称 | 阈值设置 | 告警级别 |
|---------|---------|---------|---------|
| 系统资源 | CPU使用率 | >80% | 警告 |
| 系统资源 | 内存使用率 | >85% | 危险 |
| 系统资源 | 磁盘空间 | <10%可用 | 警告 |
| 应用性能 | 响应时间 | >2秒 | 警告 |
| 应用性能 | 错误率 | >5% | 危险 |
| 数据库性能 | 连接池使用率 | >90% | 危险 |
| 缓存性能 | 缓存命中率 | <70% | 警告 |
| 语音识别 | 识别成功率 | <80% | 警告 |
| 待办事项 | 生成成功率 | <85% | 警告 |

#### 监控配置

**内存银行监控** (`memory-config.json`):
```json
{
  "monitoring": {
    "enabled": true,
    "checkIntervalSeconds": 60,
    "alertThresholdMB": 900
  },
  "performance": {
    "maxConcurrentOperations": 10,
    "ioThreads": 4,
    "bufferSizeKB": 64
  }
}
```

### 健康检查

系统提供多层次的健康检查机制：

#### 服务健康检查

```mermaid
flowchart TD
HealthCheck[健康检查] --> ServiceCheck{服务状态检查}
ServiceCheck --> |主服务器| MainServer[主服务器健康]
ServiceCheck --> |执行服务器| ExecServer[执行服务器健康]
ServiceCheck --> |数据库| Database[数据库连接]
ServiceCheck --> |缓存| Cache[Redis连接]
ServiceCheck --> |语音识别| VoiceService[语音识别服务]
ServiceCheck --> |待办事项| TodoService[待办事项服务]
MainServer --> AIService[AI模型服务]
ExecServer --> Encryption[加密服务]
Database --> DataSources[数据源检查]
Cache --> CacheOps[缓存操作检查]
VoiceService --> VoiceEngine[语音引擎]
TodoService --> TodoEngine[待办引擎]
AIService --> ModelStatus{模型状态}
Encryption --> EncStatus{加密状态}
DataSources --> DSStatus{数据源状态}
CacheOps --> COStatus{缓存状态}
VoiceEngine --> VEStatus{语音引擎状态}
TodoEngine --> TEStatus{待办引擎状态}
ModelStatus --> OverallStatus[总体健康状态]
EncStatus --> OverallStatus
DSStatus --> OverallStatus
COStatus --> OverallStatus
VEStatus --> OverallStatus
TEStatus --> OverallStatus
```

**图表来源**
- [架构图.md:340-391](file://med_ai_assistant_1.0_bs_backend/doc/其他/ARCHITECTURE_DIAGRAMS.md#L340-L391)

## 故障排查

### 常见问题及解决方案

#### 部署相关问题

| 问题类型 | 症状描述 | 解决方案 |
|---------|---------|---------|
| 容器启动失败 | 容器启动后立即退出 | 检查端口占用，查看容器日志，验证环境变量配置 |
| 网络连接失败 | 无法连接到执行服务器 | 检查网络连通性，验证防火墙设置，确认服务器地址配置 |
| 数据库连接错误 | 应用启动时报数据库连接失败 | 检查数据库服务状态，验证连接参数，确认网络可达性 |
| 内存不足 | 应用频繁重启或性能下降 | 调整JVM参数，增加系统内存，优化应用配置 |

#### 性能问题

| 问题类型 | 症状描述 | 解决方案 |
|---------|---------|---------|
| 响应缓慢 | API响应时间超过阈值 | 分析慢查询，优化数据库索引，增加缓存策略 |
| 内存泄漏 | 内存使用持续增长 | 检查资源释放，优化对象生命周期，启用内存监控 |
| 并发问题 | 高并发场景下系统不稳定 | 调整线程池配置，优化锁机制，增加负载均衡 |

#### 数据相关问题

| 问题类型 | 症状描述 | 解决方案 |
|---------|---------|---------|
| 数据不一致 | 不同环境间数据差异 | 检查同步机制，验证数据转换逻辑，确认事务一致性 |
| 缓存失效 | 缓存数据过期或错误 | 清理缓存，检查缓存配置，验证数据更新策略 |
| 加密失败 | 敏感数据无法正确加密/解密 | 检查密钥配置，验证加密算法，确认密钥轮换策略 |

#### 语音识别问题

| 问题类型 | 症状描述 | 解决方案 |
|---------|---------|---------|
| 识别失败 | 语音无法识别或识别错误 | 检查音频质量，验证API配置，确认网络连接 |
| 实时识别延迟高 | 实时语音识别延迟超过1秒 | 检查网络质量，优化音频缓冲，调整识别参数 |
| 录音文件过大 | 录音文件超过500MB限制 | 分割音频文件，优化音频压缩，检查文件格式 |

#### 待办事项问题

| 问题类型 | 症状描述 | 解决方案 |
|---------|---------|---------|
| 生成失败 | 待办事项无法生成 | 检查AI服务状态，验证病历内容，确认模板配置 |
| 任务重复 | 待办事项重复生成 | 检查去重逻辑，验证生成规则，确认数据库状态 |
| 状态异常 | 待办事项状态不正确 | 检查状态更新逻辑，验证任务执行，确认数据库一致性 |

### 调试工具

#### 日志分析

系统提供了丰富的日志分析工具：

1. **应用日志**:
   ```bash
   # 查看主服务器日志
   docker logs med-ai-main -f
   
   # 查看错误日志
   tail -f logs/main/main-server.log | grep ERROR
   
   # 查看慢请求日志
   tail -f logs/main/main-server.log | grep "took more than"
   ```

2. **数据库日志**:
   ```bash
   # 查看数据库连接日志
   docker logs med-ai-mysql | grep "Connection"
   
   # 查看慢查询日志
   docker logs med-ai-mysql | grep "Query_time"
   ```

3. **缓存日志**:
   ```bash
   # 查看Redis日志
   docker logs med-ai-main-redis | grep "error"
   
   # 检查缓存命中率
   docker exec med-ai-main-redis redis-cli info | grep "keyspace"
   ```

4. **语音识别日志**:
   ```bash
   # 查看语音识别日志
   tail -f logs/main/voice-recognition.log
   
   # 检查识别成功率
   tail -f logs/main/voice-recognition.log | grep "success_rate"
   ```

5. **待办事项日志**:
   ```bash
   # 查看待办事项日志
   tail -f logs/main/todo-generation.log
   
   # 检查生成成功率
   tail -f logs/main/todo-generation.log | grep "generation_success"
   ```

## 版本更新记录

系统采用持续集成和持续部署的开发模式，版本更新记录详细记录了每次迭代的功能改进和问题修复。

### 最新版本 (v0.5.077)

#### 主要更新内容

1. **医学记录操作指南全面重构**
   - 新增语音识别功能详细说明和操作指南
   - 新增待办事项生成功能完整说明和接口文档
   - 新增智录系统详细操作说明和配置指南
   - 扩展操作按钮功能表格，包含语音识别、文字整理、智录触发等
   - 补充浏览器兼容性配置指南和网络环境要求

2. **语音识别功能增强**
   - 修复生产环境语音识别上传413错误
   - 优化Nginx client_max_body_size配置
   - 同步后端multipart配置
   - 新增语音识别与LLM整理解耦功能

3. **待办事项生成功能完善**
   - 新增根据日期和科室获取待办事项接口
   - 新增根据患者ID获取待办事项列表接口
   - 新增根据病历记录ID获取待办事项接口
   - 完善待办事项状态管理和跟踪功能

4. **系统稳定性提升**
   - 修复Android平板上"AI辅助"子菜单点击后立即收起的问题
   - 新增触屏/桌面设备差异化交互
   - 优化浏览器兼容性配置
   - 改进语音识别按钮逻辑，支持选中文本替换

#### 版本升级指南

```bash
# 备份当前版本
cp -r med_ai_assistant_1.0_bs_backend backup_$(date +%Y%m%d)

# 拉取最新代码
git pull origin main

# 更新依赖
cd med_ai_assistant_1.0_bs_vue
npm install

cd ../med_ai_assistant_1.0_bs_backend
./mvnw clean install

# 重启服务
cd ../deploy/main-linux-oracle
./deploy.sh
```

### 历史版本特性

#### v0.5.076 - 语音识别配置修复
- 修复生产环境语音识别Docker容器DNS解析失败
- 添加extra_hosts映射内网API代理
- 配置firewalld永久策略

#### v0.5.075 - 设备兼容性优化
- 修复Android平板上"AI辅助"子菜单点击后立即收起的问题
- 新增触屏/桌面设备差异化交互
- 优化移动端用户体验

#### v0.5.074 - OCR数据采集方案
- 新增监护仪呼吸机AI OCR数据采集完整技术方案文档
- 更新未完成功能列表
- 完善OCR识别精度和稳定性

#### v0.5.073 - Prompt模板增强
- AI辅助界面Prompt模板新增补充信息输入对话框
- 支持"请会诊记录"、"日常对话"模板用户输入补充信息
- 优化Prompt模板的交互体验

#### v0.5.072 - AI对话优化
- 修复AI对话UI无内容显示问题
- 优化aiService.js非流式响应回调时序
- 改进语音识别与LLM整理功能解耦

#### v0.5.071 - 语音识别解耦
- 语音识别完成后不再自动调用LLM整理
- 用户可手动点击"文字整理"按钮触发
- 优化语音识别按钮逻辑，支持选中文本替换

#### v0.5.070 - 语音识别配置外化
- 修改VoiceFileRecognitionController配置
- 新增VoiceRecognitionProperties配置类
- 支持通过配置文件切换ASR服务提供商

#### v0.5.069 - 自动部署功能
- 创建POST /api/deploy/auto-deploy-backend接口
- 实现后端一键自动部署功能
- 添加完整的错误处理和日志记录

### 版本管理策略

#### 版本号规则

系统采用语义化版本控制：

```
主版本号.次版本号.修订号
```

- **主版本号**: 重大功能更新或不兼容的API变更
- **次版本号**: 新功能添加或向后兼容的功能改进
- **修订号**: 向后兼容的问题修复或小功能更新

#### 发布流程

```mermaid
flowchart TD
Dev[开发阶段] --> FeatureComplete{功能完成}
FeatureComplete --> |通过测试| PrepareRelease[准备发布]
FeatureComplete --> |测试失败| FixBugs[修复问题]
FixBugs --> FeatureComplete
PrepareRelease --> UpdateVersion[更新版本号]
UpdateVersion --> BuildArtifacts[构建发布包]
BuildArtifacts --> TestRelease[测试发布]
TestRelease --> |测试通过| DeployProd[部署生产]
TestRelease --> |测试失败| FixRelease[修复发布问题]
FixRelease --> TestRelease
DeployProd --> NotifyUsers[通知用户]
NotifyUsers --> End([发布完成])
```

**图表来源**
- [更新小结.md:1-486](file://更新小结.md#L1-L486)

## 总结

医疗AI助手系统是一个功能完备、架构清晰、安全可靠的综合性医疗信息系统。通过智能化的AI辅助诊断、高效的病历管理、安全的数据加密、完善的监控告警机制和新增的语音识别、待办事项生成功能，系统为医护人员提供了强大的技术支持。

### 系统优势

1. **技术先进性**: 采用最新的Web技术和AI模型，提供智能化的医疗服务
2. **安全性保障**: 全面的数据加密和访问控制，确保医疗信息安全
3. **可扩展性**: 模块化设计和微服务架构，支持功能扩展和性能提升
4. **易用性**: 直观的用户界面和流畅的操作体验，降低学习成本
5. **可靠性**: 完善的监控告警和故障恢复机制，确保系统稳定运行
6. **智能化**: 新增语音识别、待办事项生成、智录系统等AI辅助功能
7. **兼容性**: 支持多种设备和浏览器，提供良好的用户体验

### 未来发展方向

1. **AI能力增强**: 持续优化AI模型，提升诊断准确性和智能化水平
2. **功能扩展**: 根据用户需求不断扩展系统功能和服务范围
3. **性能优化**: 持续优化系统性能，提升用户体验和响应速度
4. **安全保障**: 加强安全防护措施，确保医疗数据的绝对安全
5. **标准化建设**: 推进医疗信息化标准建设，促进系统间的互联互通
6. **智能化升级**: 持续引入新的AI技术，提升系统的智能化水平

通过持续的技术创新和功能完善，医疗AI助手系统将继续为医疗行业的数字化转型贡献力量，为患者提供更好的医疗服务体验。