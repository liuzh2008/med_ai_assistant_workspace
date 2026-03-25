# AI诊断辅助系统

<cite>
**本文引用的文件**
- [执行服务器LLM调用优化敏捷迭代规划.md](file://med_ai_assistant_1.0_bs_backend/doc/其他/执行服务器LLM调用优化敏捷迭代规划.md)
- [API文档.md](file://med_ai_assistant_1.0_bs_backend/doc/其他/API_DOCUMENTATION.md)
- [AI模型配置类.java](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/config/AIModelConfig.java)
- [执行服务器控制器.java](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/ExecutionServerController.java)
- [系统架构图.md](file://med_ai_assistant_1.0_bs_backend/doc/其他/ARCHITECTURE_DIAGRAMS.md)
- [AI响应接口网络中断后连接失败问题分析与解决方案.md](file://med_ai_assistant_1.0_bs_backend/doc/其他/AI响应接口网络中断后连接失败问题分析与解决方案.md)
- [执行服务器架构简化实施报告.md](file://med_ai_assistant_1.0_bs_backend/doc/其他/执行服务器架构简化实施报告.md)
- [执行服务器性能优化方案.md](file://med_ai_assistant_1.0_bs_backend/doc/其他/执行服务器性能优化方案.md)
- [application.properties](file://med_ai_assistant_1.0_bs_backend/src/main/resources/application.properties)
- [aiService.js](file://med_ai_assistant_1.0_bs_vue/src/api/aiService.js)
- [2026-03-25更新日志.md](file://med_ai_assistant_1.0_bs/更新小结.md)
- [2026-03-24更新日志.md](file://med_ai_assistant_1.0_bs/更新小结.md)
- [2026-03-23更新日志.md](file://med_ai_assistant_1.0_bs/更新小结.md)
- [2026-03-21更新日志.md](file://med_ai_assistant_1.0_bs/更新小结.md)
- [2026-03-20更新日志.md](file://med_ai_assistant_1.0_bs/更新小结.md)
- [2026-03-08更新日志.md](file://med_ai_assistant_1.0_bs/更新小结.md)
- [MccScreeningController.java](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/MccScreeningController.java)
- [DRG分析接口.md](file://med_ai_assistant_1.0_bs_backend/doc/接口/DRG分析接口.md)
- [drg.js](file://med_ai_assistant_1.0_bs_vue/src/api/drg.js)
- [DrgAnalysis.vue](file://med_ai_assistant_1.0_bs_vue/src/components/patient/DrgAnalysis.vue)
- [DRG分析API接口.md](file://med_ai_assistant_1.0_bs_backend/doc/系统结构/DRG分析/DRG分析API接口.md)
- [MccScreeningService.java](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/service/MccScreeningService.java)
- [MccCandidate.java](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/model/MccCandidate.java)
- [PromptTemplates.vue](file://med_ai_assistant_1.0_bs_vue/src/components/ai/PromptTemplates.vue)
- [PromptTemplateEditDialog.vue](file://med_ai_assistant_1.0_bs_vue/src/components/ai/PromptTemplateEditDialog.vue)
- [PromptList.vue](file://med_ai_assistant_1.0_bs_vue/src/components/ai/PromptList.vue)
- [PromptExecutor.vue](file://med_ai_assistant_1.0_bs_vue/src/components/server/PromptExecutor.vue)
- [promptUtils.js](file://med_ai_assistant_1.0_bs_vue/src/utils/promptUtils.js)
- [TopMenu.vue](file://med_ai_assistant_1.0_bs_vue/src/components/TopMenu.vue)
- [监护仪呼吸机AI OCR数据采集方案.md](file://med_ai_assistant_1.0_bs_backend/doc/迭代/AI OCR数据采集/监护仪呼吸机AI OCR数据采集方案.md)
</cite>

## 更新摘要
**变更内容**
- 新增MCC（主要并发症和合并症）分析功能模块，包括完整的后端控制器、服务层、模型类和前端组件
- 新增MCC分析Prompt生成保存接口：POST /api/drg/mcc/generate-prompt
- 前端MCC预筛选使用真实患者数据，修复硬编码测试数据问题
- MCC筛查结果按相似度降序排列，显示诊断编码、名称、MCC/CC类型
- 修复14个API路径重复'/api/'问题，统一API调用规范
- 修复MCC候选列表字段映射，使用mccCode/mccName替代diagnosisCode/diagnosisName
- 新增MCC预筛选服务层，支持相似度计算、排除规则检查、TopK筛选等功能

## 目录
1. [简介](#简介)
2. [项目结构](#项目结构)
3. [核心组件](#核心组件)
4. [架构总览](#架构总览)
5. [详细组件分析](#详细组件分析)
6. [依赖关系分析](#依赖关系分析)
7. [性能考虑](#性能考虑)
8. [故障排查指南](#故障排查指南)
9. [结论](#结论)
10. [附录](#附录)

## 简介
本文件面向AI诊断辅助系统，系统采用"主服务器 + 执行服务器"的双层架构：主服务器负责业务编排、数据聚合与对外API，执行服务器专注于高时延LLM调用与加密处理。系统通过专用RestTemplate优化LLM超时配置、实现指数退避重试、完善错误分类与恢复策略，并提供性能监控与统计接口，确保在复杂医疗文本分析场景下的稳定性与可靠性。

**最新更新** 新增MCC（主要并发症和合并症）分析功能模块，包括完整的后端控制器、服务层、模型类和前端组件。新增MCC分析Prompt生成保存接口，支持根据病人ID和MCC筛选结果生成并保存Prompt到数据库。前端MCC预筛选使用真实患者数据，修复硬编码测试数据问题，MCC筛查结果按相似度降序排列，显示诊断编码、名称、MCC/CC类型。修复14个API路径重复'/api/'问题，统一API调用规范，修复MCC候选列表字段映射问题。

## 项目结构
项目采用多模块/多文档组织方式，核心后端位于 `med_ai_assistant_1.0_bs_backend` 目录，前端位于 `med_ai_assistant_1.0_bs_vue` 目录，包含：
- 配置与控制器：AI模型配置类、执行服务器控制器、MCC筛查控制器等
- 前端AI服务：aiService.js提供统一的AI服务调用接口，drg.js提供DRG/MCC分析API
- 模板管理：PromptTemplates.vue、PromptTemplateEditDialog.vue等模板管理组件
- MCC分析模块：完整的MCC预筛选、相似度计算、Prompt生成功能
- 文档：API文档、架构图、性能优化与问题分析报告
- 部署与测试：部署说明、自动化构建配置、测试脚本等
- **AI OCR数据采集**：监护仪呼吸机AI OCR数据采集完整技术方案

```mermaid
graph TB
subgraph "后端服务"
Main["主服务器<br/>业务编排与对外API"]
Exec["执行服务器<br/>LLM调用与加密处理"]
MCC["MCC分析服务<br/>预筛选与Prompt生成"]
OCRAPI["OCR数据采集服务<br/>设备屏幕识别与数据处理"]
end
subgraph "前端应用"
VueApp["Vue.js 应用<br/>AI对话界面"]
AIService["AI服务模块<br/>aiService.js"]
DRGAPI["DRG/MCC分析API<br/>drg.js"]
PromptTemplates["模板管理组件<br/>PromptTemplates.vue"]
PromptEditor["模板编辑对话框<br/>PromptTemplateEditDialog.vue"]
TopMenu["顶部菜单组件<br/>TopMenu.vue"]
OCRDash["OCR数据看板<br/>实时监控界面"]
DrgAnalysis["DRG分析组件<br/>DrgAnalysis.vue"]
end
subgraph "外部系统"
LLM["LLM服务"]
DB[("数据库")]
OCRDB[("OCR数据库")]
MCCDB[("MCC字典库")]
EndDevice[("医疗设备")]
end
VueApp --> AIService
AIService --> Main
DRGAPI --> Main
Main --> Exec
Main --> MCC
Main --> OCRAPI
Exec --> LLM
Main --> DB
MCC --> MCCDB
Exec --> DB
OCRAPI --> OCRDB
OCRAPI --> EndDevice
DrgAnalysis --> DRGAPI
PromptTemplates --> AIService
PromptEditor --> AIService
TopMenu --> AIService
OCRDash --> Main
```

**图表来源**
- [执行服务器LLM调用优化敏捷迭代规划.md:140-161](file://med_ai_assistant_1.0_bs_backend/doc/其他/执行服务器LLM调用优化敏捷迭代规划.md#L140-L161)
- [API文档.md:192-493](file://med_ai_assistant_1.0_bs_backend/doc/其他/API_DOCUMENTATION.md#L192-L493)
- [MccScreeningController.java:33-35](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/MccScreeningController.java#L33-L35)
- [监护仪呼吸机AI OCR数据采集方案.md:375-416](file://med_ai_assistant_1.0_bs_backend/doc/迭代/AI OCR数据采集/监护仪呼吸机AI OCR数据采集方案.md#L375-L416)

**章节来源**
- [执行服务器LLM调用优化敏捷迭代规划.md:1-136](file://med_ai_assistant_1.0_bs_backend/doc/其他/执行服务器LLM调用优化敏捷迭代规划.md#L1-L136)
- [API文档.md:1-100](file://med_ai_assistant_1.0_bs_backend/doc/其他/API_DOCUMENTATION.md#L1-L100)

## 核心组件
- AI模型配置类：统一管理多个AI模型的端点、密钥、超时与重试参数，提供配置校验与默认模型选择。
- 执行服务器控制器：负责接收加密Prompt、解密、调用LLM、加密结果、异步回调与性能统计。
- 专用RestTemplate：针对LLM调用优化连接池、超时与请求配置，降低超时与连接耗尽风险。
- 响应缓存：对相同Prompt进行缓存，减少重复LLM调用，提升吞吐与稳定性。
- 错误分类与恢复：区分网络超时、服务端错误与未知异常，结合指数退避重试与告警机制。
- **MCC分析控制器**：提供完整的MCC预筛选、相似度计算、配置管理、Prompt生成保存等REST API接口。
- **MCC筛查服务**：实现相似度计算、排除规则检查、TopK筛选、字典缓存等核心算法。
- **MCC候选模型**：封装MCC候选结果的数据结构，包含编码、名称、类型、相似度等字段。
- **前端DRG/MCC分析API**：提供统一的DRG和MCC分析API调用接口，支持Promise和回调两种模式。
- **DRG分析组件**：集成MCC预筛选功能的完整分析界面，支持平铺和分组视图。
- **前端AI服务模块**：提供统一的AI服务调用接口，支持Promise和回调两种模式，优化非流式响应处理时序。
- **模板管理组件**：提供Prompt模板的树形展示、编辑、删除等功能，支持补充信息输入对话框。
- **模板编辑对话框**：支持模板的创建、编辑、删除操作，包含完整的表单验证和数据管理。
- **顶部菜单组件**：支持触屏/桌面设备差异化交互，修复Android平板上的菜单点击问题。
- **AI OCR数据采集系统**：实现医疗设备屏幕的自动OCR识别和数据数字化处理，支持多品牌设备的参数提取。

**最新更新** 新增MCC分析功能模块，包括MCC筛查控制器、服务层、模型类和前端组件。修复14个API路径重复'/api/'问题，统一API调用规范。前端MCC预筛选使用真实患者数据，MCC筛查结果按相似度降序排列。

**章节来源**
- [AI模型配置类.java:29-398](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/config/AIModelConfig.java#L29-L398)
- [执行服务器控制器.java:84-403](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/ExecutionServerController.java#L84-L403)
- [MccScreeningController.java:25-57](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/MccScreeningController.java#L25-L57)
- [MccScreeningService.java:23-91](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/service/MccScreeningService.java#L23-L91)
- [MccCandidate.java:6-86](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/model/MccCandidate.java#L6-L86)
- [drg.js:17-156](file://med_ai_assistant_1.0_bs_vue/src/api/drg.js#L17-L156)
- [DrgAnalysis.vue:69-181](file://med_ai_assistant_1.0_bs_vue/src/components/patient/DrgAnalysis.vue#L69-L181)
- [执行服务器LLM调用优化敏捷迭代规划.md:139-225](file://med_ai_assistant_1.0_bs_backend/doc/其他/执行服务器LLM调用优化敏捷迭代规划.md#L139-L225)
- [aiService.js:1-280](file://med_ai_assistant_1.0_bs_vue/src/api/aiService.js#L1-L280)
- [PromptTemplates.vue:26-31](file://med_ai_assistant_1.0_bs_vue/src/components/ai/PromptTemplates.vue#L26-L31)
- [PromptTemplateEditDialog.vue:144-453](file://med_ai_assistant_1.0_bs_vue/src/components/ai/PromptTemplateEditDialog.vue#L144-L453)
- [TopMenu.vue:314-326](file://med_ai_assistant_1.0_bs_vue/src/components/TopMenu.vue#L314-L326)
- [监护仪呼吸机AI OCR数据采集方案.md:1-800](file://med_ai_assistant_1.0_bs_backend/doc/迭代/AI OCR数据采集/监护仪呼吸机AI OCR数据采集方案.md#L1-L800)

## 架构总览
系统采用"主服务器 + 执行服务器"协作模式：
- 主服务器：聚合患者数据、生成Prompt、调度执行服务器、提供对外API。
- 执行服务器：专注LLM调用与加密处理，支持轮询模式与回调机制，具备完善的监控与统计。
- **MCC分析模块**：独立的MCC预筛选服务，提供相似度计算、排除规则检查、TopK筛选等功能。
- **前端应用**：通过AI服务模块统一调用后端AI接口，提供用户友好的对话界面和模板管理功能。
- **AI OCR数据采集系统**：独立的OCR识别服务，专门处理医疗设备屏幕数据的自动采集和数字化，与主系统通过REST API和WebSocket集成。

```mermaid
graph TB
A["主服务器"] --> B["执行服务器"]
A --> C["OCR数据采集服务"]
A --> D["MCC分析服务"]
B --> E["LLM服务"]
A --> F["数据库"]
B --> F
C --> G["OCR数据库"]
C --> H["医疗设备"]
D --> I["MCC字典库"]
B --> J["回调服务"]
A --> K["对外API"]
K --> A
subgraph "前端应用"
L["Vue.js 应用"]
M["AI服务模块"]
N["DRG/MCC分析API"]
O["对话界面组件"]
P["模板管理组件"]
Q["顶部菜单组件"]
R["OCR数据看板"]
S["DRG分析组件"]
end
L --> M
L --> N
N --> K
M --> K
O --> L
P --> M
Q --> L
R --> L
S --> N
```

**图表来源**
- [执行服务器LLM调用优化敏捷迭代规划.md:141-161](file://med_ai_assistant_1.0_bs_backend/doc/其他/执行服务器LLM调用优化敏捷迭代规划.md#L141-L161)
- [API文档.md:192-493](file://med_ai_assistant_1.0_bs_backend/doc/其他/API_DOCUMENTATION.md#L192-L493)
- [MccScreeningController.java:33-35](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/MccScreeningController.java#L33-L35)
- [监护仪呼吸机AI OCR数据采集方案.md:375-416](file://med_ai_assistant_1.0_bs_backend/doc/迭代/AI OCR数据采集/监护仪呼吸机AI OCR数据采集方案.md#L375-L416)

## 详细组件分析

### AI模型配置组件
- 设计要点
  - 以模型名为键的配置映射，支持多模型并行
  - 每个模型包含URL、密钥、连接/读取超时、最大重试次数、初始重试延迟
  - 提供配置有效性校验、默认模型选择与安全摘要
- 关键接口
  - 获取模型配置：按模型名检索
  - 校验配置：URL格式、必填字段完整性
  - 默认模型：优先返回常用模型，否则返回首个有效配置

```mermaid
classDiagram
class AIModelConfig {
-boolean stream
-Map~String, ModelConfig~ models
+isStream() boolean
+getModels() Map
+getModelConfig(name) ModelConfig
+getDefaultModelConfig() Optional
+isValidModelConfig(name) boolean
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
+getMaxRetries() int
+getRetryDelay() long
+getConnectTimeout() long
+getReadTimeout() long
+isValid() boolean
+hasValidUrl() boolean
+getSummary() String
+getSecureSummary() String
}
AIModelConfig --> ModelConfig : "包含"
```

**图表来源**
- [AI模型配置类.java:29-398](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/config/AIModelConfig.java#L29-L398)

**章节来源**
- [AI模型配置类.java:29-398](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/config/AIModelConfig.java#L29-L398)

### 执行服务器控制器（LLM调用与处理）
- 设计要点
  - 专用RestTemplate：连接池、超时与Keep-Alive策略优化
  - LLM调用：集成重试机制（指数退避+抖动），错误分类与恢复
  - 数据处理：解密 -> Prompt分析 -> 加密 -> 回调
  - 监控统计：调用次数、成功率、响应时间分布、重试统计
- 关键流程

```mermaid
sequenceDiagram
participant Client as "主服务器"
participant Exec as "执行服务器"
participant LLM as "LLM服务"
participant Cache as "响应缓存"
participant AES as "AES加密"
Client->>Exec : "加密Prompt请求"
Exec->>Exec : "解密Prompt"
Exec->>Cache : "查询缓存"
alt "缓存命中"
Cache-->>Exec : "返回缓存结果"
else "缓存未命中"
Exec->>LLM : "调用LLM服务"
LLM-->>Exec : "LLM响应"
Exec->>Exec : "指数退避重试如失败"
end
Exec->>AES : "加密处理结果"
AES-->>Exec : "加密结果"
Exec-->>Client : "返回加密结果"
Exec->>Exec : "异步回调可选"
```

**图表来源**
- [执行服务器控制器.java:400-470](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/ExecutionServerController.java#L400-L470)
- [执行服务器控制器.java:781-884](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/ExecutionServerController.java#L781-L884)
- [执行服务器LLM调用优化敏捷迭代规划.md:229-281](file://med_ai_assistant_1.0_bs_backend/doc/其他/执行服务器LLM调用优化敏捷迭代规划.md#L229-L281)

**章节来源**
- [执行服务器控制器.java:400-470](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/ExecutionServerController.java#L400-L470)
- [执行服务器控制器.java:781-884](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/ExecutionServerController.java#L781-L884)
- [执行服务器LLM调用优化敏捷迭代规划.md:229-281](file://med_ai_assistant_1.0_bs_backend/doc/其他/执行服务器LLM调用优化敏捷迭代规划.md#L229-L281)

### MCC分析控制器（完整MCC功能）
- 设计要点
  - 提供完整的MCC预筛选REST API接口
  - 支持平铺列表和分组视图两种展示模式
  - 实现相似度计算、排除规则检查、TopK筛选
  - 提供MCC分析Prompt生成保存功能
- 关键接口
  - 筛选MCC候选：POST /api/drg/mcc/screen
  - 分组MCC候选：POST /api/drg/mcc/screen-grouped
  - 相似度计算：POST /api/drg/mcc/similarity
  - 获取配置：GET /api/drg/mcc/config
  - 重新加载字典：POST /api/drg/mcc/reload
  - 生成并保存Prompt：POST /api/drg/mcc/generate-prompt

```mermaid
classDiagram
class MccScreeningController {
+screenMccCandidates(request) ResponseEntity
+screenMccCandidatesGrouped(request) ResponseEntity
+calculateSimilarity(request) ResponseEntity
+getMccConfig() ResponseEntity
+reloadMccDictionary() ResponseEntity
+generateMccPrompt(request) ResponseEntity
}
class MccScreeningService {
+screenMccCandidates(diagnoses) List
+screenMccCandidatesGrouped(diagnoses) Map
+calculateSimilarity(diagnosis, mccName) double
+reloadDictionary() void
}
class MccCandidate {
-string mccCode
-string mccName
-string mccType
-double similarity
-string matchType
-Boolean excluded
}
MccScreeningController --> MccScreeningService : "调用"
MccScreeningService --> MccCandidate : "创建"
```

**图表来源**
- [MccScreeningController.java:59-162](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/MccScreeningController.java#L59-L162)
- [MccScreeningService.java:101-200](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/service/MccScreeningService.java#L101-L200)
- [MccCandidate.java:13-86](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/model/MccCandidate.java#L13-L86)

**章节来源**
- [MccScreeningController.java:59-162](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/MccScreeningController.java#L59-L162)
- [MccScreeningController.java:233-341](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/MccScreeningController.java#L233-L341)
- [DRG分析接口.md:1809-1851](file://med_ai_assistant_1.0_bs_backend/doc/接口/DRG分析接口.md#L1809-L1851)

### MCC筛查服务（核心算法）
- 设计要点
  - 使用Levenshtein距离算法计算诊断名称相似度
  - 支持编码精确匹配和名称相似度匹配两种模式
  - 实现排除规则检查，基于MCC_EXCEPT字段排除不适用的候选
  - 提供TopK筛选功能，限制每个诊断的候选数量
  - 使用原子引用实现线程安全的字典缓存
- 关键算法
  - 相似度计算：normalize(diagnosis) vs normalize(mccName)
  - 排除规则：检查MCC_EXCEPT字段中的ICD编码列表
  - TopK筛选：按相似度降序排列，取前K个候选
  - 编码匹配：ICD编码完全相等时的精确匹配

```mermaid
flowchart TD
Start(["开始MCC筛查"]) --> LoadDict["加载MCC字典缓存"]
LoadDict --> CheckCache{"字典缓存有效？"}
CheckCache --> |否| ReloadDict["重新加载字典"]
CheckCache --> |是| ProcessDiagnoses["处理患者诊断列表"]
ReloadDict --> ProcessDiagnoses
ProcessDiagnoses --> ExactMatch["尝试编码精确匹配"]
ExactMatch --> SimilarityCalc["计算名称相似度"]
SimilarityCalc --> ThresholdCheck{"相似度>阈值？"}
ThresholdCheck --> |是| ExcludeCheck["检查排除规则"]
ThresholdCheck --> |否| NextDiagnosis["下一个诊断"]
ExcludeCheck --> |是| NextDiagnosis
ExcludeCheck --> |否| AddCandidate["添加候选结果"]
AddCandidate --> NextDiagnosis
NextDiagnosis --> TopKCheck{"启用TopK？"}
TopKCheck --> |是| ApplyTopK["按诊断分组TopK筛选"]
TopKCheck --> |否| SortResults["按相似度降序排序"]
ApplyTopK --> SortResults
SortResults --> End(["返回MCC候选列表"])
```

**图表来源**
- [MccScreeningService.java:121-200](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/service/MccScreeningService.java#L121-L200)
- [MccScreeningService.java:177-200](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/service/MccScreeningService.java#L177-L200)

**章节来源**
- [MccScreeningService.java:121-200](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/service/MccScreeningService.java#L121-L200)
- [MccScreeningService.java:177-200](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/service/MccScreeningService.java#L177-L200)

### 前端DRG/MCC分析API（统一接口）
- 设计要点
  - 提供统一的DRG和MCC分析API调用接口
  - 支持Promise和回调两种模式，向后兼容
  - 修复14个API路径重复'/api/'问题，统一调用规范
  - 新增MCC分析Prompt生成保存接口
- 关键接口
  - MCC候选筛选：screenMccCandidates(diagnoses)
  - 分组MCC候选：screenMccCandidatesGrouped(diagnoses)
  - 相似度计算：calculateSimilarity(diagnosis, mccName)
  - 获取配置：getMccConfig()
  - 重新加载字典：reloadMccDictionary()
  - 生成并保存Prompt：generateMccPrompt(patientId, mccResults)

```mermaid
sequenceDiagram
participant VueComp as "Vue组件"
participant DRGAPI as "DRG/MCC API模块"
participant Backend as "后端MCC接口"
participant MCCService as "MCC服务层"
VueComp->>DRGAPI : "generateMccPrompt(patientId, mccResults)"
DRGAPI->>Backend : "POST /drg/mcc/generate-prompt"
Backend->>MCCService : "调用MCC服务"
MCCService->>MCCService : "参数校验"
MCCService->>MCCService : "查询病人信息"
MCCService->>MCCService : "获取Prompt模板"
MCCService->>MCCService : "构建完整Prompt"
MCCService->>MCCService : "保存到数据库"
MCCService-->>Backend : "返回Prompt ID"
Backend-->>DRGAPI : "JSON响应"
DRGAPI-->>VueComp : "Promise resolve"
```

**图表来源**
- [drg.js:154-156](file://med_ai_assistant_1.0_bs_vue/src/api/drg.js#L154-L156)
- [MccScreeningController.java:233-341](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/MccScreeningController.java#L233-L341)

**章节来源**
- [drg.js:154-156](file://med_ai_assistant_1.0_bs_vue/src/api/drg.js#L154-L156)
- [DRG分析接口.md:1809-1851](file://med_ai_assistant_1.0_bs_backend/doc/接口/DRG分析接口.md#L1809-L1851)

### DRG分析组件（MCC预筛选集成）
- 设计要点
  - 集成MCC预筛选功能的完整分析界面
  - 支持平铺视图和分组视图两种展示模式
  - 使用真实患者数据替代硬编码测试数据
  - MCC筛查结果按相似度降序排列
  - 修复MCC候选列表字段映射问题
- 关键特性
  - 视图切换：平铺视图 vs 分组视图
  - 数据展示：诊断编码、名称、MCC/CC类型、相似度
  - 操作功能：加载MCC候选、生成Prompt、复制Prompt内容
  - 状态管理：加载状态、错误处理、数据刷新

```mermaid
sequenceDiagram
participant User as "用户"
participant DrgAnalysis as "DRG分析组件"
participant DRGAPI as "DRG/MCC API模块"
User->>DrgAnalysis : "点击加载MCC候选"
DrgAnalysis->>DRGAPI : "screenMccCandidates(diagnoses)"
DRGAPI-->>DrgAnalysis : "返回MCC候选列表"
DrgAnalysis->>DrgAnalysis : "按相似度降序排序"
DrgAnalysis->>DrgAnalysis : "更新视图状态"
DrgAnalysis-->>User : "显示MCC候选结果"
User->>DrgAnalysis : "点击生成Prompt"
DrgAnalysis->>DRGAPI : "generateMccPrompt(patientId, mccResults)"
DRGAPI-->>DrgAnalysis : "返回Prompt ID"
DrgAnalysis->>DrgAnalysis : "显示Prompt对话框"
```

**图表来源**
- [DrgAnalysis.vue:72-96](file://med_ai_assistant_1.0_bs_vue/src/components/patient/DrgAnalysis.vue#L72-L96)
- [DrgAnalysis.vue:109-127](file://med_ai_assistant_1.0_bs_vue/src/components/patient/DrgAnalysis.vue#L109-L127)

**章节来源**
- [DrgAnalysis.vue:72-96](file://med_ai_assistant_1.0_bs_vue/src/components/patient/DrgAnalysis.vue#L72-L96)
- [DrgAnalysis.vue:109-127](file://med_ai_assistant_1.0_bs_vue/src/components/patient/DrgAnalysis.vue#L109-L127)

### 前端AI服务模块（时序优化）
- 设计要点
  - 提供统一的AI服务调用接口，支持Promise和回调两种模式
  - 优化非流式响应处理时序，确保UI能够及时接收数据
  - 完善错误处理机制，支持字符串和对象形式的错误信息
  - 保留方法名向后兼容性，实际采用非流式请求模式
- 关键流程

```mermaid
sequenceDiagram
participant VueComp as "Vue组件"
participant AIService as "AI服务模块"
participant Backend as "后端AI接口"
participant LLM as "LLM服务"
VueComp->>AIService : "getAIResponseStream()"
AIService->>Backend : "POST /api/ai/response"
Backend->>LLM : "调用LLM服务"
LLM-->>Backend : "LLM响应"
Backend-->>AIService : "JSON响应"
Note over AIService : 非流式响应：一次性返回完整内容
AIService->>VueComp : "onData回调先调用"
AIService-->>VueComp : "Promise resolve后完成"
```

**最新更新** 修复了非流式响应模式下的回调时序问题，确保UI能够在Promise resolve之前接收到数据。

**图表来源**
- [aiService.js:110-170](file://med_ai_assistant_1.0_bs_vue/src/api/aiService.js#L110-L170)
- [aiService.js:229-279](file://med_ai_assistant_1.0_bs_vue/src/api/aiService.js#L229-L279)

**章节来源**
- [aiService.js:110-170](file://med_ai_assistant_1.0_bs_vue/src/api/aiService.js#L110-L170)
- [aiService.js:229-279](file://med_ai_assistant_1.0_bs_vue/src/api/aiService.js#L229-L279)

### 模板管理组件（补充信息输入功能）
- 设计要点
  - 支持Prompt模板的树形展示和分类管理
  - 新增补充信息输入对话框功能，针对特定模板提供额外上下文
  - 动态处理用户输入的补充信息，将其注入到执行选项中
  - 完善用户交互体验，提供灵活的上下文信息收集
- 关键特性
  - 模板常量定义：`TEMPLATES_REQUIRING_ADDITIONAL_INFO = ['请会诊记录', '日常对话']`
  - 弹窗输入：使用Element Plus的MessageBox.prompt组件
  - 信息处理：将补充信息格式化为`AdditionalInfo`字段
  - 状态管理：支持跳过输入和关闭对话框的操作

```mermaid
sequenceDiagram
participant User as "用户"
participant TemplateComp as "模板组件"
participant MessageBox as "消息框组件"
participant Utils as "promptUtils"
User->>TemplateComp : "点击模板执行"
TemplateComp->>TemplateComp : "检查是否需要补充信息"
alt "需要补充信息"
TemplateComp->>MessageBox : "显示输入对话框"
MessageBox-->>TemplateComp : "用户输入或取消"
TemplateComp->>TemplateComp : "格式化补充信息"
TemplateComp->>Utils : "执行Prompt"
else "不需要补充信息"
TemplateComp->>Utils : "直接执行Prompt"
end
Utils-->>User : "显示执行结果"
```

**最新更新** 新增补充信息输入对话框功能，显著提升了用户在使用特定模板时的上下文信息提供能力。

**图表来源**
- [PromptTemplates.vue:106-131](file://med_ai_assistant_1.0_bs_vue/src/components/ai/PromptTemplates.vue#L106-L131)
- [PromptTemplates.vue:149-152](file://med_ai_assistant_1.0_bs_vue/src/components/ai/PromptTemplates.vue#L149-L152)

**章节来源**
- [PromptTemplates.vue:26-31](file://med_ai_assistant_1.0_bs_vue/src/components/ai/PromptTemplates.vue#L26-L31)
- [PromptTemplates.vue:86-174](file://med_ai_assistant_1.0_bs_vue/src/components/ai/PromptTemplates.vue#L86-L174)

### 模板编辑对话框（完整管理功能）
- 设计要点
  - 提供完整的模板编辑界面，支持创建、编辑、删除操作
  - 包含多标签页的表单结构，支持不同类型的模板配置
  - 集成数据类型、过滤规则、作用范围等高级配置选项
  - 实现模板树形结构的可视化展示和管理
- 关键功能
  - 模板树形展示：支持模板类型分组和层级管理
  - 表单验证：完整的字段验证和错误处理机制
  - 数据同步：实时刷新模板列表和状态管理
  - 权限控制：根据用户权限显示不同的操作选项

**章节来源**
- [PromptTemplateEditDialog.vue:144-453](file://med_ai_assistant_1.0_bs_vue/src/components/ai/PromptTemplateEditDialog.vue#L144-L453)

### 顶部菜单组件（触屏/桌面差异化交互）
- 设计要点
  - 检测设备是否支持触摸功能，智能区分触屏和桌面设备
  - 触屏设备：AI辅助子菜单点击时不触发导航，让子菜单自然展开/收起
  - 桌面设备：AI辅助子菜单点击时直接导航到AI辅助页面
  - 支持小屏模式切换，适配7-8英寸设备
- 关键特性
  - 设备检测：`'ontouchstart' in window || navigator.maxTouchPoints > 0`
  - 事件处理：根据设备类型执行不同的菜单交互逻辑
  - 用户体验：避免Android平板上的菜单点击问题

```mermaid
sequenceDiagram
participant User as "用户"
participant TopMenu as "顶部菜单组件"
participant Event as "点击事件"
User->>TopMenu : "点击AI辅助菜单"
TopMenu->>TopMenu : "检测设备类型"
alt "触屏设备"
TopMenu->>Event : "阻止默认导航"
Event-->>User : "子菜单自然展开/收起"
else "桌面设备"
TopMenu->>TopMenu : "执行导航到AI辅助页面"
TopMenu-->>User : "页面跳转"
end
```

**最新更新** 新增触屏/桌面设备差异化交互逻辑，修复Android平板上的菜单点击问题。

**图表来源**
- [TopMenu.vue:314-326](file://med_ai_assistant_1.0_bs_vue/src/components/TopMenu.vue#L314-L326)

**章节来源**
- [TopMenu.vue:314-326](file://med_ai_assistant_1.0_bs_vue/src/components/TopMenu.vue#L314-L326)

### AI OCR数据采集系统
- 设计要点
  - 独立的OCR识别服务，专门处理医疗设备屏幕数据
  - 支持多品牌医疗设备（监护仪、呼吸机、输液泵等）
  - 提供设备模板管理系统，支持自学习和社区共享
  - 实现实时数据推送和历史数据查询功能
- 关键特性
  - OCR识别：基于PaddleOCR的文字识别技术
  - 数据校验：规则引擎进行数据有效性检查
  - 报警机制：危急值自动检测和通知推送
  - 集成接口：与主系统通过REST API和WebSocket集成

```mermaid
sequenceDiagram
participant Device as "医疗设备"
participant Camera as "摄像头"
participant Edge as "边缘计算设备"
participant OCR as "OCR识别引擎"
participant Service as "OCR服务端"
participant Main as "主系统"
Device->>Camera : "屏幕显示数据"
Camera->>Edge : "图像采集"
Edge->>Edge : "图像预处理"
Edge->>OCR : "OCR识别"
OCR-->>Edge : "识别结果"
Edge->>Edge : "参数解析和校验"
Edge->>Service : "上报结构化数据"
Service->>Service : "服务端校验"
Service->>Main : "WebSocket推送"
Main-->>Main : "UI实时更新"
```

**最新更新** 新增完整的AI OCR数据采集系统，支持医疗设备屏幕的自动识别和数据数字化。

**图表来源**
- [监护仪呼吸机AI OCR数据采集方案.md:417-454](file://med_ai_assistant_1.0_bs_backend/doc/迭代/AI OCR数据采集/监护仪呼吸机AI OCR数据采集方案.md#L417-L454)

**章节来源**
- [监护仪呼吸机AI OCR数据采集方案.md:1-800](file://med_ai_assistant_1.0_bs_backend/doc/迭代/AI OCR数据采集/监护仪呼吸机AI OCR数据采集方案.md#L1-L800)

### 数据预处理与结果后处理
- 预处理
  - 解密：从数据库读取AES密钥与盐值，解密Base64加密的Prompt
  - 缓存：基于Prompt内容生成缓存键，命中则直接返回
  - 补充信息：处理用户提供的额外上下文信息
- 推理过程
  - 调用LLM服务，支持流式与非流式响应
  - 指数退避重试，避免网络波动与服务异常导致的失败
- 后处理
  - 加密：将LLM结果进行AES加密
  - 回调：异步通知主服务器处理完成
  - 统计：记录调用次数、成功率、响应时间与错误类型

```mermaid
flowchart TD
Start(["开始"]) --> Decrypt["解密加密Prompt"]
Decrypt --> CacheCheck{"缓存命中？"}
CacheCheck --> |是| ReturnCache["返回缓存结果"]
CacheCheck --> |否| AddContext["添加补充信息"]
AddContext --> CallLLM["调用LLM服务"]
CallLLM --> Retry{"调用成功？"}
Retry --> |否| ExponentialBackoff["指数退避重试"]
ExponentialBackoff --> Retry
Retry --> |是| Encrypt["AES加密结果"]
Encrypt --> Callback["异步回调可选"]
Callback --> Stats["更新统计"]
ReturnCache --> Stats
```

**图表来源**
- [执行服务器控制器.java:781-884](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/ExecutionServerController.java#L781-L884)
- [执行服务器LLM调用优化敏捷迭代规划.md:229-281](file://med_ai_assistant_1.0_bs_backend/doc/其他/执行服务器LLM调用优化敏捷迭代规划.md#L229-L281)

**章节来源**
- [执行服务器控制器.java:781-884](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/ExecutionServerController.java#L781-L884)

### API与调用方式
- AI分析服务
  - 获取患者综合信息：聚合基本信息、诊断、病历、长期/临时医嘱、化验与检查结果
  - 保存对话历史：记录用户与AI的交互
  - 流式AI响应：SSE流式返回，支持心跳与错误事件
  - 非流式AI响应：一次性返回推理过程与最终结果
  - AI参数：支持温度、最大token、top_p、频率惩罚、存在惩罚、生成数量、停止符、用户标识等
  - 健康检查：检查AI模型服务状态
- **MCC分析服务**
  - MCC候选筛选：POST /api/drg/mcc/screen，支持平铺和分组两种模式
  - 相似度计算：POST /api/drg/mcc/similarity，返回相似度值和阈值检查结果
  - 配置管理：GET /api/drg/mcc/config，获取相似度阈值、TopK设置等
  - 字典管理：POST /api/drg/mcc/reload，重新加载MCC字典
  - Prompt生成：POST /api/drg/mcc/generate-prompt，生成并保存MCC分析Prompt
- 调用示例
  - 流式调用：POST `/api/ai/stream-response-post`，Content-Type: application/json
  - 非流式调用：POST `/api/ai/response`，请求体包含model与messages
  - 健康检查：GET `/api/health/ai-status`
  - MCC候选筛选：POST `/api/drg/mcc/screen`，请求体包含患者诊断列表
  - 生成Prompt：POST `/api/drg/mcc/generate-prompt`，请求体包含patientId和mccResults
- **模板管理API**
  - 获取模板列表：GET `/api/ai/promptTemplates`
  - 获取模板详情：GET `/api/ai/promptTemplate`
  - 创建模板：POST `/api/ai/prompt-templates`
  - 更新模板：PUT `/api/ai/prompt-templates/{templateId}`
  - 删除模板：DELETE `/api/ai/prompt-templates/{templateId}`
- **OCR数据采集API**
  - 设备注册：POST `/api/ocr/devices`
  - 数据上报：POST `/api/ocr/data`
  - 模板管理：GET/POST/PUT `/api/ocr/templates`
  - 实时数据：GET `/api/ocr/live-data`

**最新更新** 新增MCC分析服务的完整API接口，包括候选筛选、相似度计算、配置管理、字典管理和Prompt生成保存功能。修复14个API路径重复'/api/'问题，统一API调用规范。

**章节来源**
- [API文档.md:192-493](file://med_ai_assistant_1.0_bs_backend/doc/其他/API_DOCUMENTATION.md#L192-L493)
- [API文档.md:494-590](file://med_ai_assistant_1.0_bs_backend/doc/其他/API_DOCUMENTATION.md#L494-L590)
- [DRG分析接口.md:1809-1851](file://med_ai_assistant_1.0_bs_backend/doc/接口/DRG分析接口.md#L1809-L1851)
- [DRG分析API接口.md:25-35](file://med_ai_assistant_1.0_bs_backend/doc/系统结构/DRG分析/DRG分析API接口.md#L25-L35)

## 依赖关系分析
- 组件耦合
  - 执行服务器控制器依赖AI模型配置类、专用RestTemplate、加密工具与回调服务
  - MCC分析控制器依赖MCC筛查服务、患者Repository、Prompt Repository、Prompt模板Repository
  - MCC筛查服务依赖Levenshtein工具、文本规范化工具、MCC配置属性、MCC字典Repository
  - 与数据库交互通过执行服务器专用数据源与临时表Repository
  - **前端DRG/MCC分析API**依赖Vue.js组件和后端MCC接口
  - **前端AI服务模块**依赖Vue.js组件和后端AI接口
  - **模板管理组件**依赖Element Plus UI组件和promptUtils工具
  - **顶部菜单组件**依赖设备检测逻辑和路由导航
  - **OCR数据采集系统**独立部署，通过API与主系统集成
- 外部依赖
  - LLM服务：通过RestTemplate调用，需配置URL与密钥
  - 数据库：存储加密临时数据、配置与回调记录
  - Element Plus：提供UI组件和对话框功能
  - PaddleOCR：提供医疗设备屏幕的OCR识别能力
  - **MCC字典库**：存储MCC诊断编码、名称、类型、排除规则等数据
- 潜在风险
  - LLM服务不稳定：通过熔断器与重试缓解
  - 连接池耗尽：通过专用连接池与超时配置控制
  - 配置冲突：通过隔离配置与向后兼容策略解决
  - **MCC字典缓存失效**：通过原子引用和热重载机制保证数据一致性
  - **相似度计算性能**：通过文本规范化缓存和字典预加载优化
  - **UI显示时序问题**：通过优化回调时序解决非流式响应显示问题
  - **模板执行异常**：通过补充信息输入验证和错误处理机制解决
  - **设备兼容性问题**：通过触屏/桌面差异化交互解决Android平板菜单问题
  - **OCR识别准确性**：通过模板管理和规则引擎保证数据质量

```mermaid
graph TB
Controller["执行服务器控制器"] --> Config["AI模型配置类"]
Controller --> RestTemplate["专用RestTemplate"]
Controller --> AES["AES加密工具"]
Controller --> DB["执行服务器数据源"]
Controller --> Callback["异步回调服务"]
MCCController["MCC分析控制器"] --> MCCService["MCC筛查服务"]
MCCController --> PatientRepo["患者Repository"]
MCCController --> PromptRepo["Prompt Repository"]
MCCController --> TemplateRepo["Prompt模板Repository"]
MCCService --> Levenshtein["Levenshtein工具"]
MCCService --> TextNorm["文本规范化工具"]
MCCService --> Props["MCC配置属性"]
MCCService --> MCCRepo["MCC字典Repository"]
RestTemplate --> LLM["LLM服务"]
DB --> TempRepo["加密临时表Repository"]
subgraph "前端依赖"
DRGAPI["DRG/MCC分析API"] --> VueComp["Vue组件"]
DRGAPI --> BackendAPI["后端MCC接口"]
AIService["AI服务模块"] --> VueComp
AIService --> BackendAPI
VueComp --> UIComponents["UI组件"]
TemplateComp["模板管理组件"] --> ElementPlus["Element Plus"]
TemplateComp --> promptUtils["promptUtils工具"]
TemplateComp --> MessageBox["MessageBox对话框"]
TopMenu["顶部菜单组件"] --> DeviceDetect["设备检测逻辑"]
TopMenu --> Router["路由导航"]
OCRAPI["OCR数据采集API"] --> OCRService["OCR服务端"]
OCRAPI --> MainSystem["主系统集成"]
end
```

**图表来源**
- [执行服务器控制器.java:84-145](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/ExecutionServerController.java#L84-L145)
- [MccScreeningController.java:42-56](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/MccScreeningController.java#L42-L56)
- [MccScreeningService.java:33-43](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/service/MccScreeningService.java#L33-L43)
- [AI模型配置类.java:29-68](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/config/AIModelConfig.java#L29-L68)
- [aiService.js:9-178](file://med_ai_assistant_1.0_bs_vue/src/api/aiService.js#L9-L178)
- [drg.js:154-156](file://med_ai_assistant_1.0_bs_vue/src/api/drg.js#L154-L156)
- [PromptTemplates.vue:22-24](file://med_ai_assistant_1.0_bs_vue/src/components/ai/PromptTemplates.vue#L22-L24)
- [TopMenu.vue:314-326](file://med_ai_assistant_1.0_bs_vue/src/components/TopMenu.vue#L314-L326)

**章节来源**
- [执行服务器控制器.java:84-145](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/ExecutionServerController.java#L84-L145)
- [MccScreeningController.java:42-56](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/MccScreeningController.java#L42-L56)
- [MccScreeningService.java:33-43](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/service/MccScreeningService.java#L33-L43)
- [AI模型配置类.java:29-68](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/config/AIModelConfig.java#L29-L68)
- [aiService.js:9-178](file://med_ai_assistant_1.0_bs_vue/src/api/aiService.js#L9-L178)
- [drg.js:154-156](file://med_ai_assistant_1.0_bs_vue/src/api/drg.js#L154-L156)
- [PromptTemplates.vue:22-24](file://med_ai_assistant_1.0_bs_vue/src/components/ai/PromptTemplates.vue#L22-L24)
- [TopMenu.vue:314-326](file://med_ai_assistant_1.0_bs_vue/src/components/TopMenu.vue#L314-L326)

## 性能考虑
- 连接池与超时
  - 专用RestTemplate：连接超时60秒，读取超时10分钟，连接池最大50，每路由10
  - 避免默认超时导致的频繁超时与连接耗尽
- 重试策略
  - 指数退避（1秒、2秒、4秒）+ 随机抖动，避免雷群效应
  - 最多重试3次，失败后返回结构化错误信息
- 缓存与统计
  - 响应缓存：对相同Prompt复用LLM结果，降低延迟与成本
  - 性能统计：成功率、平均响应时间、错误类型分布、重试次数
- **MCC分析性能优化**
  - 字典缓存：使用AtomicReference实现线程安全的MCC字典缓存
  - 文本规范化缓存：预计算MCC名称规范化结果，提高相似度计算性能
  - 相似度计算优化：使用Levenshtein距离算法，支持文本规范化
  - TopK筛选：限制每个诊断的候选数量，减少结果集大小
  - 排除规则优化：基于MCC_EXCEPT字段的快速排除检查
- 监控与告警
  - 实时监控：调用成功率、响应时间阈值告警
  - 历史分析：每日趋势、错误模式分析，指导配置调优
- **UI性能优化**
  - **非流式响应时序优化**：确保回调在Promise resolve之前执行，避免UI显示延迟
  - **错误处理优化**：支持字符串和对象形式的错误信息，提升错误信息可读性
  - **模板执行优化**：补充信息输入对话框的异步处理，避免阻塞主界面
  - **设备适配优化**：触屏/桌面差异化交互，提升移动端用户体验
  - **MCC视图优化**：平铺视图和分组视图的性能差异对比
  - **API调用优化**：修复14个重复'/api/'前缀问题，统一API调用规范
- **模板管理性能**
  - **树形结构渲染**：优化大量模板的渲染性能
  - **表单验证**：实时验证用户输入，减少无效提交
  - **状态管理**：高效的组件状态更新和同步机制
- **OCR系统性能**
  - **边缘计算优化**：GPU加速OCR推理，提升识别速度
  - **模板匹配优化**：基于锚点特征的快速模板识别
  - **数据流优化**：异步处理和批量上传，减少网络延迟
  - **缓存策略**：本地缓存和断网续传，保证数据完整性

**最新更新** 新增MCC分析功能的性能优化措施，包括字典缓存、文本规范化缓存、相似度计算优化、TopK筛选等功能。修复14个API路径重复'/api/'问题，统一API调用规范。优化MCC视图渲染性能，支持平铺和分组两种展示模式。

**章节来源**
- [执行服务器LLM调用优化敏捷迭代规划.md:361-430](file://med_ai_assistant_1.0_bs_backend/doc/其他/执行服务器LLM调用优化敏捷迭代规划.md#L361-L430)
- [执行服务器LLM调用优化敏捷迭代规划.md:229-281](file://med_ai_assistant_1.0_bs_backend/doc/其他/执行服务器LLM调用优化敏捷迭代规划.md#L229-L281)
- [MccScreeningService.java:74-91](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/service/MccScreeningService.java#L74-L91)
- [2026-03-25更新日志.md:7-8](file://med_ai_assistant_1.0_bs/更新小结.md#L7-L8)
- [2026-03-21更新日志.md:1-21](file://med_ai_assistant_1.0_bs/更新小结.md#L1-L21)
- [监护仪呼吸机AI OCR数据采集方案.md:1340-1352](file://med_ai_assistant_1.0_bs_backend/doc/迭代/AI OCR数据采集/监护仪呼吸机AI OCR数据采集方案.md#L1340-L1352)

## 故障排查指南
- 常见问题
  - LLM调用超时：确认专用RestTemplate配置与连接池参数
  - 网络中断后连接失败：检查连接Keep-Alive与请求超时设置
  - 错误分类不准确：完善异常捕获与错误类型映射
  - **AI对话UI无内容显示**：检查非流式响应回调时序是否正确
  - **模板补充信息输入异常**：检查Element Plus对话框组件的配置和事件处理
  - **模板管理功能失效**：验证模板树形结构渲染和表单验证逻辑
  - **Android平板菜单点击问题**：检查触屏设备检测逻辑和事件处理
  - **OCR识别失败**：验证设备模板配置和图像预处理参数
  - **MCC分析失败**：检查MCC字典加载、相似度计算、排除规则检查
  - **API路径重复问题**：验证drg.js中14个API路径是否修复
  - **MCC候选字段映射错误**：检查mccCode/mccName字段映射是否正确
- 排查步骤
  - 查看LLM调用统计接口，确认成功率与响应时间
  - 检查应用配置文件中的LLM专用参数
  - 验证AI模型配置的有效性与URL可达性
  - 观察回调状态与异步处理日志
  - **检查前端AI服务模块的回调时序**：确认onData回调在Promise resolve之前执行
  - **验证模板组件的补充信息处理**：检查ElMessageBox.prompt的配置和事件监听
  - **测试模板编辑对话框功能**：确认表单验证和数据同步机制
  - **验证设备检测逻辑**：检查'ontouchstart'检测和maxTouchPoints判断
  - **测试OCR数据采集流程**：验证图像采集、OCR识别和数据上报
  - **检查OCR模板匹配**：确认设备模板配置和参数区域定位
  - **验证MCC分析流程**：检查字典加载、相似度计算、候选筛选、Prompt生成
  - **测试API路径修复**：确认drg.js中所有MCC相关API路径正确
  - **验证MCC字段映射**：检查前端视图中mccCode/mccName字段显示
- 相关文档
  - AI响应接口网络中断后连接失败问题分析与解决方案
  - 执行服务器架构简化实施报告
  - 执行服务器性能优化方案
  - **AI对话UI无内容显示问题修复说明**
  - **模板管理组件功能实现指南**
  - **Android平板菜单交互问题解决方案**
  - **AI OCR数据采集系统技术方案**
  - **MCC分析功能实现指南**

**最新更新** 新增MCC分析功能的故障排查指南，包括字典加载、相似度计算、排除规则检查、API路径修复、字段映射验证等问题的排查步骤。

**章节来源**
- [AI响应接口网络中断后连接失败问题分析与解决方案.md](file://med_ai_assistant_1.0_bs_backend/doc/其他/AI响应接口网络中断后连接失败问题分析与解决方案.md)
- [执行服务器架构简化实施报告.md](file://med_ai_assistant_1.0_bs_backend/doc/其他/执行服务器架构简化实施报告.md)
- [执行服务器性能优化方案.md](file://med_ai_assistant_1.0_bs_backend/doc/其他/执行服务器性能优化方案.md)
- [2026-03-25更新日志.md:7-8](file://med_ai_assistant_1.0_bs/更新小结.md#L7-L8)
- [2026-03-21更新日志.md:1-21](file://med_ai_assistant_1.0_bs/更新小结.md#L1-L21)

## 结论
系统通过专用RestTemplate、指数退避重试、响应缓存与全面监控，有效提升了LLM调用的稳定性与性能。执行服务器专注于高时延推理与加密处理，主服务器负责业务编排与对外API，二者协同实现高可靠、可扩展的AI诊断辅助能力。**新增的MCC分析功能模块进一步增强了系统的临床价值，提供了完整的MCC预筛选、相似度计算、排除规则检查、TopK筛选和Prompt生成保存能力。**前端DRG/MCC分析API的统一接口设计，配合视图优化和字段映射修复，显著提升了用户体验。**前端AI服务模块的时序优化进一步提升了用户体验，确保AI对话内容能够及时显示在界面上。**

**最新更新** 新增的MCC分析功能模块是系统的重要扩展，包括完整的后端控制器、服务层、模型类和前端组件。新增MCC分析Prompt生成保存接口，支持根据病人ID和MCC筛选结果生成并保存Prompt到数据库。前端MCC预筛选使用真实患者数据，修复硬编码测试数据问题，MCC筛查结果按相似度降序排列，显示诊断编码、名称、MCC/CC类型。修复14个API路径重复'/api/'问题，统一API调用规范，修复MCC候选列表字段映射问题。这些功能增强体现了系统在兼容性、实用性和扩展性方面的持续改进，为复杂的医疗场景提供了更好的支持。

建议持续基于监控数据进行配置调优与容量规划，确保系统在复杂医疗场景下的长期稳定运行。

## 附录
- 配置建议
  - 在应用配置中添加LLM专用参数：连接超时、读取超时、最大重试次数、基础延迟、连接池大小等
  - 启用监控与告警：实时成功率、响应时间、超时错误频率与重试成功率
  - **MCC分析配置**：设置相似度阈值、TopK数量、排除规则开关等参数
  - **前端配置**：确保AI服务模块的回调时序正确，支持Promise和回调两种调用模式
  - **模板管理配置**：Element Plus组件的国际化和主题配置
  - **设备检测配置**：触屏设备检测逻辑的兼容性测试
  - **OCR系统配置**：边缘计算设备的性能参数和网络配置
  - **API调用配置**：统一的API路径规范，避免重复前缀问题
- 部署策略
  - 分阶段部署：开发 -> 测试 -> 预生产 -> 灰度 -> 全量
  - 回滚计划：代码回滚、配置回滚、数据回滚与监控验证
  - **版本管理**：版本号从0.4.071更新到0.6.083，包含MCC分析功能、UI显示问题修复、模板管理功能增强、Android平板界面修复和AI OCR数据采集系统
  - **MCC字典部署**：独立部署MCC字典库，支持热重载和增量更新
  - **OCR系统部署**：独立部署OCR服务，与主系统通过API集成
- **UI优化建议**
  - **非流式响应**：确保回调在Promise resolve之前执行，避免UI显示延迟
  - **错误处理**：支持多种错误格式，提供清晰的错误信息反馈
  - **加载状态**：在AI响应期间提供适当的加载提示，改善用户体验
  - **模板交互**：优化补充信息输入对话框的用户体验，提供清晰的引导和帮助信息
  - **设备适配**：完善触屏/桌面差异化交互，提升移动端用户体验
  - **OCR界面**：提供直观的设备管理和数据监控界面
  - **MCC视图优化**：优化平铺视图和分组视图的渲染性能
  - **API调用优化**：统一API路径规范，避免重复前缀问题
  - **字段映射优化**：确保MCC候选列表字段显示正确
- **模板管理最佳实践**
  - **模板分类**：合理组织模板类型，便于用户快速找到所需模板
  - **表单验证**：建立完善的表单验证机制，确保模板配置的正确性
  - **权限控制**：根据用户角色限制模板的创建、编辑和删除权限
  - **数据备份**：定期备份模板配置，防止意外删除造成的数据丢失
  - **模板共享**：建立模板社区共享机制，促进模板的复用和优化
- **OCR系统最佳实践**
  - **设备模板管理**：建立完善的设备模板库，支持快速模板匹配
  - **图像质量优化**：确保摄像头安装位置和角度符合识别要求
  - **数据校验机制**：建立多层次的数据校验规则，保证数据准确性
  - **报警机制**：设置合理的报警阈值，及时发现异常情况
  - **性能监控**：实时监控OCR识别性能和系统运行状态
- **MCC分析最佳实践**
  - **字典维护**：定期更新MCC字典，支持热重载和增量更新
  - **相似度阈值**：根据临床需求调整相似度阈值，平衡敏感性和特异性
  - **TopK筛选**：合理设置TopK数量，避免候选过多或过少
  - **排除规则**：完善排除规则配置，提高候选质量
  - **性能监控**：监控MCC分析的响应时间和准确率
  - **用户培训**：提供MCC分析功能的使用培训和技术支持

**最新更新** 新增MCC分析功能的配置建议和最佳实践，包括字典维护、相似度阈值设置、TopK筛选、排除规则、性能监控等方面。修复14个API路径重复'/api/'问题，统一API调用规范。优化MCC视图渲染性能，确保字段映射正确显示。

**章节来源**
- [执行服务器LLM调用优化敏捷迭代规划.md:361-430](file://med_ai_assistant_1.0_bs_backend/doc/其他/执行服务器LLM调用优化敏捷迭代规划.md#L361-L430)
- [application.properties](file://med_ai_assistant_1.0_bs_backend/src/main/resources/application.properties)
- [2026-03-25更新日志.md:1-8](file://med_ai_assistant_1.0_bs/更新小结.md#L1-L8)
- [2026-03-24更新日志.md:10-15](file://med_ai_assistant_1.0_bs/更新小结.md#L10-L15)
- [2026-03-23更新日志.md:1-340](file://med_ai_assistant_1.0_bs/更新小结.md#L1-L340)
- [2026-03-21更新日志.md:1-21](file://med_ai_assistant_1.0_bs/更新小结.md#L1-L21)
- [2026-03-20更新日志.md:1-21](file://med_ai_assistant_1.0_bs/更新小结.md#L1-L21)
- [2026-03-08更新日志.md:28-36](file://med_ai_assistant_1.0_bs/更新小结.md#L28-L36)
- [MccScreeningService.java:74-91](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/service/MccScreeningService.java#L74-L91)
- [MccScreeningController.java:233-341](file://med_ai_assistant_1.0_bs_backend/src/main/java/com/example/medaiassistant/controller/MccScreeningController.java#L233-L341)
- [drg.js:154-156](file://med_ai_assistant_1.0_bs_vue/src/api/drg.js#L154-L156)
- [DrgAnalysis.vue:109-127](file://med_ai_assistant_1.0_bs_vue/src/components/patient/DrgAnalysis.vue#L109-L127)
- [监护仪呼吸机AI OCR数据采集方案.md:1-800](file://med_ai_assistant_1.0_bs_backend/doc/迭代/AI OCR数据采集/监护仪呼吸机AI OCR数据采集方案.md#L1-L800)