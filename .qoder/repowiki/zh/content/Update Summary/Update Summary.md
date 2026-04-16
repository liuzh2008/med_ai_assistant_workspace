# 更新摘要

<cite>
**本文档引用的文件**
- [.gitignore](file://.gitignore)
- [mvn.bat](file://mvn.bat)
- [npm.bat](file://npm.bat)
- [Mermaid 代码修复 Prompt 模板.txt](file://项目相关/Mermaid 代码修复 Prompt 模板.txt)
- [常用.txt](file://项目相关/常用.txt)
- [神级Prompt.txt](file://项目相关/神级Prompt.txt)
- [testAudio测试命令.txt](file://项目相关/test/testAudio测试命令.txt)
- [pom.xml](file://med_ai_assistant_1.0_bs_backend/pom.xml)
- [logback-spring.xml](file://med_ai_assistant_1.0_bs_backend/src/main/resources/logback-spring.xml)
- [docker-compose-main-linux-oracle-image.yml](file://med_ai_assistant_1.0_bs_backend/deploy/main-linux-oracle/docker-compose-main-linux-oracle-image.yml)
- [docker-compose-main.yml](file://med_ai_assistant_1.0_bs_backend/deploy/main-linux-oracle/docker-compose-main.yml)
- [docker-compose-execution-image.yml](file://med_ai_assistant_1.0_bs_backend/deploy/execution-linux/docker-compose-execution-image.yml)
- [docker-compose-execution-linux.yml](file://med_ai_assistant_1.0_bs_backend/deploy/execution-linux/docker-compose-execution-linux.yml)
- [docker-compose.prod.yml](file://med_ai_assistant_1.0_bs_vue/deploy/med_ai_assistant_1.0_bs_vue/docker-compose.prod.yml)
- [docker-compose.yml](file://med_ai_assistant_1.0_bs_vue/deploy/med_ai_assistant_1.0_bs_vue/docker-compose.yml)
- [更新小结.md](file://med_ai_assistant_1.0_bs_vue/更新小结.md)
- [更新小结.md](file://更新小结.md)
- [2026-04-11.md](file://med_ai_assistant_1.0_bs_vue/docs/更新日志/2026-04-11.md)
- [2026-04-14.md](file://med_ai_assistant_1.0_bs_vue/docs/更新日志/2026-04-14.md)
- [2026-04-13.md](file://med_ai_assistant_1.0_bs_vue/docs/更新日志/2026-04-13.md)
- [2026-04-02.md](file://med_ai_assistant_1.0_bs_vue/docs/更新日志/2026-04-02.md)
- [OpenClaw集成方案-临床场景分析与PoC规划.md](file://med_ai_assistant_1.0_bs_backend/doc/迭代/openclaw/OpenClaw集成方案-临床场景分析与PoC规划.md)
- [DiagnosisEditPanel.vue](file://med_ai_assistant_1.0_bs_vue/src/components/ai/DiagnosisEditPanel.vue)
- [DiagnosisCard.vue](file://med_ai_assistant_1.0_bs_vue/src/components/ai/DiagnosisCard.vue)
- [aiService.js](file://med_ai_assistant_1.0_bs_vue/src/api/aiService.js)
- [AIResponse.vue](file://med_ai_assistant_1.0_bs_vue/src/components/ai/AIResponse.vue)
- [AITabs.vue](file://med_ai_assistant_1.0_bs_vue/src/components/ai/AITabs.vue)
- [PromptTemplates.vue](file://med_ai_assistant_1.0_bs_vue/src/components/ai/PromptTemplates.vue)
- [AIView.vue](file://med_ai_assistant_1.0_bs_vue/src/views/AIView.vue)
- [PromptList.vue](file://med_ai_assistant_1.0_bs_vue/src/components/ai/PromptList.vue)
- [2026-04-11.md](file://med_ai_assistant_1.0_bs_backend/doc/更新日志/2026-04-11.md)
- [2026-04-14.md](file://med_ai_assistant_1.0_bs_backend/doc/更新日志/2026-04-14.md)
- [2026-04-13.md](file://med_ai_assistant_1.0_bs_backend/doc/更新日志/2026-04-13.md)
</cite>

## 更新摘要
**已进行的变更**
- 新增了PromptTemplates组件UI重构的重要改进：模板列表改为overlay下拉面板，默认折叠，右上角按钮展开，执行模板后自动收起
- 更新了版本0.8.025的具体更新内容，重点反映了PromptTemplates组件的UI重构和交互优化
- 完善了AI对话流式响应改造的技术实现细节和用户体验改进
- 增强了诊断编辑面板组件的功能描述和使用场景说明
- 更新了版本发布历史，包含最新的前端版本演进记录和OpenClaw集成方案

## 目录
1. [简介](#简介)
2. [项目结构](#项目结构)
3. [核心组件](#核心组件)
4. [架构概览](#架构概览)
5. [详细组件分析](#详细组件分析)
6. [PromptTemplates组件UI重构](#prompttemplates组件ui重构)
7. [OpenClaw集成方案](#openclaw集成方案)
8. [依赖分析](#依赖分析)
9. [性能考虑](#性能考虑)
10. [故障排除指南](#故障排除指南)
11. [版本发布历史](#版本发布历史)
12. [结论](#结论)
13. [附录](#附录)

## 简介

MedAiAssistant 是一个基于人工智能技术的医疗辅助系统，旨在为医疗机构提供智能化的诊断支持、病历管理、影像分析等功能。该项目采用前后端分离的架构设计，后端使用Spring Boot框架，前端使用Vue.js技术栈，通过Docker容器化部署实现系统的可扩展性和可维护性。

该系统的核心目标是通过AI技术提升医疗服务质量和效率，为医生提供智能辅助决策支持，同时确保医疗数据的安全性和隐私保护。系统现已集成OpenClaw AI编排引擎，通过自然语言驱动多步骤API编排，实现更智能的临床工作流程自动化。

## 项目结构

项目采用标准的多模块架构，主要包含以下核心目录：

```mermaid
graph TB
subgraph "项目根目录"
Root[项目根目录]
Backend[后端模块<br/>med_ai_assistant_1.0_bs_backend]
Frontend[前端模块<br/>med_ai_assistant_1.0_bs_vue]
Docs[文档目录<br/>doc/]
Config[配置文件<br/>config/]
OpenClaw[OpenClaw集成<br/>doc/迭代/openclaw/]
end
subgraph "后端模块结构"
Backend --> SpringBoot[Spring Boot 应用]
Backend --> Deploy[部署配置]
Backend --> MemoryBank[内存银行]
Backend --> Config[配置管理]
Backend --> OpenClawDoc[OpenClaw文档]
end
subgraph "前端模块结构"
Frontend --> VueApp[Vue.js 应用]
Frontend --> Deploy[部署配置]
Frontend --> Components[组件库]
Frontend --> OpenClawUI[OpenClaw界面]
end
subgraph "工具和配置"
Tools[开发工具]
Scripts[启动脚本]
Templates[Prompt模板]
end
Root --> Backend
Root --> Frontend
Root --> Docs
Root --> Config
Root --> OpenClaw
Root --> Tools
Root --> Scripts
Root --> Templates
```

**图表来源**
- [项目结构](file://.)

**章节来源**
- [项目结构](file://.)

## 核心组件

### 后端服务组件

后端采用Spring Boot框架构建，主要包含以下核心组件：

1. **服务层组件**
   - 诊断辅助服务
   - 病历管理系统
   - 影像分析服务
   - 实验室结果处理
   - 电子病历查询
   - OpenClaw编排服务

2. **数据访问层**
   - 数据库连接池管理
   - SQL查询优化器
   - 缓存策略管理
   - 数据同步机制

3. **配置管理**
   - 多环境配置支持
   - 动态配置更新
   - 安全配置管理

### 前端交互组件

前端基于Vue.js构建，提供现代化的用户界面：

1. **UI组件库**
   - Element UI集成
   - 自定义业务组件
   - 响应式布局设计

2. **状态管理**
   - Vuex状态管理
   - 组件间通信
   - 数据持久化

3. **路由管理**
   - 路由守卫
   - 权限控制
   - 导航管理

4. **OpenClaw集成界面**
   - 自然语言交互界面
   - 编排流程可视化
   - 任务状态监控

**章节来源**
- [pom.xml](file://med_ai_assistant_1.0_bs_backend/pom.xml)
- [logback-spring.xml](file://med_ai_assistant_1.0_bs_backend/src/main/resources/logback-spring.xml)

## 架构概览

系统采用微服务架构设计，通过容器化部署实现高可用性和可扩展性，并集成了OpenClaw AI编排引擎：

```mermaid
graph TB
subgraph "客户端层"
Web[Web浏览器]
Mobile[移动应用]
Desktop[桌面应用]
OpenClawClient[OpenClaw客户端]
end
subgraph "网关层"
Gateway[API网关]
Auth[认证授权]
LoadBalancer[负载均衡]
OpenClawGateway[OpenClaw网关]
end
subgraph "业务服务层"
Diagnosis[诊断服务]
EMR[电子病历服务]
Imaging[影像分析服务]
Lab[实验室服务]
Pharmacy[药房服务]
OpenClawService[OpenClaw编排服务]
end
subgraph "数据存储层"
MySQL[(MySQL数据库)]
Redis[(Redis缓存)]
MinIO[(对象存储)]
Elasticsearch[(搜索引擎)]
end
subgraph "AI编排层"
OpenClawEngine[OpenClaw引擎]
Skills[技能库]
LLM[大语言模型]
end
subgraph "基础设施层"
Docker[Docker容器]
Kubernetes[Kubernetes集群]
Monitoring[监控系统]
Logging[日志系统]
```

**图表来源**
- [docker-compose-main-linux-oracle-image.yml](file://med_ai_assistant_1.0_bs_backend/deploy/main-linux-oracle/docker-compose-main-linux-oracle-image.yml)
- [docker-compose-execution-image.yml](file://med_ai_assistant_1.0_bs_backend/deploy/execution-linux/docker-compose-execution-image.yml)
- [OpenClaw集成方案-临床场景分析与PoC规划.md](file://med_ai_assistant_1.0_bs_backend/doc/迭代/openclaw/OpenClaw集成方案-临床场景分析与PoC规划.md)

## 详细组件分析

### 开发环境配置组件

#### Maven启动脚本
项目提供了便捷的开发环境启动脚本，简化了本地开发流程：

```mermaid
flowchart TD
Start([启动开发环境]) --> CheckDir[检查项目目录]
CheckDir --> SetEncoding[设置UTF-8编码]
SetEncoding --> RunSpringBoot[启动Spring Boot应用]
RunSpringBoot --> WaitCommand[保持命令行窗口]
WaitCommand --> MonitorLogs[监控应用日志]
MonitorLogs --> Ready[开发环境就绪]
Ready --> StopDev[停止开发环境]
StopDev --> End([结束])
```

**图表来源**
- [mvn.bat](file://mvn.bat)

#### NPM启动脚本
前端开发环境的快速启动方案：

```mermaid
sequenceDiagram
participant Dev as 开发者
participant Script as 启动脚本
participant Frontend as 前端应用
participant Browser as 浏览器
Dev->>Script : 执行npm run serve
Script->>Frontend : 启动Vue开发服务器
Frontend->>Browser : 启动热重载服务
Browser->>Dev : 显示开发界面
Note over Dev,Browser : 支持热重载和实时调试
```

**图表来源**
- [npm.bat](file://npm.bat)

**章节来源**
- [mvn.bat](file://mvn.bat)
- [npm.bat](file://npm.bat)

### 配置管理组件

#### 多环境配置系统
系统支持多种部署环境的配置管理：

```mermaid
graph LR
subgraph "配置层次"
Global[全局配置]
Environment[环境特定配置]
Instance[实例特定配置]
end
subgraph "环境类型"
Local[本地开发]
Test[测试环境]
Stage[预生产环境]
Prod[生产环境]
OpenClaw[OpenClaw环境]
end
subgraph "配置源"
YAML[YAML配置文件]
ENV[环境变量]
Secret[密钥管理]
DB[(数据库)]
end
Global --> Environment
Environment --> Instance
Environment --> Local
Environment --> Test
Environment --> Stage
Environment --> Prod
Environment --> OpenClaw
Instance --> YAML
Instance --> ENV
Instance --> Secret
Instance --> DB
```

**图表来源**
- [hospital-Local.yaml](file://med_ai_assistant_1.0_bs_backend/config/hospitals/hospital-Local.yaml)
- [cdwyy.yaml](file://med_ai_assistant_1.0_bs_backend/deploy/main-linux-oracle/config/hospitals/cdwyy.yaml)

#### 日志配置管理
集中化的日志管理策略：

```mermaid
flowchart TD
App[应用程序] --> Logback[Logback配置]
Logback --> Console[控制台输出]
Logback --> File[文件日志]
Logback --> Database[数据库日志]
Console --> DevConsole[开发控制台]
Console --> ProdConsole[生产控制台]
File --> DailyRolling[按日滚动]
File --> SizeBased[按大小分割]
Database --> AuditLog[审计日志]
Database --> ErrorLog[错误日志]
DevConsole --> DebugLevel[调试级别]
ProdConsole --> InfoLevel[信息级别]
DailyRolling --> RetentionPolicy[保留策略]
SizeBased --> Compression[压缩处理]
```

**图表来源**
- [logback-spring.xml](file://med_ai_assistant_1.0_bs_backend/src/main/resources/logback-spring.xml)

**章节来源**
- [hospital-Local.yaml](file://med_ai_assistant_1.0_bs_backend/config/hospitals/hospital-Local.yaml)
- [logback-spring.xml](file://med_ai_assistant_1.0_bs_backend/src/main/resources/logback-spring.xml)

### 开发工具和工作流组件

#### Mermaid图表修复工具
专门用于修复Mermaid图表代码的智能工具：

```mermaid
flowchart TD
Input[用户输入的Mermaid代码] --> ParseCode[解析代码结构]
ParseCode --> CheckSyntax[语法检查]
CheckSyntax --> CheckSpecialChars[特殊字符处理]
CheckSpecialChars --> CheckKeywords[关键字检查]
CheckKeywords --> CheckStructure[结构校正]
CheckSyntax --> SyntaxErrors{语法错误?}
CheckSpecialChars --> SpecialErrors{特殊字符问题?}
CheckKeywords --> KeywordErrors{关键字冲突?}
CheckStructure --> StructureErrors{结构问题?}
SyntaxErrors --> |是| FixSyntax[修复语法错误]
SpecialErrors --> |是| FixSpecialChars[处理特殊字符]
KeywordErrors --> |是| FixKeywords[规避关键字]
StructureErrors --> |是| FixStructure[校正结构]
SyntaxErrors --> |否| NextStep[继续检查]
SpecialErrors --> |否| NextStep
KeywordErrors --> |否| NextStep
StructureErrors --> |否| NextStep
FixSyntax --> NextStep
FixSpecialChars --> NextStep
FixKeywords --> NextStep
FixStructure --> NextStep
NextStep --> FormatOptimization[格式优化]
FormatOptimization --> Output[输出修复后的代码]
```

**图表来源**
- [Mermaid 代码修复 Prompt 模板.txt](file://项目相关/Mermaid 代码修复 Prompt 模板.txt)

#### 开发工作流程规范
标准化的开发流程和最佳实践：

```mermaid
sequenceDiagram
participant Dev as 开发者
participant Git as Git仓库
participant CI as CI/CD流水线
participant Test as 测试环境
participant Prod as 生产环境
Dev->>Git : 创建功能分支
Dev->>Dev : 编写代码和单元测试
Dev->>Git : 提交代码到功能分支
Dev->>Git : 发起Pull Request
Git->>CI : 触发CI流水线
CI->>Test : 部署到测试环境
Test->>Dev : 回馈测试结果
Dev->>Git : 根据反馈修复问题
Git->>CI : 重新触发CI流水线
CI->>Prod : 部署到生产环境
Prod->>Dev : 上线完成确认
```

**图表来源**
- [常用.txt](file://项目相关/常用.txt)

**章节来源**
- [Mermaid 代码修复 Prompt 模板.txt](file://项目相关/Mermaid 代码修复 Prompt 模板.txt)
- [常用.txt](file://项目相关/常用.txt)

### 测试和验证组件

#### 音频测试工具
专门用于ASR（自动语音识别）功能测试的工具：

```mermaid
flowchart TD
AudioFile[音频文件] --> Base64[Base64编码]
Base64 --> JSONTemplate[JSON请求模板]
JSONTemplate --> CurlRequest[CURL请求]
CurlRequest --> DashScope[DashScope API]
Base64 --> RequestBuilder[请求构建器]
RequestBuilder --> Validation[请求验证]
Validation --> Execution[执行测试]
Execution --> Response[响应处理]
Response --> Result[测试结果]
Result --> Success{测试成功?}
Success --> |是| Report[生成报告]
Success --> |否| Debug[调试分析]
Debug --> Fix[修复问题]
Fix --> Retry[重试测试]
Retry --> Success
```

**图表来源**
- [testAudio测试命令.txt](file://项目相关/test/testAudio测试命令.txt)

**章节来源**
- [testAudio测试命令.txt](file://项目相关/test/testAudio测试命令.txt)

### AI诊断编辑面板组件

#### 诊断编辑面板（DiagnosisEditPanel）
**更新** 新增了诊断编辑面板组件的详细功能说明

诊断编辑面板是一个集成了诊断编辑、管理和查看功能的综合组件，采用左右两栏布局设计：

```mermaid
graph TB
subgraph "诊断编辑面板布局"
LeftPanel[左侧：AI诊断列表]
RightPanel[右侧：标签页区域]
Toolbar[底部工具栏]
end
subgraph "左侧面板功能"
AITableView[AI诊断表格]
AITableView --> Selection[多选功能]
AITableView --> EditMode[双击编辑]
AITableView --> Highlight[差异高亮]
end
subgraph "右侧标签页"
DetailTab[诊断说明标签页]
CurrentTab[目前诊断标签页]
DetailTab --> Category[诊断类别]
DetailTab --> Basis[诊断依据]
DetailTab --> Differential[鉴别诊断]
DetailTab --> Supplement[补充说明]
end
LeftPanel --> RightPanel
LeftPanel --> Toolbar
RightPanel --> DetailTab
RightPanel --> CurrentTab
```

**图表来源**
- [DiagnosisEditPanel.vue](file://med_ai_assistant_1.0_bs_vue/src/components/ai/DiagnosisEditPanel.vue)

**核心功能特性**：
- **AI诊断列表管理**：支持AI生成诊断的查看、编辑、删除
- **诊断详情展示**：右侧标签页展示诊断的详细分析信息
- **目前诊断管理**：支持对现有诊断的修改、保存、删除
- **差异诊断高亮**：自动识别并高亮显示AI推荐的新诊断
- **工具栏操作**：提供刷新、新增、插入、保存、删除等快捷操作

**章节来源**
- [DiagnosisEditPanel.vue](file://med_ai_assistant_1.0_bs_vue/src/components/ai/DiagnosisEditPanel.vue)

### AI对话流式响应组件

#### 流式响应改造（AIResponse + aiService）
**更新** 完善了AI对话流式响应的技术实现细节

AI对话功能从一次性加载改为逐字流式显示，大幅减少响应等待时间感知：

```mermaid
sequenceDiagram
participant User as 用户
participant AIResponse as AIResponse组件
participant AIService as AIService类
participant aiService as aiService实例
participant Backend as 后端AI服务
User->>AIResponse : 发送消息
AIResponse->>AIResponse : 组合历史对话
AIResponse->>AIService : 调用getAIResponseStream
AIService->>aiService : 发送流式请求
aiService->>Backend : POST /api/ai/response
Backend->>aiService : 返回NDJSON流
loop 流式响应
aiService->>AIService : onData回调(增量内容)
AIService->>AIResponse : 更新UI显示
AIResponse->>AIResponse : 实时渲染增量内容
end
aiService->>AIService : onData回调(最终内容)
AIService->>AIResponse : 替换完整内容
AIResponse->>User : 显示最终AI回复
```

**图表来源**
- [aiService.js](file://med_ai_assistant_1.0_bs_vue/src/api/aiService.js)
- [AIResponse.vue](file://med_ai_assistant_1.0_bs_vue/src/components/ai/AIResponse.vue)

**技术实现要点**：
- **NDJSON流处理**：使用ReadableStream消费后端返回的NDJSON格式数据
- **增量内容渲染**：支持实时显示AI回复的增量内容
- **超时控制**：集成AbortController实现300秒超时取消机制
- **最终内容替换**：使用isFinal标识确保最终内容正确替换累积内容

**章节来源**
- [aiService.js](file://med_ai_assistant_1.0_bs_vue/src/api/aiService.js)
- [AIResponse.vue](file://med_ai_assistant_1.0_bs_vue/src/components/ai/AIResponse.vue)

### 诊断概览卡片组件

#### 诊断卡片组件（DiagnosisCard）
**更新** 新增了诊断概览卡片组件的功能描述

诊断概览卡片组件提供简洁的诊断信息展示功能：

```mermaid
graph LR
subgraph "诊断卡片布局"
LeftCol[左侧诊断列表]
RightCol[右侧诊断详情]
end
subgraph "左侧功能"
ListItems[诊断列表项]
ListItems --> ClickSelect[点击选择]
ListItems --> AutoScroll[自动滚动]
end
subgraph "右侧功能"
DetailSections[详情区域]
DetailSections --> Category[诊断类别]
DetailSections --> Basis[诊断依据]
DetailSections --> Differential[鉴别诊断]
DetailSections --> Supplement[补充说明]
end
LeftCol --> RightCol
```

**图表来源**
- [DiagnosisCard.vue](file://med_ai_assistant_1.0_bs_vue/src/components/ai/DiagnosisCard.vue)

**功能特点**：
- **左右分栏布局**：左侧显示诊断列表，右侧显示详细信息
- **Markdown渲染**：支持诊断依据等内容的Markdown格式渲染
- **自动换行支持**：优化长文本显示，避免内容溢出
- **XSS安全过滤**：使用DOMPurify确保渲染内容的安全性

**章节来源**
- [DiagnosisCard.vue](file://med_ai_assistant_1.0_bs_vue/src/components/ai/DiagnosisCard.vue)

## PromptTemplates组件UI重构

### Overlay下拉面板架构

**更新** 新增了PromptTemplates组件UI重构的重要改进

PromptTemplates组件经过重大UI重构，从传统的浮动面板改为现代化的Overlay下拉面板设计：

```mermaid
graph TB
subgraph "AI视图布局"
LeftPanel[左侧Prompt列表]
MainArea[中间AI标签页区域]
RightPanel[右侧Prompt模板面板]
end
subgraph "模板面板架构"
Toolbar[顶部工具栏]
ToggleBtn[展开按钮]
OverlayPanel[Overlay下拉面板]
TemplateTree[模板树形结构]
end
subgraph "交互流程"
ClickBtn[点击展开按钮]
ShowPanel[显示Overlay面板]
ClickOutside[点击外部区域]
HidePanel[自动收起面板]
ExecuteTemplate[执行模板]
AutoCollapse[执行后自动收起]
end
LeftPanel --> MainArea
MainArea --> RightPanel
RightPanel --> Toolbar
Toolbar --> ToggleBtn
ToggleBtn --> OverlayPanel
OverlayPanel --> TemplateTree
ClickBtn --> ShowPanel
ShowPanel --> HidePanel
HidePanel --> ClickOutside
TemplateTree --> ExecuteTemplate
ExecuteTemplate --> AutoCollapse
```

**图表来源**
- [AIView.vue](file://med_ai_assistant_1.0_bs_vue/src/views/AIView.vue)
- [PromptTemplates.vue](file://med_ai_assistant_1.0_bs_vue/src/components/ai/PromptTemplates.vue)

### 核心UI重构特性

#### 默认折叠设计
- **初始状态**：模板面板默认处于折叠状态（isTemplatesCollapsed = true）
- **节省空间**：避免遮挡AI标签页的主要内容区域
- **按需展开**：用户主动点击按钮才显示模板面板

#### Overlay下拉面板
- **绝对定位**：使用position: absolute从工具栏按钮正下方展开
- **z-index管理**：设置z-index: 200确保面板在最顶层显示
- **阴影效果**：box-shadow: 0 4px 16px rgba(0,0,0,0.15)提供立体感
- **尺寸限制**：width: 190px, max-height: 70vh，确保良好的视觉比例

#### 展开/收起动画
- **panel-slide过渡**：使用Vue transition实现平滑的展开/收起动画
- **transform-origin**：设置transform-origin: top right，面板从右上角缩放+位移
- **动画时长**：opacity和transform过渡均为0.25秒，提供流畅的用户体验

#### 事件处理机制
- **点击外部关闭**：点击.ai-tabs-container区域自动收起面板
- **模板执行自动收起**：模板执行成功后通过事件通知父组件折叠
- **小屏模式适配**：在小屏模式下自动隐藏模板面板

**章节来源**
- [AIView.vue](file://med_ai_assistant_1.0_bs_vue/src/views/AIView.vue)
- [PromptTemplates.vue](file://med_ai_assistant_1.0_bs_vue/src/components/ai/PromptTemplates.vue)

### 模板树形结构优化

#### Tree组件配置
- **node-key**: 使用id属性作为节点唯一标识
- **expand-on-click-node**: 设置为false，仅点击箭头图标展开/收起
- **props配置**: children: 'children', label: 'name'，简化数据结构

#### 模板分类展示
- **层级结构**：一级节点为模板类型，二级节点为具体模板名称
- **描述信息**：支持显示模板描述信息，提升用户体验
- **点击行为**：一级节点切换展开状态，二级节点触发模板执行

#### 交互增强
- **确认对话框**：执行模板前弹出确认对话框，防止误操作
- **补充信息收集**：对特定模板（如'请会诊记录'、'日常对话'、'转科记录'）收集补充信息
- **执行状态反馈**：显示正在生成Prompt的提示信息

**章节来源**
- [PromptTemplates.vue](file://med_ai_assistant_1.0_bs_vue/src/components/ai/PromptTemplates.vue)

## OpenClaw集成方案

### 整体架构设计

MedAiAssistant系统集成了OpenClaw AI编排引擎，通过REST API实现自然语言驱动的多步骤工作流程编排：

```mermaid
graph TB
subgraph "OpenClaw集成架构"
Frontend[Vue前端界面]
OpenClawGateway[OpenClaw网关]
OpenClawEngine[OpenClaw编排引擎]
Skill1[患者查询技能]
Skill2[查房语音记录技能]
Skill3[MCC/DRG分析技能]
Skill4[数据同步监控技能]
Backend[Spring Boot后端]
Database[(数据库)]
end
Frontend --> OpenClawGateway
OpenClawGateway --> OpenClawEngine
OpenClawEngine --> Skill1
OpenClawEngine --> Skill2
OpenClawEngine --> Skill3
OpenClawEngine --> Skill4
Skill1 --> Backend
Skill2 --> Backend
Skill3 --> Backend
Skill4 --> Backend
Backend --> Database
OpenClawEngine --> Backend
Backend --> OpenClawGateway
OpenClawGateway --> Frontend
```

**图表来源**
- [OpenClaw集成方案-临床场景分析与PoC规划.md](file://med_ai_assistant_1.0_bs_backend/doc/迭代/openclaw/OpenClaw集成方案-临床场景分析与PoC规划.md)

### 临床场景分析

系统基于180+个REST API接口的全面调研，识别出7个适合OpenClaw编排的临床场景：

#### 场景1：查房语音记录
**用户故事**：医生查房时口述内容，系统自动识别、整理、关联患者并保存。

**编排流程**：
1. POST /api/voice/recognize-file → 语音转文字
2. POST /api/ai/response → LLM整理为结构化查房记录
3. POST /api/medicalrecords → 创建病历记录（草稿）

**OpenClaw附加价值**：
- LLM自动理解口述中提到的患者姓名/床号，调用患者查询API关联
- 自动补充患者当前诊断、医嘱等上下文
- 如果口述中提到异常指标，自动触发告警逻辑

#### 场景2：智能MCC/DRG全流程分析
**用户故事**：医生说"帮我分析一下3床病人的DRG编码和可能的并发症"，系统自动完成全链路分析。

**编排流程**：
1. GET /api/patients/by-department → 通过床号找到患者
2. GET /api/patients/{id}/diagnoses → 获取诊断列表
3. POST /api/drg/mcc/screen → MCC预筛选
4. POST /api/drg/mcc/generate-prompt → 生成MCC分析Prompt
5. GET /api/drg/catalog/match → DRG编码匹配
6. GET /api/drg/patient-fee → 查询实际费用
7. POST /api/drg/profit-loss → 计算盈亏

#### 场景3：患者综合情况快速查询
**用户故事**：医生问"12床病人现在情况怎么样？"，系统自动汇总所有关键信息。

**编排流程**：
1. GET /api/patients/by-department → 通过床号定位患者
2. GET /api/patients/{id}/basic-info → 基本信息
3. GET /api/patients/{id}/diagnoses → 当前诊断
4. GET /api/patients/{id}/long-term-orders → 长期医嘱
5. GET /api/patients/{id}/temporary-orders → 临时医嘱
6. GET /api/ai/latestPromptResult → 最近AI分析结果
7. LLM汇总为简明的患者情况摘要

### 场景优先级矩阵

| 场景 | 技术可行性 | 业务价值 | 实现复杂度 | 建议优先级 |
|------|-----------|---------|-----------|----------|
| 查房语音记录 | 高（API已有） | 极高 | 中 | P0 - 首选PoC |
| MCC/DRG全流程分析 | 高（API已有） | 极高 | 中 | P0 |
| 患者综合情况查询 | 高（API已有） | 高 | 低 | P1 |
| AI诊疗辅助 | 高（API已有） | 高 | 中 | P1 |
| 数据同步监控 | 高（API已有） | 中 | 低 | P2 |
| 病历分析转待办 | 高（API已有） | 高 | 中 | P2 |
| 非计划再次手术预警 | 高（API已有） | 中 | 中 | P3 |

### PoC验证计划

#### 前置条件
- 测试服务器需能访问后端API `http://10.120.11.43:8081`
- 测试服务器需有Node.js 22.16+或Node.js 24（推荐）
- 需要一个LLM API Key（如OpenAI、Claude、DeepSeek等）

#### Task 1: 环境准备与OpenClaw安装
```bash
# 检查Node.js版本
node --version

# 如果版本不够，安装Node.js 24
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo bash -
sudo apt-get install -y nodejs

# 全局安装OpenClaw
npm install -g openclaw@latest

# 运行引导式配置（会设置Gateway、LLM provider、工作区等）
openclaw onboard --install-daemon
```

#### Task 2: 编写患者查询Skill
在OpenClaw工作区创建Skill目录：
```bash
mkdir -p ~/.openclaw/skills/med-patient-query
```

创建`~/.openclaw/skills/med-patient-query/SKILL.md`：

```markdown
---
name: med_patient_query
description: 查询医院科室的患者列表，支持按科室名称查询在院病人信息
metadata: {"openclaw": {"requires": {"bins": ["curl", "jq"]}}}
---

# 患者信息查询

当用户询问某个科室的病人列表、患者信息、在院病人等内容时，使用此技能。

## 使用方法

根据用户提供的科室名称，调用医疗AI辅助系统的患者查询接口：

curl -s "http://10.120.11.43:8081/api/patients/by-department?department={科室名}&sync=false" | jq '.'

## 参数说明

- department: 科室名称（如"心内科"、"呼吸内科"等），从用户输入中提取
- sync: 是否同步刷新数据，默认false

## 返回结果处理

将返回的JSON数据整理为易读的患者列表，包含：
- 患者姓名
- 住院号
- 床号
- 入院日期
- 诊断信息

如果查询失败或无数据，告知用户可能的原因（科室名称不正确、服务不可用等）。
```

#### Task 3: 通过REST API验证
核心验证步骤——模拟Spring Boot后端通过HTTP调用OpenClaw：

```bash
curl -X POST http://<openclaw服务器IP>:18789/api/sessions/main/messages \
  -H "Authorization: Bearer your-secret-token-here" \
  -H "Content-Type: application/json" \
  -d '{"message": "查一下心内科的病人列表"}'
```

**章节来源**
- [OpenClaw集成方案-临床场景分析与PoC规划.md](file://med_ai_assistant_1.0_bs_backend/doc/迭代/openclaw/OpenClaw集成方案-临床场景分析与PoC规划.md)

## 依赖分析

### 技术栈依赖关系

系统采用现代化的技术栈，各组件间的依赖关系如下：

```mermaid
graph TB
subgraph "前端技术栈"
Vue[Vue.js 3.x]
ElementUI[Element Plus]
Axios[Axios HTTP客户端]
Vuex[Vuex状态管理]
Router[Vue Router]
OpenClawUI[OpenClaw界面组件]
end
subgraph "后端技术栈"
SpringBoot[Spring Boot 2.x]
SpringWeb[Spring Web MVC]
SpringData[Spring Data JPA]
Security[Spring Security]
MyBatis[MyBatis ORM]
OpenClawService[OpenClaw服务]
end
subgraph "数据库层"
MySQL[MySQL 8.x]
Redis[Redis 6.x]
Elasticsearch[Elasticsearch 7.x]
end
subgraph "容器化"
Docker[Docker 20.x]
Compose[Docker Compose]
Kubernetes[Kubernetes 1.x]
end
subgraph "开发工具"
Maven[Maven 3.x]
Node[Node.js 16.x]
ESLint[ESLint]
Prettier[Prettier]
OpenClawCLI[OpenClaw CLI]
end
Vue --> ElementUI
Vue --> Axios
Vue --> Vuex
Vue --> Router
Vue --> OpenClawUI
SpringBoot --> SpringWeb
SpringBoot --> SpringData
SpringBoot --> Security
SpringBoot --> MyBatis
SpringBoot --> OpenClawService
SpringBoot --> MySQL
SpringBoot --> Redis
SpringBoot --> Elasticsearch
Vue --> Docker
SpringBoot --> Docker
OpenClawService --> OpenClawCLI
Docker --> Compose
Docker --> Kubernetes
Maven --> SpringBoot
Node --> Vue
ESLint --> Vue
Prettier --> Vue
```

**图表来源**
- [pom.xml](file://med_ai_assistant_1.0_bs_backend/pom.xml)

### 部署配置依赖

不同环境下的部署配置具有特定的依赖关系：

```mermaid
graph LR
subgraph "部署配置层次"
BaseConfig[基础配置]
EnvSpecific[环境特定配置]
InstanceSpecific[实例特定配置]
OpenClawConfig[OpenClaw配置]
end
subgraph "环境类型"
Oracle[Oracle数据库环境]
TestServer[测试服务器环境]
Windows[Windows环境]
Linux[Linux环境]
OpenClawEnv[OpenClaw环境]
end
subgraph "配置文件类型"
DockerCompose[Docker Compose配置]
SQLQueries[SQL查询配置]
MemoryBank[内存银行配置]
KnowledgeBase[知识库配置]
OpenClawSkill[OpenClaw技能配置]
end
BaseConfig --> EnvSpecific
EnvSpecific --> InstanceSpecific
EnvSpecific --> OpenClawConfig
EnvSpecific --> Oracle
EnvSpecific --> TestServer
EnvSpecific --> Windows
EnvSpecific --> Linux
EnvSpecific --> OpenClawEnv
InstanceSpecific --> DockerCompose
InstanceSpecific --> SQLQueries
InstanceSpecific --> MemoryBank
InstanceSpecific --> KnowledgeBase
OpenClawConfig --> OpenClawSkill
```

**图表来源**
- [docker-compose-main.yml](file://med_ai_assistant_1.0_bs_backend/deploy/main-linux-oracle/docker-compose-main.yml)
- [docker-compose-execution-linux.yml](file://med_ai_assistant_1.0_bs_backend/deploy/execution-linux/docker-compose-execution-linux.yml)

**章节来源**
- [pom.xml](file://med_ai_assistant_1.0_bs_backend/pom.xml)
- [docker-compose-main.yml](file://med_ai_assistant_1.0_bs_backend/deploy/main-linux-oracle/docker-compose-main.yml)

## 性能考虑

### 系统性能优化策略

1. **数据库性能优化**
   - 查询索引优化
   - 连接池配置调优
   - 缓存策略实施
   - 分页查询优化

2. **前端性能优化**
   - 组件懒加载
   - 图片资源优化
   - CDN加速配置
   - 代码分割策略

3. **后端性能优化**
   - 异步处理机制
   - 并发连接数限制
   - 内存使用优化
   - 网络I/O优化

4. **容器化性能优化**
   - 资源限制配置
   - 健康检查设置
   - 自动扩缩容策略
   - 存储卷优化

5. **OpenClaw性能优化**
   - 技能缓存机制
   - 编排流程优化
   - LLM调用频率控制
   - 并发任务管理

## 故障排除指南

### 常见问题诊断

#### 开发环境问题
1. **端口冲突**
   - 检查端口占用情况
   - 修改配置文件中的端口号
   - 使用netstat命令排查

2. **依赖下载失败**
   - 检查网络连接
   - 配置代理设置
   - 清理本地缓存

3. **数据库连接问题**
   - 验证数据库服务状态
   - 检查连接字符串配置
   - 确认防火墙设置

#### 生产环境问题
1. **应用启动失败**
   - 查看启动日志
   - 检查资源配置
   - 验证依赖完整性

2. **性能问题**
   - 监控系统指标
   - 分析慢查询日志
   - 优化缓存策略

3. **数据一致性问题**
   - 检查事务配置
   - 验证数据同步机制
   - 实施补偿措施

#### Profile依赖链问题
**更新** 新增了针对执行服务器Profile依赖链断裂的故障排除指南

1. **问题现象**
   - 执行服务器启动时Bean依赖注入失败
   - DRG相关服务无法正常初始化
   - 定时任务无法执行

2. **解决方案**
   - 为相关服务类添加@Profile("!execution")注解
   - 确保执行服务器和主服务器的配置隔离
   - 验证Profile配置的正确性

#### OpenClaw集成问题
**新增** 针对OpenClaw集成的故障排除指南

1. **OpenClaw网关连接失败**
   - 检查OpenClaw服务状态
   - 验证Gateway Token配置
   - 确认网络连通性

2. **技能调用失败**
   - 验证技能配置文件
   - 检查后端API可达性
   - 确认LLM API Key有效性

3. **编排流程中断**
   - 查看编排日志
   - 验证技能依赖关系
   - 检查并发限制设置

#### PromptTemplates组件问题
**新增** 针对UI重构后的问题排除指南

1. **Overlay面板不显示**
   - 检查isTemplatesCollapsed状态管理
   - 验证CSS样式类名
   - 确认z-index层级设置

2. **模板执行后不自动收起**
   - 检查template-executed事件触发
   - 验证父组件事件监听
   - 确认状态更新逻辑

3. **动画效果异常**
   - 检查Vue transition配置
   - 验证transform-origin设置
   - 确认CSS过渡时长

**章节来源**
- [.gitignore](file://.gitignore)

## 版本发布历史

### 前端版本更新记录

#### v0.8.021 - v0.8.025
**更新** 新增了版本0.8.025和0.8.024的具体更新内容，以及0.8.021的OpenClaw集成方案

##### v0.8.021 - OpenClaw集成方案引入
**新增功能**
- 配合后端新增OpenClaw集成方案文档，前端无功能变更
- 为后续OpenClaw界面集成做准备

**章节来源**
- [2026-04-11.md](file://med_ai_assistant_1.0_bs_vue/docs/更新日志/2026-04-11.md)

##### v0.8.024 - AI对话功能流式响应改造
**新增功能**
- aiService.js流式响应改造：将stream:false改为stream:true，使用ReadableStream + TextDecoder消费NDJSON流，支持isFinal标识防重复、AbortController超时取消（300秒）
- AIResponse.vue适配流式交互：onData回调支持增量数据处理，新增isFinal检测用完整内容替换累积内容，移除不再需要的OpenAI格式兼容分支

**用户体验改进**
- AI对话功能从一次性加载改为逐字流式显示，大幅减少响应等待时间感知

**变更文件**
- 修改：`src/api/aiService.js`
- 修改：`src/components/ai/AIResponse.vue`

##### v0.8.025 - PromptTemplates组件UI重构
**新增功能**
- PromptTemplates组件UI重构：模板列表改为overlay下拉面板，默认折叠，右上角按钮展开
- 执行模板后自动收起：通过template-executed事件实现自动折叠
- AIView.vue集成Overlay面板：实现完整的展开/收起交互逻辑
- PromptList.vue优化：改进Prompt列表显示和交互体验

**用户体验改进**
- 模板面板默认折叠，节省界面空间
- Overlay面板提供更好的视觉层次
- 执行后自动收起，提升操作效率
- 展开/收起动画提供流畅的用户体验

**变更文件**
- 修改：`src/components/ai/PromptTemplates.vue`
- 修改：`src/views/AIView.vue`
- 修改：`src/components/ai/PromptList.vue`

#### v0.8.022 - AI辅助页面诊断卡片组件
**新增功能**
- 新增诊断概览卡片组件（DiagnosisCard.vue），当Prompt标题包含"诊断分析"时自动展示
- 卡片左右分栏布局：左侧显示从AI结果中提取的诊断列表，右侧显示选中诊断的详细分析（诊断依据、鉴别诊断、补充说明等）
- 诊断分析类Prompt的AI结果区域支持折叠/展开，默认折叠，减少页面信息量

**代码重构**
- 新增诊断解析工具函数（diagnosisParser.js），统一提取诊断名称和完整诊断块的逻辑
- AIResults.vue和DiagnosisEditDialog.vue中的重复诊断提取代码替换为工具函数调用，消除约52行重复代码

**Bug修复**
- 修复diagnosisParser.js中正则表达式lookahead `(?=###|$)` 误匹配四级标题（####）导致诊断列表区块被截断为空的问题

**变更文件**
- 新增：`src/components/ai/DiagnosisCard.vue`
- 新增：`src/utils/diagnosisParser.js`
- 修改：`src/components/ai/AIResults.vue`
- 修改：`src/components/patient/DiagnosisEditDialog.vue`

#### v0.7.018 - v0.7.023
**更新** 完善了之前的版本更新记录

##### v0.7.018 - v0.7.023
- 修复执行服务器Profile依赖链断裂问题
- 恢复前端源码文件和构建脚本
- 新增服务器日志查看功能
- 集成eruda前端调试面板

##### v0.7.020 - v0.7.022
- 修复EMR病历同步唯一约束冲突
- 优化病历记录修改接口
- 改进音频测试工具

##### v0.7.022 - v0.7.023
- 完善前端构建流程
- 修复bat文件编码问题

### 后端版本更新记录

#### v0.8.021 - OpenClaw集成方案引入
**新增功能**
- 新增OpenClaw集成方案文档，基于系统已有180+个REST API接口的全面调研
- 识别出7个适合OpenClaw编排的临床场景
- 制定PoC部署验证计划，设计Spring Boot通过REST API调用OpenClaw Gateway的集成架构
- 定义场景优先级矩阵和四阶段扩展路线

**新增文件**
- `doc/迭代/openclaw/OpenClaw集成方案-临床场景分析与PoC规划.md`
- `pom.xml`（版本号更新至0.8.021）

**章节来源**
- [2026-04-11.md](file://med_ai_assistant_1.0_bs_backend/doc/更新日志/2026-04-11.md)

#### v0.8.016 - v0.8.020
**更新** 完善了之前的版本更新记录

##### v0.8.016 - Prompt状态循环重置修复
**Bug修复**
- 修复PromptResult软删除导致Prompt状态循环重置问题
- 问题描述：用户软删除PromptResult（deleted=1）后，补偿机制`checkDataConsistency()`误判为数据丢失，将Prompt从"已完成"重置为"已提交"，导致循环重新提交
- 修复方案：修改`PromptRepository.findIncompleteCompleted()`查询，移除`AND pr.deleted = 0`条件，仅在完全不存在任何PromptResult记录时才判定为数据丢失

##### v0.8.017 - 开发环境维护更新
**维护更新**
- 清理AI工具临时文件：删除.qoder/目录下的review_diff.txt、promptresult_fix_diff.txt、PromptPollingService.diff等临时差异文件
- 提交遗留配置变更：提交后端.dockerignore配置变更
- 补充代码注释：为PromptRepository.findIncompleteCompleted()方法补充完整的Javadoc注释

##### v0.8.018 - 开发环境禁用定时Prompt生成任务
**变更内容**
- 在`TimerPromptGenerator`的`dailyPromptGeneration()`和`generateNoonWardRoundPrompts()`定时任务方法中添加启用状态检查
- 新增配置项`scheduling.timer.enabled`，开发环境默认设置为`false`（禁用）
- 生产环境不受影响，代码默认值为`true`（启用）

##### v0.8.019 - Prompt数据一致性检查ResultId回填修复
**Bug修复**
- 修复`checkDataConsistency()`对PromptResult软删除场景的处理逻辑
- 问题描述：当Prompt状态为"已完成"但ResultId为NULL，且PromptResult记录全部被软删除(deleted=1)时，补偿机制仅"跳过重置"但不回填ResultId，导致每次轮询都重复检测到该不一致记录，浪费服务器资源
- 修复方案：将`checkDataConsistency()`改为三路径修复逻辑

##### v0.8.020 - EMR记录详情查询修复
**Bug修复**
- 修复EMR记录详情查询返回多条结果导致`IncorrectResultSizeDataAccessException`异常
- `EmrContentRepository.findContentById`返回类型从`String`改为`List<String>`
- 添加`ORDER BY modifiedOn DESC NULLS LAST`排序，多条记录时优先返回最新修改记录
- `EmrRecordService.getEmrRecordContentById`适配List返回，多条记录时记录WARN日志

**章节来源**
- [2026-04-11.md](file://med_ai_assistant_1.0_bs_backend/doc/更新日志/2026-04-11.md)
- [2026-04-14.md](file://med_ai_assistant_1.0_bs_backend/doc/更新日志/2026-04-14.md)
- [2026-04-13.md](file://med_ai_assistant_1.0_bs_backend/doc/更新日志/2026-04-13.md)

## 结论

MedAiAssistant项目展现了现代医疗AI系统的完整架构设计，通过前后端分离、容器化部署、多环境配置管理等技术手段，实现了高可用性、可扩展性和易维护性的系统目标。

项目的核心优势包括：
- 标准化的开发流程和质量保证体系
- 灵活的配置管理和多环境支持
- 完善的监控和日志管理机制
- 友好的开发者体验和工具链支持
- **新增**：OpenClaw AI编排引擎集成，通过自然语言驱动多步骤API编排

**更新亮点**：
- **流式响应技术**：AI对话功能实现真正的流式响应，显著提升用户体验
- **诊断编辑集成**：诊断编辑面板内嵌到AI结果页面，提供更直观的操作体验
- **组件化架构**：诊断卡片和编辑面板等组件化设计，便于维护和扩展
- **性能优化**：通过流式处理和组件优化，系统响应速度和资源利用率得到提升
- **AI编排集成**：OpenClaw集成方案为系统提供智能化的工作流程自动化能力
- **UI重构升级**：PromptTemplates组件采用Overlay下拉面板设计，提供现代化的用户体验

**PromptTemplates组件UI重构价值**：
- **空间优化**：默认折叠设计节省界面空间，避免遮挡主要内容
- **交互提升**：Overlay面板提供更好的视觉层次和用户体验
- **操作效率**：执行后自动收起，减少用户操作步骤
- **动画体验**：panel-slide过渡动画提供流畅的视觉反馈
- **响应式设计**：适配不同屏幕尺寸，提升移动端体验

**OpenClaw集成价值**：
- **自然语言驱动**：通过自然语言指令触发复杂的多步骤工作流程
- **技能编排**：将现有的180+个API接口通过技能进行编排组合
- **智能决策**：利用LLM理解用户意图，自动选择合适的技能组合
- **扩展性强**：支持四阶段扩展路线，从PoC验证到全面集成

未来的发展方向将重点关注AI模型的持续优化、系统性能的进一步提升、用户体验的不断改善，以及OpenClaw编排能力的深入应用。

## 附录

### 开发环境快速启动

1. **后端服务启动**
   ```bash
   # 在项目根目录执行
   ./mvn.bat
   ```

2. **前端服务启动**
   ```bash
   # 在项目根目录执行
   ./npm.bat
   ```

3. **OpenClaw环境启动**
   ```bash
   # 在OpenClaw服务器上执行
   openclaw gateway --port 18789 --verbose
   ```

4. **环境变量配置**
   - 设置JAVA_OPTS参数
   - 配置数据库连接信息
   - 指定日志输出目录
   - 配置OpenClaw Gateway Token

### 部署配置说明

1. **Docker容器编排**
   - 使用docker-compose管理多容器应用
   - 支持不同环境的配置切换
   - 实现服务发现和负载均衡

2. **数据库迁移**
   - 支持版本化的数据库变更
   - 提供回滚机制
   - 确保数据一致性

3. **监控和告警**
   - 集成Prometheus监控
   - 配置Grafana可视化
   - 设置告警规则和通知

4. **OpenClaw部署**
   - 配置OpenClaw Gateway服务
   - 设置技能目录和配置
   - 验证LLM API连接

### 版本管理最佳实践

1. **版本号规范**
   - 主版本号：重大功能更新
   - 次版本号：新功能添加
   - 修订号：bug修复和小改进

2. **更新日志维护**
   - 按日期记录所有变更
   - 详细描述功能改进
   - 提供问题修复说明

3. **发布流程**
   - 代码审查和测试
   - 更新文档和示例
   - 正式发布和通知

### 新功能使用指南

#### PromptTemplates组件使用
1. **展开模板面板**
   - 点击右上角"Prompt模板"按钮展开Overlay面板
   - 面板默认折叠，节省界面空间

2. **选择模板执行**
   - 在模板树形结构中选择具体模板
   - 点击二级节点执行模板
   - 模板执行成功后自动收起面板

3. **模板分类浏览**
   - 一级节点显示模板类型
   - 二级节点显示具体模板名称
   - 支持模板描述信息查看

#### 诊断编辑面板使用
1. **打开诊断编辑面板**
   - 在AI结果页面中查看诊断分析结果
   - 点击"显示列表"按钮打开诊断编辑面板

2. **编辑AI诊断**
   - 双击AI诊断名称进入编辑模式
   - 直接修改诊断文本
   - 点击保存按钮确认修改

3. **管理目前诊断**
   - 在右侧"目前诊断"标签页查看现有诊断
   - 选中诊断后点击"保存"按钮更新
   - 使用"删除"按钮移除不需要的诊断

#### 流式响应体验
1. **AI对话交互**
   - 在AI对话框中输入问题
   - 等待AI逐步生成回复
   - 实时看到AI的思考过程

2. **性能优势**
   - 响应延迟大幅降低
   - 实时内容更新
   - 更流畅的交互体验

#### OpenClaw编排使用
1. **自然语言交互**
   - 在OpenClaw界面输入自然语言指令
   - 系统自动识别意图并选择合适技能
   - 观察编排流程的执行进度

2. **技能监控**
   - 查看技能调用日志
   - 监控API调用状态
   - 处理编排过程中的异常

**章节来源**
- [PromptTemplates.vue](file://med_ai_assistant_1.0_bs_vue/src/components/ai/PromptTemplates.vue)
- [AIView.vue](file://med_ai_assistant_1.0_bs_vue/src/views/AIView.vue)
- [aiService.js](file://med_ai_assistant_1.0_bs_vue/src/api/aiService.js)
- [AIResponse.vue](file://med_ai_assistant_1.0_bs_vue/src/components/ai/AIResponse.vue)
- [OpenClaw集成方案-临床场景分析与PoC规划.md](file://med_ai_assistant_1.0_bs_backend/doc/迭代/openclaw/OpenClaw集成方案-临床场景分析与PoC规划.md)