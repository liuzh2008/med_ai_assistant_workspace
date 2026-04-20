# API参考

<cite>
**本文引用的文件**
- [API文档](file://med_ai_assistant_1.0_bs_backend/doc/其他/API_DOCUMENTATION.md)
- [部署总览](file://med_ai_assistant_1.0_bs_backend/deploy/README.md)
- [主服务器(Linux+Oracle)部署](file://med_ai_assistant_1.0_bs_backend/deploy/main-linux-oracle/README.md)
- [执行服务器(Win)部署](file://med_ai_assistant_1.0_bs_backend/deploy/execution-windows/README.md)
- [系统架构与流程图](file://med_ai_assistant_1.0_bs_backend/doc/其他/ARCHITECTURE_DIAGRAMS.md)
- [主服务器与执行服务器交互机制分析](file://med_ai_assistant_1.0_bs_backend/doc/其他/主服务器与执行服务器交互机制分析.md)
- [执行服务器LLM调用优化接口文档](file://med_ai_assistant_1.0_bs_backend/doc/其他/执行服务器LLM调用优化接口文档.md)
- [执行服务器性能优化方案](file://med_ai_assistant_1.0_bs_backend/doc/其他/执行服务器性能优化方案.md)
- [告警规则接口文档](file://med_ai_assistant_1.0_bs_backend/doc/其他/API_ALERT_RULES.md)
- [常用操作与测试脚本指引](file://项目相关/常用.txt)
- [BuildDownloadController](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/BuildDownloadController.java)
- [UpdateView.vue](file://med_ai_assistant_1.0_bs_vue/src/views/UpdateView.vue)
- [auto-deploy-frontend.sh](file://med_ai_assistant_1.0_bs_vue/deploy/auto-deploy-frontend.sh)
- [restore-frontend.sh](file://med_ai_assistant_1.0_bs_vue/deploy/restore-frontend.sh)
- [deploy-from-package.sh](file://med_ai_assistant_1.0_bs_vue/deploy/deploy-from-package.sh)
- [auto-deploy-backend.sh](file://med_ai_assistant_1.0_bs_backend/deploy/main-linux-oracle/auto-deploy-backend.sh)
- [restore-backend.sh](file://med_ai_assistant_1.0_bs_backend/deploy/main-linux-oracle/restore-backend.sh)
- [主服务器从执行服务器下载构建产物实现方案](file://med_ai_assistant_1.0_bs_backend/doc/布署/自动化部署/主服务器从执行服务器下载构建产物实现方案.md)
- [更新小结](file://更新小结.md)
- [后端自动部署API接口文档](file://med_ai_assistant_1.0_bs_backend/doc/接口/后端自动部署API接口文档.md)
- [前端自动部署接口](file://med_ai_assistant_1.0_bs_backend/doc/接口/前端自动部署接口.md)
- [AIController](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/AIController.java)
- [AIResponseController](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/AIResponseController.java)
- [AIContentResponseWrapper](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/util/AIContentResponseWrapper.java)
- [AIDisclaimerConstants](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/constant/AIDisclaimerConstants.java)
- [接口文档索引建立方法](file://med_ai_assistant_1.0_bs_backend/doc/其他/接口文档索引建立方法.md)
- [健康检查接口](file://med_ai_assistant_1.0_bs_backend/doc/接口/健康检查接口.md)
- [系统管理接口](file://med_ai_assistant_1.0_bs_backend/doc/接口/系统管理接口.md)
- [AI服务接口](file://med_ai_assistant_1.0_bs_backend/doc/接口/AI服务接口.md)
- [患者数据接口](file://med_ai_assistant_1.0_bs_backend/doc/接口/患者数据接口.md)
- [EMR病历记录查询接口](file://med_ai_assistant_1.0_bs_backend/doc/接口/EMR病历记录查询接口.md)
- [DRG分析接口](file://med_ai_assistant_1.0_bs_backend/doc/接口/DRG分析接口.md)
- [DRGs自动分析服务API文档](file://med_ai_assistant_1.0_bs_backend/doc/接口/DRGs自动分析服务API文档.md)
- [DRGs配置管理接口文档](file://med_ai_assistant_1.0_bs_backend/doc/接口/DRGs配置管理接口文档.md)
- [DRGs告警服务接口](file://med_ai_assistant_1.0_bs_backend/doc/接口/DRGs告警服务接口.md)
- [UserDecision用户决策服务API文档](file://med_ai_assistant_1.0_bs_backend/doc/接口/UserDecision用户决策服务API文档.md)
- [配置管理接口文档](file://med_ai_assistant_1.0_bs_backend/doc/接口/配置管理接口文档.md)
- [ExecutionServerConfigurationController执行服务器配置管理接口](file://med_ai_assistant_1.0_bs_backend/doc/接口/ExecutionServerConfigurationController执行服务器配置管理接口.md)
- [ExecutionServerProperties执行服务器配置接口文档](file://med_ai_assistant_1.0_bs_backend/doc/接口/ExecutionServerProperties执行服务器配置接口文档.md)
- [MonitoringProperties监控配置接口文档](file://med_ai_assistant_1.0_bs_backend/doc/接口/MonitoringProperties监控配置接口文档.md)
- [AI健康状态检查接口](file://med_ai_assistant_1.0_bs_backend/doc/接口/AI健康状态检查接口.md)
- [ConfigurationCacheService配置缓存服务接口](file://med_ai_assistant_1.0_bs_backend/doc/接口/ConfigurationCacheService配置缓存服务接口.md)
- [医院数据同步接口](file://med_ai_assistant_1.0_bs_backend/doc/接口/医院数据同步接口.md)
- [QcDiseaseMatchController](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/QcDiseaseMatchController.java)
- [QcAssessmentService](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/service/qc/QcAssessmentService.java)
- [质控病种匹配接口](file://med_ai_assistant_1.0_bs_backend/doc/接口/质控病种匹配接口.md)
- [qc.js](file://med_ai_assistant_1.0_bs_vue/src/api/qc.js)
</cite>

## 更新摘要
**所做更改**
- 新增POST /api/qc/assessment/{patientId}/reanalyze接口的完整文档
- 更新质控病种匹配接口文档，包含重新分析功能
- 添加质控评估服务的技术实现细节
- 更新前端API调用示例

## 目录
1. [简介](#简介)
2. [项目结构](#项目结构)
3. [核心组件](#核心组件)
4. [架构总览](#架构总览)
5. [详细组件分析](#详细组件分析)
6. [依赖分析](#依赖分析)
7. [性能考虑](#性能考虑)
8. [故障排查指南](#故障排查指南)
9. [结论](#结论)
10. [附录](#附录)

## 简介
本文件为MedAiAssistant 1.0 BS的完整API参考，覆盖主服务器与执行服务器的公共接口，包括健康检查、任务调度、患者数据操作、AI诊断调用、告警规则、用户与权限等。文档提供端点定义、请求参数、响应格式、错误码、认证机制、错误处理策略、性能优化建议以及版本与迁移说明，帮助开发者与运维人员快速理解与集成系统。

**更新** 系统现已建立完善的接口文档目录结构，按业务功能分类到9个子目录，包括：患者数据接口、AI服务接口、EMR病历记录查询接口、DRG分析接口、配置管理接口、系统管理接口、执行服务器配置接口、监控配置接口和用户决策服务接口。

## 项目结构
系统采用主服务器-执行服务器分离架构，主服务器负责API网关、业务逻辑与用户交互；执行服务器负责AI模型调用、数据处理与耗时任务。两者通过共享数据库与HTTP通信协同工作。

```mermaid
graph TB
FE["前端应用"] --> GW["API网关<br/>端口: 8081"]
GW --> MS["主服务器"]
MS --> ES["执行服务器<br/>端口: 8082"]
MS --> DB["数据库<br/>MySQL/Oracle"]
ES --> DB
MS --> REDIS["Redis缓存"]
ES --> AI["AI模型服务<br/>DeepSeek等"]
```

**图表来源**
- [部署总览:42-57](file://med_ai_assistant_1.0_bs_backend/deploy/README.md#L42-L57)
- [系统架构与流程图:5-60](file://med_ai_assistant_1.0_bs_backend/doc/其他/ARCHITECTURE_DIAGRAMS.md#L5-L60)

**章节来源**
- [部署总览:1-250](file://med_ai_assistant_1.0_bs_backend/deploy/README.md#L1-L250)
- [主服务器(Linux+Oracle)部署:1-396](file://med_ai_assistant_1.0_bs_backend/deploy/main-linux-oracle/README.md#L1-L396)
- [执行服务器(Win)部署:1-469](file://med_ai_assistant_1.0_bs_backend/deploy/execution-windows/README.md#L1-L469)
- [系统架构与流程图:1-391](file://med_ai_assistant_1.0_bs_backend/doc/其他/ARCHITECTURE_DIAGRAMS.md#L1-L391)

## 核心组件
- 主服务器（端口8081）：API网关、业务服务、轮询调度、状态监控、结果处理。
- 执行服务器（端口8082）：数据轮询、解密处理、AI调用、结果加密、状态更新。
- 共享数据库：存储业务数据与临时加密数据表。
- Redis：缓存与会话状态。
- 外部AI模型服务：DeepSeek等。

**章节来源**
- [主服务器(Linux+Oracle)部署:21-27](file://med_ai_assistant_1.0_bs_backend/deploy/main-linux-oracle/README.md#L21-L27)
- [执行服务器(Win)部署:22-29](file://med_ai_assistant_1.0_bs_backend/deploy/execution-windows/README.md#L22-L29)
- [系统架构与流程图:22-41](file://med_ai_assistant_1.0_bs_backend/doc/其他/ARCHITECTURE_DIAGRAMS.md#L22-L41)

## 架构总览
主服务器与执行服务器通过共享数据库与HTTP通信协作，实现Prompt提交、数据加密传输、AI分析、结果回传与状态管理。

```mermaid
sequenceDiagram
participant FE as "前端"
participant AC as "AIController(主)"
participant PS as "PromptService(主)"
participant Repo as "Repository"
participant AI as "AI模型"
participant Encrypt as "加密服务"
participant ExecServer as "执行服务器"
FE->>AC : "POST /api/ai/savePrompt"
AC->>Repo : "保存Prompt(状态=待处理)"
AC-->>FE : "返回Prompt ID"
loop "轮询执行"
PS->>Repo : "查询待处理Prompt"
PS->>PS : "组合提示内容"
alt "本地AI调用"
PS->>AI : "直接调用AI接口"
AI-->>PS : "返回分析结果"
else "加密传输模式"
PS->>Encrypt : "加密敏感数据"
Encrypt->>ExecServer : "发送加密数据"
ExecServer->>ExecServer : "解密数据"
ExecServer->>AI : "调用AI模型"
AI-->>ExecServer : "返回结果"
ExecServer->>ExecServer : "加密结果"
ExecServer-->>Encrypt : "返回加密结果"
Encrypt->>Encrypt : "解密结果"
Encrypt-->>PS : "返回最终结果"
end
PS->>Repo : "保存结果到PromptResult"
PS->>Repo : "更新Prompt状态=已处理"
end
FE->>AC : "GET /api/ai/patientPromptResults"
AC->>Repo : "查询患者AI结果"
AC-->>FE : "返回结果列表"
```

**图表来源**
- [系统架构与流程图:185-232](file://med_ai_assistant_1.0_bs_backend/doc/其他/ARCHITECTURE_DIAGRAMS.md#L185-L232)
- [主服务器与执行服务器交互机制分析:5-51](file://med_ai_assistant_1.0_bs_backend/doc/其他/主服务器与执行服务器交互机制分析.md#L5-L51)

**章节来源**
- [系统架构与流程图:183-232](file://med_ai_assistant_1.0_bs_backend/doc/其他/ARCHITECTURE_DIAGRAMS.md#L183-L232)
- [主服务器与执行服务器交互机制分析:53-51](file://med_ai_assistant_1.0_bs_backend/doc/其他/主服务器与执行服务器交互机制分析.md#L53-L51)

## 详细组件分析

### 健康检查与服务状态
- 主服务器健康检查
  - 方法：GET
  - 路径：/api/health
  - 响应：包含服务状态、时间戳、版本等
- AI服务健康检查
  - 方法：GET
  - 路径：/api/health/ai-status
  - 响应：包含总体健康状态、模型列表及其健康状态
- 执行服务器健康检查
  - 方法：GET
  - 路径：/api/execute/health
  - 响应：执行服务器运行状态
- 执行服务器服务状态
  - 方法：GET
  - 路径：/api/execute/service-status
  - 响应：轮询服务状态

**章节来源**
- [API文档:433-464](file://med_ai_assistant_1.0_bs_backend/doc/其他/API_DOCUMENTATION.md#L433-L464)
- [部署总览:135-155](file://med_ai_assistant_1.0_bs_backend/deploy/README.md#L135-L155)
- [执行服务器(Win)部署:159-200](file://med_ai_assistant_1.0_bs_backend/deploy/execution-windows/README.md#L159-L200)

### 患者数据与病历管理
- 病历记录
  - 查询：GET /api/medicalrecords/emr-by-patient?patientId={id}
  - 格式化输出：GET /api/medicalrecords/formatted?patientId={id}
  - 新增：POST /api/medicalrecords/save
  - 修改：PUT /api/medicalrecords/{id}
  - 删除：DELETE /api/medicalrecords/{id}
  - 软删除：PUT /api/medicalrecords/{recordId}/soft-delete
- 化验结果
  - 查询：GET /api/lab-results/by-patient/{patientId}
  - 按分析状态：GET /api/lab-results/by-patient-and-analyzed/{patientId}/{isAnalyzed}
  - 格式化输出：GET /api/lab-results/formatted-by-patient/{patientId}
- 检查结果
  - 查询：GET /api/examination-results/by-patient/{patientId}
  - 格式化输出：GET /api/examination-results/formatted/by-patient/{patientId}
- 诊断管理
  - 查询：GET /api/patients/{patientId}/diagnoses
  - 新增：POST /api/patients/{patientId}/diagnoses
  - 软删除：DELETE /api/patients/diagnoses/{diagnosisId}
  - 组合诊断字符串：GET /api/diagnosis/combined/{patientId}
  - 替换诊断：POST /api/diagnosis/replace
- 长期/临时医嘱
  - 格式化长期医嘱：GET /api/patients/{patientId}/formatted-orders
  - 格式化临时医嘱：GET /api/patients/{patientId}/formatted-temporary-orders
  - 临时医嘱：GET /api/patients/{patientId}/temporary-orders
  - 长期医嘱：GET /api/patients/{patientId}/long-term-orders
- 手术信息
  - 查询：GET /api/surgeries
  - 按患者：GET /api/surgeries/by-patient/{patientId}
- 手术字典
  - 查询：GET /api/surgery-dictionary/content?dictName={name}&department={dept}&groupName={group}
  - 新增：POST /api/surgery-dictionary/add
  - 更新：PUT /api/surgery-dictionary/update/{dictId} 或 PUT /api/surgery-dictionary/update?dictId={id}
  - 删除：DELETE /api/surgery-dictionary/delete/{dictId}

**章节来源**
- [API文档:3-782](file://med_ai_assistant_1.0_bs_backend/doc/其他/API_DOCUMENTATION.md#L3-L782)

### AI分析与对话
- 获取患者综合信息
  - 方法：GET
  - 路径：/api/ai/patient-comprehensive-info?patientId={id}
- 获取患者数据（按Prompt模板所需数据类型）
  - 方法：GET
  - 路径：/api/ai/patient-data?patientId={id}&promptType={type}&promptName={name}
- AI响应（非流式）
  - 方法：POST
  - 路径：/api/ai/response
  - 请求体：包含模型、消息、参数（temperature、max_tokens、top_p等）
  - 响应：推理过程与最终内容
- 流式AI响应
  - 方法：POST
  - 路径：/api/ai/stream-response-post
  - Content-Type：application/json
  - 响应：SSE流式数据，包含心跳与完成事件
- 保存对话历史
  - 方法：POST
  - 路径：/api/ai/response/conversation
  - 请求体：会话ID、用户ID、患者ID、消息类型、内容、模型名
- 保存AI结果
  - 方法：POST
  - 路径：/api/ai/saveResult
  - 请求体：修改后内容、原始内容、PromptID、修改人、是否已读
- Prompt模板管理
  - 获取模板内容：GET /api/ai/prompt?promptType={type}&promptName={name}
  - 获取完整模板：GET /api/ai/promptTemplate?promptType={type}&promptName={name}
  - 获取模板列表：GET /api/ai/promptTemplates
  - 获取激活模板：GET /api/ai/activePromptTemplates
  - 更新激活状态：PUT /api/ai/updatePromptActiveStatus
- Prompt结果管理
  - 列表：GET /api/ai/patientPromptResults?patientId={id}
  - 详情：GET /api/ai/patientPromptDetails?patientId={id}
  - 最近病情小结：GET /api/medicalrecords/latest-summary?patientId={id}

**章节来源**
- [API文档:192-589](file://med_ai_assistant_1.0_bs_backend/doc/其他/API_DOCUMENTATION.md#L192-L589)

### 用户与权限
- 获取用户信息：GET /api/users/{id}
- 获取用户科室：GET /api/users/{id}/departments
- 用户登录：POST /api/users/login
  - 请求体：用户ID、密码
  - 响应：布尔值表示登录是否成功

**章节来源**
- [API文档:784-810](file://med_ai_assistant_1.0_bs_backend/doc/其他/API_DOCUMENTATION.md#L784-L810)

### 告警规则
- 获取激活的告警规则内容：GET /api/alert-rules/active-rule-content?rule_name={name}
  - 返回：告警内容与所需操作（JSON）

**章节来源**
- [告警规则接口文档:1-59](file://med_ai_assistant_1.0_bs_backend/doc/其他/API_ALERT_RULES.md#L1-L59)

### 质控病种匹配接口（新增/更新）
**更新** 新增质控评估重新分析功能，完善质控模块的完整接口文档

- POST /api/qc/assessment/{patientId}/reanalyze
  - **功能说明**：触发指定患者的第三阶段AI质控评估重新分析。根据患者已确认的病种列表加载质控指标配置，获取患者临床数据，组装并保存第三阶段AI质控评估Prompt到数据库，由执行服务器异步处理。
  - **请求参数**：
    - **patientId**（路径参数，必填）：患者ID，如 `230043555_2`
  - **请求体**：无
  - **响应格式**：
    ```json
    {
      "patientId": "230043555_2",
      "status": "SAVED",
      "success": true,
      "message": "质控评估任务已提交"
    }
    ```
  - **业务逻辑**：
    1. 查询患者已确认病种（QC_CONFIRMED_DISEASE 表，IS_ACTIVE=1）
    2. 遍历已确认病种，加载每个病种的启用质控指标配置（QC_INDICATOR_CONFIG 表）
    3. 获取"QC-第三阶段-AI质控评估"Prompt模板
    4. 调用 AIController.getPatientData 获取患者临床数据（失败时降级处理）
    5. 组装 ObjectiveContent（患者临床资料 + 质控指标评估清单Markdown表格）
    6. 保存 Prompt（status=待处理, generatedBy=QC-SYSTEM, priority=2）
  - **状态码与响应**：
    - `200 OK` + status=SAVED — 质控评估任务已提交
    - `400 Bad Request` + status=NO_CONFIRMED_DISEASE — 该患者无已确认病种
    - `500 Internal Server Error` + status=NO_INDICATOR_CONFIG — 已确认病种无有效指标配置
    - `500 Internal Server Error` + status=NO_TEMPLATE — 未找到质控评估Prompt模板
    - `500 Internal Server Error` + status=ERROR — 处理失败
  - **响应示例**：
    成功：
    ```json
    {
      "patientId": "230043555_2",
      "status": "SAVED",
      "success": true,
      "message": "质控评估任务已提交"
    }
    ```
    无已确认病种：
    ```json
    {
      "patientId": "230043555_2",
      "status": "NO_CONFIRMED_DISEASE",
      "success": false,
      "message": "该患者无已确认病种，请先确认病种"
    }
    ```

**章节来源**
- [QcDiseaseMatchController:78-127](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/QcDiseaseMatchController.java#L78-L127)
- [QcAssessmentService:137-223](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/service/qc/QcAssessmentService.java#L137-L223)
- [质控病种匹配接口:321-387](file://med_ai_assistant_1.0_bs_backend/doc/接口/质控病种匹配接口.md#L321-L387)
- [qc.js:213-215](file://med_ai_assistant_1.0_bs_vue/src/api/qc.js#L213-L215)

### 部署相关API（新增/更新）
**更新** 新增后端自动部署API接口（POST /api/deploy/auto-deploy-backend）、增强前端自动部署功能、完善版本号管理API、更新CI/CD相关接口文档

- 后端自动部署接口
  - 方法：POST
  - 路径：/api/deploy/auto-deploy-backend
  - 请求体：无
  - 响应：包含部署状态、消息、输出日志等信息
  - 超时时间：600秒
  - 用途：执行后端自动部署脚本，自动完成版本检查、下载、备份、解压、部署等操作
  - 特性：版本号+文件大小双校验防重复部署、自动备份与回滚、错误处理和日志记录
  - 防重复部署机制：版本号比对 + 文件大小校验 + 双校验通过则跳过部署
  - 错误恢复：部署失败时自动从备份恢复
- 自动部署前端
  - 方法：POST
  - 路径：/api/deploy/auto-deploy-frontend
  - 请求体：无
  - 响应：包含部署状态、消息、输出日志等信息
  - 超时时间：600秒
  - 用途：执行自动部署脚本，自动完成版本检查、下载、备份、解压、部署等操作
- 手动部署前端
  - 方法：POST
  - 路径：/api/deploy/deploy-frontend
  - 请求体：包含version（必需）、expectedSize（可选）
  - 响应：包含部署状态、版本号、文件路径、文件大小、输出日志等信息
  - 用途：验证文件后手动执行部署脚本
- 查询执行服务器最新版本
  - 方法：GET
  - 路径：/api/deploy/latest
  - 响应：包含后端和前端的最新版本号和文件大小
- 下载构建产物
  - 方法：POST
  - 路径：/api/deploy/download
  - 请求体：包含backendVersion、frontendVersion、backendDownloadDir（可选）、frontendDownloadDir（可选）
  - 响应：包含每个文件的下载状态、路径、大小等信息
- 查询下载状态
  - 方法：GET
  - 路径：/api/deploy/status
  - 参数：backendVersion（可选）、frontendVersion（可选）
  - 响应：包含文件是否存在、路径、大小等状态信息

**章节来源**
- [BuildDownloadController:423-493](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/BuildDownloadController.java#L423-L493)
- [BuildDownloadController:289-403](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/BuildDownloadController.java#L289-L403)
- [BuildDownloadController:129-155](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/BuildDownloadController.java#L129-L155)
- [BuildDownloadController:184-230](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/BuildDownloadController.java#L184-L230)
- [BuildDownloadController:245-267](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/BuildDownloadController.java#L245-L267)
- [auto-deploy-backend.sh:1-478](file://med_ai_assistant_1.0_bs_backend/deploy/main-linux-oracle/auto-deploy-backend.sh#L1-L478)
- [restore-backend.sh:1-237](file://med_ai_assistant_1.0_bs_backend/deploy/main-linux-oracle/restore-backend.sh#L1-L237)
- [主服务器从执行服务器下载构建产物实现方案:44-141](file://med_ai_assistant_1.0_bs_backend/doc/布署/自动化部署/主服务器从执行服务器下载构建产物实现方案.md#L44-L141)
- [后端自动部署API接口文档:1-213](file://med_ai_assistant_1.0_bs_backend/doc/接口/后端自动部署API接口文档.md#L1-L213)
- [前端自动部署接口:1-114](file://med_ai_assistant_1.0_bs_backend/doc/接口/前端自动部署接口.md#L1-L114)

### 执行服务器专用接口
- 加密数据提交：POST /api/execute/encrypted-prompt
- 启动轮询服务：POST /api/execute/start-service
- 停止轮询服务：POST /api/execute/stop-service
- 轮询状态：GET /api/execute/service-status
- 健康检查：GET /api/execute/health
- 轮询统计：GET /api/execute/polling-stats

**章节来源**
- [主服务器与执行服务器交互机制分析:277-300](file://med_ai_assistant_1.0_bs_backend/doc/其他/主服务器与执行服务器交互机制分析.md#L277-L300)

### AI分析结果渲染系统改进
**更新** 新增AI分析结果渲染系统改进，实现Markdown渲染能力和自动过滤thinking标签功能，提供更清晰、专业的医学分析结果展示

#### Markdown渲染能力
- AI内容统一包装：所有AI生成内容通过AIContentResponseWrapper进行标准化包装
- 免责声明统一添加：自动在响应中添加AI免责声明字段（aiDisclaimer）
- 流式与非流式响应支持：同时支持SSE流式响应和标准JSON响应
- 内容结构化输出：content字段包含主要分析内容，reasoning_content字段可选包含推理过程

#### Thinking标签自动过滤
- 推理过程提取：从AI响应中自动提取reasoning_content字段
- 思维链内容分离：将推理过程与最终内容分离展示
- 标准化输出格式：支持thinking标签的自动过滤和格式化

#### AI内容响应包装工具
- AIContentResponseWrapper类提供多种包装方法：
  - wrapWithDisclaimer：包装任意对象为标准响应格式
  - addDisclaimerToMap：向现有Map添加免责声明字段
  - createStreamResponse：创建流式响应格式
  - createFullResponse：创建完整的非流式响应

#### 免责声明常量管理
- AIDisclaimerConstants类集中管理所有AI免责声明相关的常量
- 标准免责声明文本："本内容由AI生成，仅供参考"
- 统一的免责声明字段名："aiDisclaimer"

**章节来源**
- [AIController:663-1192](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/AIController.java#L663-L1192)
- [AIResponseController:329-528](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/AIResponseController.java#L329-L528)
- [AIContentResponseWrapper:1-181](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/util/AIContentResponseWrapper.java#L1-L181)
- [AIDisclaimerConstants:1-58](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/constant/AIDisclaimerConstants.java#L1-L58)

### DRG分析服务接口
**新增** DRG分析服务的完整接口文档，包括分析计算、配置管理和告警服务

- DRG分析接口
  - 方法：POST
  - 路径：/api/drgs/analyze
  - 请求体：包含患者DRG相关信息、诊断代码、手术代码等
  - 响应：DRG分组结果、费用估算、风险评估
- DRGs自动分析服务API
  - 方法：GET
  - 路径：/api/drgs/automatic-analysis
  - 响应：批量DRG分析结果
- DRGs配置管理接口
  - 方法：GET/PUT
  - 路径：/api/drgs/config
  - 响应：DRG配置参数和规则
- DRGs告警服务接口
  - 方法：GET
  - 路径：/api/drgs/alerts
  - 响应：DRG相关告警信息和风险提示

**章节来源**
- [DRG分析接口:1-200](file://med_ai_assistant_1.0_bs_backend/doc/接口/DRG分析接口.md#L1-L200)
- [DRGs自动分析服务API文档:1-250](file://med_ai_assistant_1.0_bs_backend/doc/接口/DRGs自动分析服务API文档.md#L1-L250)
- [DRGs配置管理接口文档:1-150](file://med_ai_assistant_1.0_bs_backend/doc/接口/DRGs配置管理接口文档.md#L1-L150)
- [DRGs告警服务接口:1-120](file://med_ai_assistant_1.0_bs_backend/doc/接口/DRGs告警服务接口.md#L1-L120)

### 用户决策服务接口
**新增** 用户决策支持服务的完整接口文档

- UserDecision用户决策服务API
  - 方法：POST
  - 路径：/api/user-decision/make-decision
  - 请求体：包含患者信息、AI分析结果、医生建议等
  - 响应：用户决策支持结果和建议
- 决策历史查询
  - 方法：GET
  - 路径：/api/user-decision/history
  - 参数：patientId、dateRange等
  - 响应：用户决策历史记录

**章节来源**
- [UserDecision用户决策服务API文档:1-180](file://med_ai_assistant_1.0_bs_backend/doc/接口/UserDecision用户决策服务API文档.md#L1-L180)

### 配置管理服务接口
**新增** 系统配置管理的完整接口文档

- 配置管理接口文档
  - 方法：GET/POST/PUT/DELETE
  - 路径：/api/config/*
  - 响应：系统配置参数和状态
- ExecutionServerConfigurationController执行服务器配置管理接口
  - 方法：GET/POST/PUT/DELETE
  - 路径：/api/execution-server/config/*
  - 响应：执行服务器配置信息
- ExecutionServerProperties执行服务器配置接口文档
  - 方法：GET/POST/PUT/DELETE
  - 路径：/api/execution-server/properties/*
  - 响应：执行服务器属性配置
- MonitoringProperties监控配置接口文档
  - 方法：GET/POST/PUT/DELETE
  - 路径：/api/monitoring/config/*
  - 响应：监控系统配置参数
- ConfigurationCacheService配置缓存服务接口
  - 方法：GET/POST/PUT/DELETE
  - 路径：/api/config/cache/*
  - 响应：配置缓存状态和信息

**章节来源**
- [配置管理接口文档:1-200](file://med_ai_assistant_1.0_bs_backend/doc/接口/配置管理接口文档.md#L1-L200)
- [ExecutionServerConfigurationController执行服务器配置管理接口:1-150](file://med_ai_assistant_1.0_bs_backend/doc/接口/ExecutionServerConfigurationController执行服务器配置管理接口.md#L1-L150)
- [ExecutionServerProperties执行服务器配置接口文档:1-120](file://med_ai_assistant_1.0_bs_backend/doc/接口/ExecutionServerProperties执行服务器配置接口文档.md#L1-L120)
- [MonitoringProperties监控配置接口文档:1-100](file://med_ai_assistant_1.0_bs_backend/doc/接口/MonitoringProperties监控配置接口文档.md#L1-L100)
- [ConfigurationCacheService配置缓存服务接口:1-80](file://med_ai_assistant_1.0_bs_backend/doc/接口/ConfigurationCacheService配置缓存服务接口.md#L1-L80)

### 系统管理接口
**新增** 系统管理功能的完整接口文档

- 系统管理接口
  - 方法：GET/POST/PUT/DELETE
  - 路径：/api/system/*
  - 响应：系统状态和管理信息
- AI健康状态检查接口
  - 方法：GET
  - 路径：/api/health/ai-status
  - 响应：AI服务健康状态
- 医院数据同步接口
  - 方法：POST
  - 路径：/api/hospital-data/sync
  - 请求体：包含同步数据和参数
  - 响应：同步状态和结果

**章节来源**
- [系统管理接口:1-250](file://med_ai_assistant_1.0_bs_backend/doc/接口/系统管理接口.md#L1-L250)
- [AI健康状态检查接口:1-100](file://med_ai_assistant_1.0_bs_backend/doc/接口/AI健康状态检查接口.md#L1-L100)
- [医院数据同步接口:1-180](file://med_ai_assistant_1.0_bs_backend/doc/接口/医院数据同步接口.md#L1-L180)

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
date record_time
string recording_doctor
text medical_content
string record_type
int is_deleted
}
DIAGNOSIS {
int DiagnosisID PK
string PatientID FK
int DiagnosisType
string ICD10Code
string DiagnosisText
string DiagnosedBy
date DiagnosisTime
}
LAB_RESULT {
int labResultId PK
string patientId FK
string itemName
string result
string unit
date testDate
}
EXAMINATION_RESULT {
int examinationResultId PK
string patientId FK
text result
date examinationDate
}
PROMPTS {
int promptId PK
string patientId FK
text objectiveContent
text dailyRecords
string statusName
datetime executionTime
int retryCount
text executionResult
}
PROMPT_TEMPLATE {
int PromptID PK
string PromptType
string PromptName
text Prompt
text FilterRules
bool IS_ACTIVE
}
PROMPT_RESULTS {
int resultId PK
int promptId FK
text originalResultContent
string status
datetime createdTime
}
USERS {
string id PK
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
string user_Id PK,FK
int department_Id PK,FK
int isPrimary
}
ENCRYPTED_DATA_TEMP {
string id PK
clob encryptedData
clob decryptedData
string status
timestamp receivedTime
timestamp processedTime
}
PATIENTS ||--o{ MEDICAL_RECORDS : "has"
PATIENTS ||--o{ DIAGNOSIS : "has"
PATIENTS ||--o{ LAB_RESULT : "has"
PATIENTS ||--o{ EXAMINATION_RESULT : "has"
PATIENTS ||--o{ PROMPTS : "analyzed by"
PROMPTS ||--|| PROMPT_RESULTS : "generates"
PROMPT_TEMPLATE ||--o{ PROMPTS : "uses"
USERS ||--o{ USER_DEPARTMENT : "belongs to"
DEPARTMENT ||--o{ USER_DEPARTMENT : "contains"
```

**图表来源**
- [系统架构与流程图:62-181](file://med_ai_assistant_1.0_bs_backend/doc/other/ARCHITECTURE_DIAGRAMS.md#L62-L181)

## 依赖分析
- 主服务器依赖
  - 数据库：MySQL/Oracle（通过配置切换）
  - Redis：缓存与会话
  - 执行服务器：通过HTTP通信进行任务分发与结果回传
- 执行服务器依赖
  - 数据库：Oracle（远程连接）
  - 外部AI模型：DeepSeek等
  - 主服务器：回调与状态查询

```mermaid
graph TB
subgraph "主服务器"
A["API网关"]
B["业务服务"]
C["轮询调度"]
D["状态监控"]
end
subgraph "执行服务器"
E["数据轮询"]
F["解密处理"]
G["AI调用"]
H["结果加密"]
I["状态更新"]
end
subgraph "共享资源"
J["数据库"]
K["Redis"]
end
A --> B
B --> C
C --> J
D --> J
A --> J
A --> K
B --> J
E --> J
F --> J
G --> J
H --> J
I --> J
E --> A
I --> A
```

**图表来源**
- [主服务器与执行服务器交互机制分析:9-51](file://med_ai_assistant_1.0_bs_backend/doc/其他/主服务器与执行服务器交互机制分析.md#L9-L51)
- [系统架构与流程图:5-60](file://med_ai_assistant_1.0_bs_backend/doc/其他/ARCHITECTURE_DIAGRAMS.md#L5-L60)

**章节来源**
- [主服务器与执行服务器交互机制分析:253-300](file://med_ai_assistant_1.0_bs_backend/doc/其他/主服务器与执行服务器交互机制分析.md#L253-L300)
- [系统架构与流程图:5-60](file://med_ai_assistant_1.0_bs_backend/doc/其他/ARCHITECTURE_DIAGRAMS.md#L5-L60)

## 性能考虑
- 轮询与批处理
  - 主服务器轮询间隔可配置，默认30秒；执行服务器每次最多处理10条记录。
  - 事务隔离级别为READ_COMMITTED，避免脏读。
- 连接池与超时
  - HTTP客户端连接池：最大连接200，每路由50；连接超时30秒，读取超时5分钟。
  - AI模型调用超时：读取超时延长至600秒（执行服务器优化后可达600秒）。
- 缓存与幂等
  - 统一缓存管理：操作前后清理缓存，使用JPQL直接更新避免实体缓存问题。
  - 幂等性：基于REQUEST_ID唯一约束，防止重复提交。
- 并发与限流
  - 线程池：提示生成3-5线程，手术分析3-5线程，通用执行器10-20线程。
  - 限流与队列：请求限流与队列管理，避免过载。
- 监控与告警
  - 轮询失败率>5%、平均响应时间>30秒、数据库连接失败、执行服务器不可达等阈值告警。

**章节来源**
- [主服务器与执行服务器交互机制分析:386-454](file://med_ai_assistant_1.0_bs_backend/doc/其他/主服务器与执行服务器交互机制分析.md#L386-L454)
- [执行服务器LLM调用优化接口文档:120-182](file://med_ai_assistant_1.0_bs_backend/doc/其他/执行服务器LLM调用优化接口文档.md#L120-L182)
- [执行服务器性能优化方案:28-133](file://med_ai_assistant_1.0_bs_backend/doc/其他/执行服务器性能优化方案.md#L28-L133)

## 故障排查指南
- 健康检查失败
  - 检查端口占用与防火墙；确认SELinux状态（CentOS）。
- 连接执行服务器失败
  - 测试网络连通性（ping/telnet）；核对环境变量EXECUTION_SERVER_*配置。
- Oracle数据库连接失败
  - 检查端口连通性与服务名；查看ORA错误日志。
- AI模型调用失败
  - 校验API密钥与网络连通性；适当增加超时时间。
- 内存不足
  - 调整JVM参数与Docker资源限制；监控容器资源使用。
- 轮询服务未启动
  - 检查POLLING_ENABLED配置；手动启动轮询服务或调用API。
- **部署相关问题**
  - 自动部署脚本执行失败：检查脚本路径、权限、网络连接
  - 文件下载失败：检查下载目录权限、磁盘空间、网络连通性
  - 部署脚本超时：检查服务器性能、磁盘IO、网络延迟
  - 后端部署失败：检查Docker镜像、配置文件、端口占用
  - 版本号不一致：检查主服务器和执行服务器的版本同步
- **质控评估重新分析问题**
  - 检查患者是否已确认病种：调用 GET /api/qc/disease-match/{patientId}/confirmed
  - 确认质控指标配置是否有效：检查 QC_INDICATOR_CONFIG 表
  - 验证 Prompt 模板是否存在：检查 PROMPT_TEMPLATE 表中 "QC-第三阶段-AI质控评估" 模板
  - 检查 AIController.getPatientData 接口是否正常工作

**章节来源**
- [主服务器(Linux+Oracle)部署:282-346](file://med_ai_assistant_1.0_bs_backend/deploy/main-linux-oracle/README.md#L282-L346)
- [执行服务器(Win)部署:282-373](file://med_ai_assistant_1.0_bs_backend/deploy/execution-windows/README.md#L282-L373)

## 结论
本文档系统梳理了MedAiAssistant 1.0 BS的API接口与架构要点，明确了主服务器与执行服务器的职责边界、数据与状态流转、性能优化策略与故障排查方法。建议在生产环境中启用HTTPS、严格配置密钥与网络访问、建立完善的监控与告警体系，并遵循测试金字塔进行持续验证与优化。

## 附录

### API使用示例（节选）
- 获取患者综合信息
  - GET /api/ai/patient-comprehensive-info?patientId=510321196404309254_1
- 获取格式化病历记录
  - GET /api/medicalrecords/formatted?patientId=510321196404309254_1
- AI响应（非流式）
  - POST /api/ai/response
  - 请求体：包含model、messages、参数（temperature、max_tokens、top_p等）
- 流式AI响应
  - POST /api/ai/stream-response-post
  - Content-Type: application/json
- 保存对话历史
  - POST /api/ai/response/conversation
  - 请求体：sessionId、userId、patientId、messageType、content、modelName
- 保存AI结果
  - POST /api/ai/saveResult
  - 请求体：content、originalContent、promptId、lastModifiedBy、isRead
- **部署相关API使用示例**
  - 后端自动部署：POST /api/deploy/auto-deploy-backend
  - 自动部署前端：POST /api/deploy/auto-deploy-frontend
  - 手动部署前端：POST /api/deploy/deploy-frontend
  - 查询最新版本：GET /api/deploy/latest
  - 下载构建产物：POST /api/deploy/download
  - 查询下载状态：GET /api/deploy/status
- **DRG分析服务API使用示例**
  - DRG分析：POST /api/drgs/analyze
  - 自动分析：GET /api/drgs/automatic-analysis
  - 配置管理：GET/PUT /api/drgs/config
  - 告警查询：GET /api/drgs/alerts
- **用户决策服务API使用示例**
  - 决策支持：POST /api/user-decision/make-decision
  - 历史查询：GET /api/user-decision/history
- **配置管理服务API使用示例**
  - 系统配置：GET/POST/PUT/DELETE /api/config/*
  - 执行服务器配置：GET/POST/PUT/DELETE /api/execution-server/config/*
  - 监控配置：GET/POST/PUT/DELETE /api/monitoring/config/*
- **系统管理服务API使用示例**
  - 系统状态：GET/POST/PUT/DELETE /api/system/*
  - AI健康状态：GET /api/health/ai-status
  - 数据同步：POST /api/hospital-data/sync
- **质控病种匹配API使用示例**
  - 重新分析质控评估：POST /api/qc/assessment/{patientId}/reanalyze
  - 获取最近匹配结果：GET /api/qc/disease-match/{patientId}/latest
  - 病种确认：POST /api/qc/disease-match/confirm
  - 查询已确认病种：GET /api/qc/disease-match/{patientId}/confirmed

**章节来源**
- [API文档:192-589](file://med_ai_assistant_1.0_bs_backend/doc/其他/API_DOCUMENTATION.md#L192-L589)

### 错误码与处理策略
- 通用错误码
  - 200：请求成功
  - 400：请求参数错误
  - 404：资源不存在
  - 500：服务器内部错误
- 错误处理策略
  - 参数校验与默认值处理
  - 完善的重试机制（指数退避）
  - 超时控制与稳定性保障
  - 错误日志记录与监控告警
- **部署相关错误处理**
  - 自动部署超时：600秒超时，脚本执行失败返回错误码
  - 文件下载失败：检查网络连接、磁盘空间、权限
  - 部署脚本执行失败：检查脚本完整性、依赖环境、权限
  - 后端部署失败：检查Docker镜像、配置文件、端口占用
  - 版本号不一致：检查主服务器和执行服务器的版本同步
- **DRG分析服务错误处理**
  - DRG配置错误：返回配置验证失败信息
  - 分析计算异常：返回计算过程中的具体错误
  - 数据格式不匹配：返回期望的数据格式说明
- **用户决策服务错误处理**
  - 决策参数缺失：返回必需参数列表
  - 数据验证失败：返回具体的验证错误
  - 系统资源不足：返回资源使用情况和建议
- **配置管理服务错误处理**
  - 配置项不存在：返回可用配置列表
  - 权限不足：返回管理员权限要求
  - 配置冲突：返回冲突的配置项和解决方案
- **质控评估服务错误处理**
  - 无已确认病种：返回 NO_CONFIRMED_DISEASE 状态
  - 无有效指标配置：返回 NO_INDICATOR_CONFIG 状态
  - 无 Prompt 模板：返回 NO_TEMPLATE 状态
  - 处理异常：返回 ERROR 状态
  - 患者数据获取失败：进行降级处理，仍保存 Prompt

**章节来源**
- [API文档:400-432](file://med_ai_assistant_1.0_bs_backend/doc/其他/API_DOCUMENTATION.md#L400-L432)
- [告警规则接口文档:41-47](file://med_ai_assistant_1.0_bs_backend/doc/其他/API_ALERT_RULES.md#L41-L47)
- [QcAssessmentService:89-95](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/service/qc/QcAssessmentService.java#L89-L95)

### 认证机制说明
- 用户登录
  - POST /api/users/login
  - 请求体：用户ID、密码
  - 响应：布尔值表示登录是否成功
- 执行服务器通信
  - 通过主服务器进行加密传输与状态管理，确保数据安全
- **部署相关认证**
  - 部署API通常需要管理员权限
  - 建议在生产环境启用HTTPS和API密钥认证
- **DRG分析服务认证**
  - 需要医疗专业人员权限
  - 支持基于角色的访问控制
- **用户决策服务认证**
  - 需要医生或授权医疗人员权限
  - 支持多级审批流程
- **配置管理服务认证**
  - 需要系统管理员权限
  - 支持审计日志记录
- **质控评估服务认证**
  - 需要医疗质量管理人员权限
  - 支持基于科室的访问控制

**章节来源**
- [API文档:798-810](file://med_ai_assistant_1.0_bs_backend/doc/其他/API_DOCUMENTATION.md#L798-L810)
- [主服务器与执行服务器交互机制分析:302-342](file://med_ai_assistant_1.0_bs_backend/doc/其他/主服务器与执行服务器交互机制分析.md#L302-L342)

### 版本管理与迁移
- 版本信息
  - 服务状态检查响应包含版本号（例如1.0.0）
  - 前端版本：0.4.067（最新）
  - 后端版本：0.4.067（最新）
- 迁移建议
  - 保持API兼容性，逐步迁移
  - 建立灰度发布与回滚方案
  - 持续性能监控与回归测试
- **部署相关版本管理**
  - 支持自动版本检查和回滚
  - 版本号+文件大小双校验防重复部署
  - 支持自定义下载目录
  - 防重复部署机制：版本号比对 + 文件大小校验
- **接口文档版本管理**
  - 按功能模块独立版本控制
  - 支持文档版本对比和变更追踪
  - 建议使用语义化版本控制
- **质控评估服务版本管理**
  - 支持增量更新质控指标配置
  - 保持 Prompt 模板向后兼容
  - 支持历史评估结果查询

**章节来源**
- [API文档:452-464](file://med_ai_assistant_1.0_bs_backend/doc/其他/API_DOCUMENTATION.md#L452-L464)
- [执行服务器性能优化方案:197-240](file://med_ai_assistant_1.0_bs_backend/doc/其他/执行服务器性能优化方案.md#L197-L240)
- [更新小结:1-53](file://更新小结.md#L1-L53)

### 部署脚本与恢复机制
**更新** 系统包含完整的前端部署脚本和恢复机制，新增后端自动部署功能

- 后端自动部署脚本（auto-deploy-backend.sh）
  - 自动获取最新版本
  - 检查当前部署版本，实现防重复部署
  - 下载最新后端构建包（Docker镜像tar包）
  - 清理上一次备份并备份当前部署
  - 准备部署目录并复制新镜像
  - 执行deploy.sh进行部署
  - 支持自动备份与回滚
  - 600秒超时控制
  - 防重复部署机制：版本号比对 + 文件大小校验
- 后端手动恢复脚本（restore-backend.sh）
  - 查找所有备份
  - 交互式选择备份版本
  - 执行手动恢复
  - 支持安全备份
  - 自动加载Docker镜像
- 自动部署脚本（auto-deploy-frontend.sh）
  - 自动获取最新版本
  - 检查当前部署版本
  - 下载最新前端构建包
  - 备份当前部署
  - 解压并部署新版本
  - 执行部署脚本
  - 支持强制重新部署
  - 600秒超时控制
- 手动恢复脚本（restore-frontend.sh）
  - 查找所有备份
  - 交互式选择备份版本
  - 执行手动恢复
  - 支持安全备份
- 手动部署脚本（deploy-from-package.sh）
  - 解压ZIP包
  - 加载Docker镜像
  - 执行部署脚本

**章节来源**
- [auto-deploy-backend.sh:1-478](file://med_ai_assistant_1.0_bs_backend/deploy/main-linux-oracle/auto-deploy-backend.sh#L1-L478)
- [restore-backend.sh:1-237](file://med_ai_assistant_1.0_bs_backend/deploy/main-linux-oracle/restore-backend.sh#L1-L237)
- [auto-deploy-frontend.sh:1-280](file://med_ai_assistant_1.0_bs_vue/deploy/auto-deploy-frontend.sh#L1-L280)
- [restore-frontend.sh:1-155](file://med_ai_assistant_1.0_bs_vue/deploy/restore-frontend.sh#L1-L155)
- [deploy-from-package.sh:1-34](file://med_ai_assistant_1.0_bs_vue/deploy/deploy-from-package.sh#L1-L34)

### 前端更新界面功能
**新增** UpdateView.vue提供完整的系统更新功能

- 查询最新版本：调用执行服务器API获取版本信息
- 自动部署前端：执行自动部署脚本，显示实时日志输出
- 自动部署后端：执行后端自动部署脚本，显示实时日志输出
- 版本信息展示：显示后端和前端版本号及文件大小
- 部署状态反馈：成功/失败状态提示和详细日志输出
- 文件大小格式化：人性化显示文件大小（Bytes/KB/MB/GB）
- 接口路径修复：避免与基础URL中的/api重复，使用`/deploy/auto-deploy-frontend`和`/deploy/auto-deploy-backend`

**章节来源**
- [UpdateView.vue:1-493](file://med_ai_assistant_1.0_bs_vue/src/views/UpdateView.vue#L1-L493)

### AI分析结果渲染系统详细说明
**新增** AI分析结果渲染系统改进的详细技术实现

#### Markdown渲染实现细节
- 内容结构化输出：AI响应统一通过AIContentResponseWrapper进行包装
- 免责声明标准化：所有响应自动添加aiDisclaimer字段，确保合规性
- 流式与非流式支持：同时支持SSE流式响应和标准JSON响应格式
- 内容分离展示：content字段包含主要分析内容，reasoning_content字段可选包含推理过程

#### Thinking标签自动过滤机制
- 推理过程提取：从AI响应中自动提取reasoning_content字段
- 思维链内容分离：将推理过程与最终内容分离展示，便于用户理解AI决策过程
- 标准化输出格式：支持thinking标签的自动过滤和格式化，确保输出的专业性和可读性

#### 技术实现架构
- AIContentResponseWrapper：提供多种包装方法，支持不同场景的响应格式
- AIDisclaimerConstants：集中管理免责声明相关的常量定义
- AIResponseController：处理AI响应的流式和非流式输出
- AIController：负责患者数据获取和AI结果管理

**章节来源**
- [AIController:663-1192](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/AIController.java#L663-L1192)
- [AIResponseController:329-528](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/AIResponseController.java#L329-L528)
- [AIContentResponseWrapper:1-181](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/util/AIContentResponseWrapper.java#L1-L181)
- [AIDisclaimerConstants:1-58](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/constant/AIDisclaimerConstants.java#L1-L58)

### 接口文档索引系统
**更新** 系统已建立完善的接口文档索引系统，按业务功能分类到9个子目录

#### 索引系统架构
- **主索引文件**：`doc/接口/接口文档索引.md`
- **功能分类**：按业务领域划分到9个子目录
- **导航结构**：提供清晰的功能模块导航

#### 功能模块分类
1. **患者数据接口**：患者基本信息、病历记录、诊断管理
2. **AI服务接口**：AI分析、对话管理、Prompt模板
3. **EMR病历记录查询接口**：电子病历查询、格式化输出
4. **DRG分析接口**：DRG分组、费用估算、风险评估
5. **配置管理接口**：系统配置、执行服务器配置
6. **系统管理接口**：健康检查、轮询状态、数据同步
7. **执行服务器配置接口**：执行服务器属性配置
8. **监控配置接口**：监控系统参数配置
9. **用户决策服务接口**：决策支持、历史记录
10. **质控病种匹配接口**：病种确认、评估重新分析、指标配置

#### 索引建立步骤
1. **创建主索引文件**：在`doc/接口/接口文档索引.md`中建立分类导航
2. **为接口文档添加目录锚点**：在每个接口文档开头添加目录锚点
3. **为每个接口添加锚点标签**：在接口标题前添加锚点标签
4. **添加返回链接**：在接口文档开头添加返回主索引的链接

**章节来源**
- [接口文档索引建立方法:1-203](file://med_ai_assistant_1.0_bs_backend/doc/其他/接口文档索引建立方法.md#L1-L203)
- [更新小结:124-235](file://更新小结.md#L124-L235)

### 质控评估服务技术实现详解
**新增** 质控评估服务的完整技术实现文档

#### 服务架构设计
- **服务定位**：QcAssessmentService 专门负责第三阶段质控评估的 Prompt 生成
- **依赖注入**：通过构造函数注入所有必要的 Repository 和 Controller 依赖
- **线程安全**：服务方法为纯函数式设计，无状态，天然线程安全
- **日志记录**：详细的步骤日志记录，便于问题排查和性能分析

#### 处理状态枚举
服务定义了完整的 ProcessStatus 枚举，用于精确描述处理结果：
- **SAVED**：Prompt 成功保存，等待执行服务器处理
- **NO_CONFIRMED_DISEASE**：患者无已确认病种，无法继续处理
- **NO_INDICATOR_CONFIG**：已确认病种无有效质控指标配置
- **NO_TEMPLATE**：未找到对应的 Prompt 模板
- **ERROR**：处理过程中发生异常

#### 核心处理流程
1. **数据准备阶段**
   - 查询患者已确认病种（IS_ACTIVE=1）
   - 加载各病种的质控指标配置
   - 获取 Prompt 模板内容

2. **数据获取阶段**
   - 调用 AIController.getPatientData 获取患者临床数据
   - 实现降级处理：即使数据获取失败也继续执行

3. **内容组装阶段**
   - 组装患者临床资料部分
   - 生成质控指标评估清单的 Markdown 表格
   - 合并所有内容形成 ObjectiveContent

4. **持久化阶段**
   - 创建 Prompt 实体并设置必要属性
   - 保存到数据库，状态设为"待处理"
   - 返回 SAVED 状态

#### 性能优化特性
- **批量处理**：支持单患者多病种、多指标的批量处理
- **内存优化**：使用 StringBuilder 进行字符串拼接，减少内存分配
- **异常降级**：患者数据获取异常不影响整体流程
- **性能测试**：包含100指标和200指标跨10病种的性能测试用例

#### 测试覆盖范围
- **早期返回场景**：无病种、无指标配置、无模板三种早期退出场景
- **降级处理场景**：患者数据为空时的处理逻辑
- **正常流程场景**：完整的数据准备、组装、保存流程
- **边界条件场景**：null 值处理、部分病种有效等边界情况
- **异常处理场景**：Repository 异常、保存异常等异常情况
- **性能基准场景**：大量指标场景的性能测试

**章节来源**
- [QcAssessmentService:20-296](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/service/qc/QcAssessmentService.java#L20-L296)
- [QcAssessmentServiceTest:35-678](file://med_ai_assistant_1.0_bs_backend/src/test/java/com/example/medaiassistant/qc/service/QcAssessmentServiceTest.java#L35-L678)