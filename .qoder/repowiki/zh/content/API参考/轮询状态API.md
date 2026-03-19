# 轮询状态API

<cite>
**本文引用的文件**
- [系统管理接口.md](file://med_ai_assistant_1.0_bs_backend/doc/接口/系统管理接口.md)
- [常用.txt](file://项目相关/常用.txt)
- [Docker部署.md](file://med_ai_assistant_1.0_bs_backend/doc/布署/Docker部署.md)
- [接口文档索引.md](file://med_ai_assistant_1.0_bs_backend/doc/接口/接口文档索引.md)
- [2026-03-01.md](file://med_ai_assistant_1.0_bs_backend/doc/更新日志/2026-03-01.md)
- [2025-11-27-更新日志.md](file://med_ai_assistant_1.0_bs_backend/doc/更新日志/2025-11-27-更新日志.md)
- [check-execution-server.bat](file://med_ai_assistant_1.0_bs_backend/deploy/execution-windows/check-execution-server.bat)
- [deploy.sh](file://med_ai_assistant_1.0_bs_backend/deploy/main-linux-oracle/deploy.sh)
- [diagnose-main-server.sh](file://med_ai_assistant_1.0_bs_backend/deploy/main-linux-oracle/diagnose-main-server.sh)
</cite>

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
本文件面向MedAiAssistant 1.0 BS的轮询状态查询API，聚焦于轮询状态检查端点“/api/polling/status”。该接口用于获取轮询服务的运行状态，包括是否启用、轮询间隔、最近一次轮询时间与下一次轮询时间等信息。文档将详细说明：
- 接口定义与请求/响应规范
- 状态码含义与超时处理机制
- 轮询间隔设置与状态计算逻辑
- 客户端轮询实现示例、重试策略与断线重连方案
- 与系统其他组件的集成关系与依赖

## 项目结构
围绕轮询状态API的相关文件主要分布在后端文档与部署脚本中，具体如下：
- 文档层：接口文档与部署文档
- 部署层：Windows/Linux部署脚本与诊断脚本
- 命令示例：常用命令与轮询状态检查示例

```mermaid
graph TB
A["后端文档<br/>doc/接口/系统管理接口.md"] --> B["轮询状态接口定义<br/>/api/polling/status"]
C["部署脚本<br/>deploy/main-linux-oracle/deploy.sh"] --> D["轮询状态检查命令示例"]
E["诊断脚本<br/>deploy/main-linux-oracle/diagnose-main-server.sh"] --> F["轮询状态诊断输出"]
G["常用命令<br/>项目相关/常用.txt"] --> H["轮询状态检查示例"]
I["Docker部署文档<br/>doc/布署/Docker部署.md"] --> J["轮询状态检查命令示例"]
```

**图表来源**
- [系统管理接口.md](file://med_ai_assistant_1.0_bs_backend/doc/接口/系统管理接口.md#L660-L727)
- [deploy.sh](file://med_ai_assistant_1.0_bs_backend/deploy/main-linux-oracle/deploy.sh#L119-L119)
- [diagnose-main-server.sh](file://med_ai_assistant_1.0_bs_backend/deploy/main-linux-oracle/diagnose-main-server.sh#L105-L105)
- [常用.txt](file://项目相关/常用.txt#L78-L78)
- [Docker部署.md](file://med_ai_assistant_1.0_bs_backend/doc/布署/Docker部署.md#L79-L79)

**章节来源**
- [系统管理接口.md](file://med_ai_assistant_1.0_bs_backend/doc/接口/系统管理接口.md#L660-L727)
- [deploy.sh](file://med_ai_assistant_1.0_bs_backend/deploy/main-linux-oracle/deploy.sh#L119-L119)
- [diagnose-main-server.sh](file://med_ai_assistant_1.0_bs_backend/deploy/main-linux-oracle/diagnose-main-server.sh#L105-L105)
- [常用.txt](file://项目相关/常用.txt#L78-L78)
- [Docker部署.md](file://med_ai_assistant_1.0_bs_backend/doc/布署/Docker部署.md#L79-L79)

## 核心组件
- 接口定义与职责
  - 接口路径：/api/polling/status
  - 方法：GET
  - 功能：获取轮询服务的运行状态（是否启用、轮询间隔、最近一次轮询时间、下一次轮询时间）
- 响应格式与字段
  - enabled：布尔值，表示轮询服务是否启用
  - pollingInterval：整数，轮询间隔（秒）
  - lastPolling：字符串，ISO 8601时间戳，最近一次轮询时间
  - nextPolling：字符串，ISO 8601时间戳，下一次轮询时间
- 相关文件
  - 系统管理接口文档：包含接口路径、功能说明、请求参数、响应格式、逻辑与示例
  - 接口索引：列出轮询相关接口路径
  - 更新日志：记录接口演进与等效路径对照

**章节来源**
- [系统管理接口.md](file://med_ai_assistant_1.0_bs_backend/doc/接口/系统管理接口.md#L660-L727)
- [接口文档索引.md](file://med_ai_assistant_1.0_bs_backend/doc/接口/接口文档索引.md#L72-L73)
- [2026-03-01.md](file://med_ai_assistant_1.0_bs_backend/doc/更新日志/2026-03-01.md#L46-L47)

## 架构总览
轮询状态API属于后端系统管理接口的一部分，通常由控制器负责接收HTTP请求，调用服务层获取轮询配置与状态信息，最终返回JSON响应。部署脚本与诊断脚本展示了该接口在实际运维中的使用方式。

```mermaid
graph TB
subgraph "客户端"
U["浏览器/脚本/工具"]
end
subgraph "后端服务"
R["轮询状态控制器<br/>/api/polling/status"]
S["轮询服务<br/>轮询配置与状态"]
end
subgraph "运维与监控"
D["部署脚本<br/>轮询状态检查"]
X["诊断脚本<br/>轮询状态诊断"]
end
U --> R
R --> S
D --> R
X --> R
```

**图表来源**
- [系统管理接口.md](file://med_ai_assistant_1.0_bs_backend/doc/接口/系统管理接口.md#L660-L727)
- [deploy.sh](file://med_ai_assistant_1.0_bs_backend/deploy/main-linux-oracle/deploy.sh#L119-L119)
- [diagnose-main-server.sh](file://med_ai_assistant_1.0_bs_backend/deploy/main-linux-oracle/diagnose-main-server.sh#L105-L105)

## 详细组件分析

### 接口定义与行为
- 接口路径：/api/polling/status
- 方法：GET
- 请求参数：无
- 响应格式：JSON对象，包含enabled、pollingInterval、lastPolling、nextPolling等字段
- 业务逻辑：
  1) 查询轮询服务配置状态
  2) 返回服务信息

```mermaid
sequenceDiagram
participant C as "客户端"
participant API as "轮询状态接口<br/>/api/polling/status"
participant SVC as "轮询服务"
C->>API : "GET /api/polling/status"
API->>SVC : "查询轮询配置与状态"
SVC-->>API : "返回状态数据"
API-->>C : "JSON响应enabled/pollingInterval/lastPolling/nextPolling"
```

**图表来源**
- [系统管理接口.md](file://med_ai_assistant_1.0_bs_backend/doc/接口/系统管理接口.md#L660-L727)

**章节来源**
- [系统管理接口.md](file://med_ai_assistant_1.0_bs_backend/doc/接口/系统管理接口.md#L660-L727)

### 响应字段说明
- enabled：布尔值，表示轮询服务是否启用
- pollingInterval：整数，轮询间隔（秒）
- lastPolling：字符串，ISO 8601时间戳，最近一次轮询时间
- nextPolling：字符串，ISO 8601时间戳，下一次轮询时间

**章节来源**
- [系统管理接口.md](file://med_ai_assistant_1.0_bs_backend/doc/接口/系统管理接口.md#L660-L727)

### 状态码与超时处理
- 状态码
  - 200 OK：请求成功，返回轮询状态
  - 500 Internal Server Error：服务内部错误
- 超时处理
  - 客户端应在请求中设置合理的超时时间，避免长时间阻塞
  - 若网络异常或服务不可达，建议采用指数退避重试策略

**章节来源**
- [系统管理接口.md](file://med_ai_assistant_1.0_bs_backend/doc/接口/系统管理接口.md#L660-L727)

### 轮询间隔设置与状态计算
- 轮询间隔设置
  - pollingInterval字段表示轮询周期（秒），用于客户端决定下一次轮询的时间点
- 状态计算逻辑
  - lastPolling与nextPolling基于当前时间与轮询间隔计算得出
  - nextPolling = lastPolling + pollingInterval（单位：秒）

```mermaid
flowchart TD
Start(["开始"]) --> GetCfg["获取轮询配置<br/>enabled/pollingInterval"]
GetCfg --> CalcLast["确定最近一次轮询时间<br/>lastPolling"]
CalcLast --> CalcNext["计算下一次轮询时间<br/>nextPolling = lastPolling + pollingInterval"]
CalcNext --> Resp["返回JSON响应"]
Resp --> End(["结束"])
```

**图表来源**
- [系统管理接口.md](file://med_ai_assistant_1.0_bs_backend/doc/接口/系统管理接口.md#L660-L727)

**章节来源**
- [系统管理接口.md](file://med_ai_assistant_1.0_bs_backend/doc/接口/系统管理接口.md#L660-L727)

### 客户端轮询实现示例与最佳实践
- 实现要点
  - 使用GET方法访问“/api/polling/status”
  - 解析响应中的enabled、pollingInterval、lastPolling、nextPolling字段
  - 根据pollingInterval设置定时器，按需发起下一次轮询
- 重试策略
  - 建议采用指数退避（如1s、2s、4s、8s…上限至30s）
  - 最大重试次数建议为5-10次，避免无限重试导致资源浪费
- 断线重连
  - 当连接失败或超时时，记录失败原因与时间
  - 在网络恢复后自动恢复轮询，必要时回溯lastPolling以确保不遗漏
- 取消与停止
  - 当任务完成或用户取消时，及时停止轮询定时器，释放资源

**章节来源**
- [系统管理接口.md](file://med_ai_assistant_1.0_bs_backend/doc/接口/系统管理接口.md#L660-L727)

### 与系统其他组件的关系
- 与执行服务器状态检查的关系
  - 部署脚本中存在对执行服务器轮询状态的检查命令，表明轮询状态API是系统可观测性的重要组成部分
- 与诊断脚本的配合
  - 诊断脚本会调用轮询状态接口以辅助问题定位与排障

**章节来源**
- [check-execution-server.bat](file://med_ai_assistant_1.0_bs_backend/deploy/execution-windows/check-execution-server.bat#L49-L54)
- [diagnose-main-server.sh](file://med_ai_assistant_1.0_bs_backend/deploy/main-linux-oracle/diagnose-main-server.sh#L105-L105)

## 依赖关系分析
- 接口路径对照与等效性
  - /api/polling/status 与 /api/execution-server/polling-status 等效
  - /api/polling/detailed-status 与 /api/prompts/status 部分等效
- 文档索引与版本演进
  - 接口索引文档列出了轮询相关接口路径
  - 更新日志记录了接口演进与等效路径对照，便于迁移与兼容

```mermaid
graph LR
A["/api/polling/status"] --> B["等效路径<br/>/api/execution-server/polling-status"]
C["/api/polling/detailed-status"] --> D["部分等效路径<br/>/api/prompts/status"]
```

**图表来源**
- [接口文档索引.md](file://med_ai_assistant_1.0_bs_backend/doc/接口/接口文档索引.md#L72-L73)
- [2026-03-01.md](file://med_ai_assistant_1.0_bs_backend/doc/更新日志/2026-03-01.md#L46-L47)

**章节来源**
- [接口文档索引.md](file://med_ai_assistant_1.0_bs_backend/doc/接口/接口文档索引.md#L72-L73)
- [2026-03-01.md](file://med_ai_assistant_1.0_bs_backend/doc/更新日志/2026-03-01.md#L46-L47)

## 性能考虑
- 轮询频率与负载
  - 合理设置pollingInterval，避免过于频繁的轮询造成不必要的负载
- 超时与并发
  - 客户端应设置合理的超时时间，防止阻塞影响用户体验
- 缓存与去抖
  - 对于短时间内的重复查询，可在客户端做简单缓存或去抖处理

## 故障排查指南
- 常见问题
  - 无法访问接口：检查服务端口与网络连通性
  - 响应为空或异常：确认轮询服务已启动且配置正确
- 运维命令与脚本
  - 使用curl命令检查轮询状态
  - 部署脚本与诊断脚本提供了轮询状态检查与诊断输出示例
- 日志与监控
  - 结合诊断脚本输出与日志，定位轮询状态异常的原因

**章节来源**
- [常用.txt](file://项目相关/常用.txt#L78-L78)
- [Docker部署.md](file://med_ai_assistant_1.0_bs_backend/doc/布署/Docker部署.md#L79-L79)
- [deploy.sh](file://med_ai_assistant_1.0_bs_backend/deploy/main-linux-oracle/deploy.sh#L119-L119)
- [diagnose-main-server.sh](file://med_ai_assistant_1.0_bs_backend/deploy/main-linux-oracle/diagnose-main-server.sh#L105-L105)

## 结论
轮询状态API“/api/polling/status”为系统可观测性提供了简洁而关键的能力，客户端可通过该接口了解轮询服务的启用状态与时间安排，从而制定合理的轮询策略与重试机制。结合部署与诊断脚本，可有效支撑系统的稳定运行与快速排障。

## 附录
- 相关文件清单
  - 系统管理接口文档：包含接口路径、功能说明、请求参数、响应格式、逻辑与示例
  - 接口索引文档：列出轮询相关接口路径
  - 更新日志：记录接口演进与等效路径对照
  - 部署与诊断脚本：提供轮询状态检查与诊断输出示例
  - 常用命令与Docker部署文档：提供轮询状态检查命令示例

**章节来源**
- [系统管理接口.md](file://med_ai_assistant_1.0_bs_backend/doc/接口/系统管理接口.md#L660-L727)
- [接口文档索引.md](file://med_ai_assistant_1.0_bs_backend/doc/接口/接口文档索引.md#L72-L73)
- [2026-03-01.md](file://med_ai_assistant_1.0_bs_backend/doc/更新日志/2026-03-01.md#L46-L47)
- [2025-11-27-更新日志.md](file://med_ai_assistant_1.0_bs_backend/doc/更新日志/2025-11-27-更新日志.md#L89-L113)
- [check-execution-server.bat](file://med_ai_assistant_1.0_bs_backend/deploy/execution-windows/check-execution-server.bat#L49-L54)
- [deploy.sh](file://med_ai_assistant_1.0_bs_backend/deploy/main-linux-oracle/deploy.sh#L119-L119)
- [diagnose-main-server.sh](file://med_ai_assistant_1.0_bs_backend/deploy/main-linux-oracle/diagnose-main-server.sh#L105-L105)
- [常用.txt](file://项目相关/常用.txt#L78-L78)
- [Docker部署.md](file://med_ai_assistant_1.0_bs_backend/doc/布署/Docker部署.md#L79-L79)