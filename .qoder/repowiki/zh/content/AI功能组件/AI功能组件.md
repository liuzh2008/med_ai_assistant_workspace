# AI功能组件

<cite>
**本文档引用的文件**   
- [AIView.vue](file://src/views/AIView.vue)
- [PromptList.vue](file://src/components/ai/PromptList.vue)
- [AITabs.vue](file://src/components/ai/AITabs.vue)
- [AIResults.vue](file://src/components/ai/AIResults.vue)
- [AIResponse.vue](file://src/components/ai/AIResponse.vue)
- [DataImport.vue](file://src/components/ai/DataImport.vue)
- [PromptTemplates.vue](file://src/components/ai/PromptTemplates.vue)
- [promptUtils.js](file://src/utils/promptUtils.js)
- [ai.js](file://src/api/ai.js)
- [aiService.js](file://src/api/aiService.js)
- [ai.js](file://src/store/modules/ai.js)
</cite>

## 目录
1. [项目结构](#项目结构)
2. [核心组件](#核心组件)
3. [架构概述](#架构概述)
4. [详细组件分析](#详细组件分析)
5. [依赖关系分析](#依赖关系分析)

## 项目结构

```mermaid
graph TB
subgraph "前端"
AIView["AIView.vue<br/>主视图"]
PromptList["PromptList.vue<br/>Prompt列表"]
AITabs["AITabs.vue<br/>标签页"]
AIResults["AIResults.vue<br/>AI结果"]
AIResponse["AIResponse.vue<br/>AI对话"]
DataImport["DataImport.vue<br/>数据导入"]
PromptTemplates["PromptTemplates.vue<br/>模板管理"]
end
subgraph "API"
aiJS["ai.js<br/>AI接口"]
aiServiceJS["aiService.js<br/>AI服务"]
end
subgraph "状态管理"
aiStore["ai.js<br/>AI状态"]
end
subgraph "工具"
promptUtilsJS["promptUtils.js<br/>Prompt工具"]
end
AIView --> PromptList
AIView --> AITabs
AIView --> PromptTemplates
AITabs --> AIResults
AITabs --> AIResponse
AIResponse --> DataImport
AIResults --> aiStore
AIResponse --> aiServiceJS
PromptTemplates --> promptUtilsJS
promptUtilsJS --> aiJS
aiStore --> aiJS
```

**图示来源**
- [AIView.vue](file://src/views/AIView.vue)
- [PromptList.vue](file://src/components/ai/PromptList.vue)
- [AITabs.vue](file://src/components/ai/AITabs.vue)
- [AIResults.vue](file://src/components/ai/AIResults.vue)
- [AIResponse.vue](file://src/components/ai/AIResponse.vue)
- [DataImport.vue](file://src/components/ai/DataImport.vue)
- [PromptTemplates.vue](file://src/components/ai/PromptTemplates.vue)
- [promptUtils.js](file://src/utils/promptUtils.js)
- [ai.js](file://src/api/ai.js)
- [aiService.js](file://src/api/aiService.js)
- [ai.js](file://src/store/modules/ai.js)

## 核心组件

AI功能组件模块采用模块化设计，以`AIView.vue`作为主视图入口，通过组件化方式组织各个功能模块。系统主要由五个核心组件构成：`PromptList.vue`负责展示可执行的AI任务模板，`AITabs.vue`实现多标签页切换的交互设计，`AIResults.vue`负责渲染Markdown格式的AI输出并支持编辑保存，`AIResponse.vue`实现与大语言模型的流式对话响应，`DataImport.vue`则将患者数据注入对话上下文。这些组件通过Vuex进行状态管理，并通过事件机制进行通信，形成了一个完整的AI辅助诊疗系统。

**组件来源**
- [AIView.vue](file://src/views/AIView.vue)
- [PromptList.vue](file://src/components/ai/PromptList.vue)
- [AITabs.vue](file://src/components/ai/AITabs.vue)
- [AIResults.vue](file://src/components/ai/AIResults.vue)
- [AIResponse.vue](file://src/components/ai/AIResponse.vue)
- [DataImport.vue](file://src/components/ai/DataImport.vue)

## 架构概述

```mermaid
sequenceDiagram
participant 用户 as "用户"
participant AIView as "AIView.vue<br/>主视图"
participant PromptList as "PromptList.vue<br/>Prompt列表"
participant AITabs as "AITabs.vue<br/>标签页"
participant AIResults as "AIResults.vue<br/>AI结果"
participant AIResponse as "AIResponse.vue<br/>AI对话"
participant DataImport as "DataImport.vue<br/>数据导入"
participant Store as "Vuex Store<br/>状态管理"
participant API as "后端API"
用户->>AIView : 进入AI辅助页面
AIView->>Store : 加载模板数据
Store->>API : fetchPromptTemplates()
API-->>Store : 返回模板数据
Store-->>AIView : 更新状态
AIView->>PromptList : 显示Prompt列表
用户->>PromptList : 选择Prompt模板
PromptList->>Store : SET_CURRENT_PROMPT
Store-->>AITabs : 通知当前Prompt
AITabs->>AIResults : 显示AI结果
AITabs->>AIResponse : 显示AI对话
用户->>AIResponse : 发送消息
AIResponse->>API : getAIResponseWithParams()
API-->>AIResponse : 流式返回AI响应
AIResponse->>Store : 更新对话历史
用户->>AIResponse : 点击导入
AIResponse->>DataImport : 显示导入对话框
DataImport->>API : 获取患者数据
API-->>DataImport : 返回患者数据
DataImport->>AIResponse : 插入数据到输入框
用户->>AIResults : 编辑内容
AIResults->>Store : SET_RESULT
AIResults->>API : saveAIResult()
API-->>AIResults : 保存成功
```

**图示来源**
- [AIView.vue](file://src/views/AIView.vue#L1-L174)
- [PromptList.vue](file://src/components/ai/PromptList.vue#L1-L279)
- [AITabs.vue](file://src/components/ai/AITabs.vue#L1-L44)
- [AIResults.vue](file://src/components/ai/AIResults.vue#L1-L291)
- [AIResponse.vue](file://src/components/ai/AIResponse.vue#L1-L496)
- [DataImport.vue](file://src/components/ai/DataImport.vue#L1-L182)
- [ai.js](file://src/api/ai.js#L1-L399)
- [aiService.js](file://src/api/aiService.js#L1-L158)
- [ai.js](file://src/store/modules/ai.js#L1-L143)

## 详细组件分析

### AIView.vue 主视图分析

`AIView.vue`作为AI功能的主视图，采用左右布局结构，左侧为`PromptList`组件，右侧为`AITabs`组件，底部为`PromptTemplates`组件。该组件通过Vuex的`mapGetters`获取患者ID和Prompt模板数据，并在`mounted`生命周期钩子中加载模板数据和检查入院记录。

```mermaid
classDiagram
class AIView {
+currentPrompt : Object
+lastPatientId : String
+handlePromptSelected(prompt)
+checkAdmissionRecords()
+generateAdmissionSummary()
+mounted()
}
AIView --> PromptList : "使用"
AIView --> AITabs : "使用"
AIView --> PromptTemplates : "使用"
AIView --> Store : "状态管理"
AIView --> promptUtils : "工具函数"
```

**图示来源**
- [AIView.vue](file://src/views/AIView.vue#L1-L174)

**组件来源**
- [AIView.vue](file://src/views/AIView.vue#L1-L174)

### PromptList.vue 组件分析

`PromptList.vue`组件负责展示已执行和未执行的Prompt列表，通过`patientId`属性接收患者ID，并在`watch`中监听其变化以重新加载数据。组件通过`getPatientPromptDetails` API获取患者Prompt详情，并根据`statusName`将数据分为已执行和未执行两类。

```mermaid
flowchart TD
Start([组件创建]) --> LoadData["加载患者Prompt详情"]
LoadData --> ProcessData["处理API返回数据"]
ProcessData --> SortData["按执行时间倒序排序"]
SortData --> Display["显示已执行和未执行Prompt"]
Display --> Select["用户选择Prompt"]
Select --> GetDetail["调用getPatientPromptDetail获取完整详情"]
GetDetail --> UpdateStore["更新Vuex状态"]
UpdateStore --> Emit["触发prompt-selected事件"]
Emit --> End([完成])
```

**图示来源**
- [PromptList.vue](file://src/components/ai/PromptList.vue#L1-L279)

**组件来源**
- [PromptList.vue](file://src/components/ai/PromptList.vue#L1-L279)

### AITabs.vue 组件分析

`AITabs.vue`组件实现多标签页切换功能，包含"AI结果"和"AI对话"两个标签页。组件通过`el-tabs`组件实现标签页切换，`activeTab`数据属性记录当前激活的标签页。

```mermaid
classDiagram
class AITabs {
+activeTab : String
+currentPrompt : Object
}
AITabs --> AIResults : "包含"
AITabs --> AIResponse : "包含"
```

**图示来源**
- [AITabs.vue](file://src/components/ai/AITabs.vue#L1-L44)

**组件来源**
- [AITabs.vue](file://src/components/ai/AITabs.vue#L1-L44)

### AIResults.vue 组件分析

`AIResults.vue`组件负责渲染Markdown格式的AI输出并支持编辑保存。组件使用`md-editor-v3`库渲染Markdown内容，并提供编辑、保存、取消等操作按钮。当用户点击"编辑内容"按钮时，组件切换到编辑模式，使用`MdEditor`组件进行内容编辑。

```mermaid
flowchart TD
Start([组件初始化]) --> WatchPrompt["监听prompt属性变化"]
WatchPrompt --> UpdateResult["更新result状态"]
UpdateResult --> Display["显示AI结果"]
Display --> CheckEditing{"是否编辑模式?"}
CheckEditing --> |否| RenderHTML["渲染HTML内容"]
CheckEditing --> |是| RenderEditor["渲染编辑器"]
RenderHTML --> End1([完成])
RenderEditor --> Save["用户点击保存"]
Save --> Validate["验证数据完整性"]
Validate --> SaveToDB["调用saveAIResult保存到数据库"]
SaveToDB --> UpdateStore["更新Vuex状态"]
UpdateStore --> Success["显示保存成功消息"]
Success --> End2([完成])
```

**图示来源**
- [AIResults.vue](file://src/components/ai/AIResults.vue#L1-L291)

**组件来源**
- [AIResults.vue](file://src/components/ai/AIResults.vue#L1-L291)

### AIResponse.vue 组件分析

`AIResponse.vue`组件实现与大语言模型的流式对话响应。组件通过`getAIResponseWithParams`函数调用AI服务，并使用`onData`回调函数处理流式响应数据。组件支持消息展开/收起、滚动到顶部/底部等功能，并提供导入患者数据、保存对话记录等操作。

```mermaid
sequenceDiagram
participant 用户 as "用户"
participant AIResponse as "AIResponse.vue"
participant aiService as "aiService"
participant 后端 as "后端服务"
用户->>AIResponse : 发送消息
AIResponse->>aiService : getAIResponseStream()
aiService->>后端 : 发送POST请求
后端-->>aiService : 返回流式响应
aiService->>AIResponse : onData(data)
AIResponse->>AIResponse : 累积内容并更新UI
loop 处理每个数据块
AIResponse->>AIResponse : 解析JSON数据
AIResponse->>AIResponse : 更新AI消息内容
AIResponse->>AIResponse : 滚动到底部
end
AIResponse-->>用户 : 显示完整AI回复
```

**图示来源**
- [AIResponse.vue](file://src/components/ai/AIResponse.vue#L1-L496)
- [aiService.js](file://src/api/aiService.js#L1-L158)

**组件来源**
- [AIResponse.vue](file://src/components/ai/AIResponse.vue#L1-L496)

### DataImport.vue 组件分析

`DataImport.vue`组件负责将患者数据注入对话上下文。组件提供"获取所有资料"、"获取当日资料"、"获取内存资料"等按钮，用户点击后调用相应API获取数据，并通过"插入"按钮将数据插入到AI对话输入框中。

```mermaid
classDiagram
class DataImport {
+loading : Boolean
+importedData : String
+importAllData()
+importTodayData()
+getMemoryArray()
+insertToAI()
+handleClose()
}
DataImport --> API : "调用接口"
DataImport --> AIResponse : "插入数据"
```

**图示来源**
- [DataImport.vue](file://src/components/ai/DataImport.vue#L1-L182)

**组件来源**
- [DataImport.vue](file://src/components/ai/DataImport.vue#L1-L182)

### PromptTemplates.vue 组件分析

`PromptTemplates.vue`组件管理自定义Prompt模板，使用`el-tree`组件展示模板树形结构。组件通过`handleNodeClick`方法处理节点点击事件，当用户点击模板节点时，弹出确认对话框，确认后调用`handlePromptExecution`函数执行模板。

```mermaid
flowchart TD
Start([组件初始化]) --> LoadTemplates["加载模板数据"]
LoadTemplates --> DisplayTree["显示模板树形结构"]
DisplayTree --> ClickNode["用户点击模板节点"]
ClickNode --> Confirm["弹出确认对话框"]
Confirm --> |确定| Execute["调用handlePromptExecution"]
Execute --> API["调用addPrompt保存记录"]
API --> Success["显示成功消息"]
Confirm --> |取消| Cancel["取消操作"]
Success --> End1([完成])
Cancel --> End2([完成])
```

**图示来源**
- [PromptTemplates.vue](file://src/components/ai/PromptTemplates.vue#L1-L109)

**组件来源**
- [PromptTemplates.vue](file://src/components/ai/PromptTemplates.vue#L1-L109)

## 依赖关系分析

```mermaid
graph TD
AIView --> PromptList
AIView --> AITabs
AIView --> PromptTemplates
AITabs --> AIResults
AITabs --> AIResponse
AIResponse --> DataImport
AIResults --> Store
AIResponse --> Store
PromptTemplates --> Store
Store --> aiJS
promptUtilsJS --> aiJS
AIResponse --> aiServiceJS
aiServiceJS --> API
aiJS --> API
style AIView fill:#f9f,stroke:#333
style PromptList fill:#bbf,stroke:#333
style AITabs fill:#bbf,stroke:#333
style AIResults fill:#bbf,stroke:#333
style AIResponse fill:#bbf,stroke:#333
style DataImport fill:#bbf,stroke:#333
style PromptTemplates fill:#bbf,stroke:#333
style Store fill:#f96,stroke:#333
style aiJS fill:#6f9,stroke:#333
style aiServiceJS fill:#6f9,stroke:#333
style promptUtilsJS fill:#6f9,stroke:#333
style API fill:#696,stroke:#333
```

**图示来源**
- [AIView.vue](file://src/views/AIView.vue)
- [PromptList.vue](file://src/components/ai/PromptList.vue)
- [AITabs.vue](file://src/components/ai/AITabs.vue)
- [AIResults.vue](file://src/components/ai/AIResults.vue)
- [AIResponse.vue](file://src/components/ai/AIResponse.vue)
- [DataImport.vue](file://src/components/ai/DataImport.vue)
- [PromptTemplates.vue](file://src/components/ai/PromptTemplates.vue)
- [ai.js](file://src/api/ai.js)
- [aiService.js](file://src/api/aiService.js)
- [promptUtils.js](file://src/utils/promptUtils.js)
- [ai.js](file://src/store/modules/ai.js)