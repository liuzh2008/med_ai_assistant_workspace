# 数据库操作

<cite>
**本文档引用的文件**
- [DRG数据导入SQL Developer操作指南.md](file://med_ai_assistant_1.0_bs_backend/doc/数据库操作/DRG数据导入SQL Developer操作指南.md)
- [DRG分析结果表创建脚本.sql](file://med_ai_assistant_1.0_bs_backend/sql-scripts/create-drg-analysis-results-table.sql)
- [DRG分析输入快照表.sql](file://med_ai_assistant_1.0_bs_backend/sql-scripts/drg_analysis_input_snapshot.sql)
- [DRG分析输入快照存储过程.sql](file://med_ai_assistant_1.0_bs_backend/sql-scripts/gen_drg_input_snapshot_procedure.sql)
- [Oracle IDENTITY策略支持脚本.sql](file://med_ai_assistant_1.0_bs_backend/sql-scripts/create-identity-sequences.sql)
- [添加DRG编码列脚本.sql](file://med_ai_assistant_1.0_bs_backend/sql-scripts/add-drg-code-column.sql)
- [添加保险支付标准字段脚本.sql](file://med_ai_assistant_1.0_bs_backend/sql-scripts/add-insurance-payment-standard-column.sql)
- [同步日志表脚本.sql](file://med_ai_assistant_1.0_bs_backend/sql-scripts/create-sync-log-table.sql)
- [状态转换历史表脚本.sql](file://med_ai_assistant_1.0_bs_backend/sql-scripts/create-status-transition-history-table.sql)
- [ENCRYPTED_DATA_TEMP唯一约束脚本.sql](file://med_ai_assistant_1.0_bs_backend/sql-scripts/add-request-id-unique-constraint.sql)
- [数据库初始化脚本.sql](file://med_ai_assistant_1.0_bs_backend/init.sql)
</cite>

## 目录
1. [简介](#简介)
2. [项目结构](#项目结构)
3. [核心组件](#核心组件)
4. [架构概览](#架构概览)
5. [详细组件分析](#详细组件分析)
6. [依赖关系分析](#依赖关系分析)
7. [性能考虑](#性能考虑)
8. [故障排除指南](#故障排除指南)
9. [结论](#结论)

## 简介

本文档全面介绍了MedAiAssistant项目的数据库操作体系，涵盖了Oracle和MySQL双数据库支持、DRG数据分析、数据同步、状态管理等核心数据库功能。项目采用分层架构设计，通过存储过程、序列、触发器等数据库特性实现高性能的数据处理和状态管理。

## 项目结构

项目采用模块化组织方式，数据库相关文件主要分布在以下目录：

```mermaid
graph TB
subgraph "数据库操作目录结构"
A[doc/数据库操作/] --> A1[DRG数据导入操作指南.md]
B[sql-scripts/] --> B1[DRG分析结果表.sql]
B --> B2[DRG分析输入快照.sql]
B --> B3[DRG分析输入快照存储过程.sql]
B --> B4[Oracle IDENTITY策略支持.sql]
B --> B5[添加DRG编码列.sql]
B --> B6[添加保险支付标准字段.sql]
B --> B7[同步日志表.sql]
B --> B8[状态转换历史表.sql]
B --> B9[ENCRYPTED_DATA_TEMP唯一约束.sql]
C[init.sql] --> C1[数据库初始化脚本]
end
```

**图表来源**
- [DRG数据导入SQL Developer操作指南.md:1-246](file://med_ai_assistant_1.0_bs_backend/doc/数据库操作/DRG数据导入SQL Developer操作指南.md#L1-L246)
- [DRG分析结果表创建脚本.sql:1-188](file://med_ai_assistant_1.0_bs_backend/sql-scripts/create-drg-analysis-results-table.sql#L1-L188)

**章节来源**
- [DRG数据导入SQL Developer操作指南.md:1-246](file://med_ai_assistant_1.0_bs_backend/doc/数据库操作/DRG数据导入SQL Developer操作指南.md#L1-L246)
- [Oracle IDENTITY策略支持脚本.sql:1-741](file://med_ai_assistant_1.0_bs_backend/sql-scripts/create-identity-sequences.sql#L1-L741)

## 核心组件

### DRG分析系统

DRG分析系统是项目的核心数据库组件，包含完整的分析流程和数据管理机制：

```mermaid
classDiagram
class DRG分析结果表 {
+RESULT_ID : 主键
+PATIENT_ID : 患者ID
+DRG_ID : DRG记录ID
+DRG_CODE : DRG编码
+MAIN_DIAGNOSES : 诊断信息(CLOB)
+MAIN_PROCEDURES : 手术信息(CLOB)
+USER_SELECTED_MCC_TYPE : 并发症类型
+FINAL_DRG_CODE : 最终DRG编码
+CREATED_TIME : 创建时间
+DELETED : 软删除标志
+PROMPT_ID : Prompt记录ID
+PROMPT_RESULT_ID : PromptResult记录ID
+PRIMARY_DIAGNOSIS : 主要诊断
+PRIMARY_PROCEDURE : 主要手术
}
class DRG分析输入快照表 {
+SNAPSHOT_ID : 快照ID
+PATIENT_ID : 患者ID
+DIAGNOSIS_IDS_JSON : 诊断ID集合
+SURGERY_IDS_JSON : 手术ID集合
+DIAG_COUNT : 诊断集合大小
+PROC_COUNT : 手术集合大小
+CATALOG_VERSION : 目录版本
+PROMPT_ID : 关联Prompt记录ID
+PROMPT_RESULT_ID : 关联PromptResult记录ID
+CREATED_TIME : 创建时间
+VERSION : 版本
+DELETED : 软删除标记
}
class DRG分析输入快照存储过程 {
+gen_drg_input_snapshot()
+参数验证
+集合比较
+快照创建
+重复分析避免
}
DRG分析结果表 --> DRG分析输入快照表 : "关联"
DRG分析输入快照存储过程 --> DRG分析输入快照表 : "创建"
```

**图表来源**
- [DRG分析结果表创建脚本.sql:4-76](file://med_ai_assistant_1.0_bs_backend/sql-scripts/create-drg-analysis-results-table.sql#L4-L76)
- [DRG分析输入快照表.sql:14-27](file://med_ai_assistant_1.0_bs_backend/sql-scripts/drg_analysis_input_snapshot.sql#L14-L27)
- [DRG分析输入快照存储过程.sql:18-117](file://med_ai_assistant_1.0_bs_backend/sql-scripts/gen_drg_input_snapshot_procedure.sql#L18-L117)

### 数据同步管理系统

系统提供完整的数据同步和状态管理功能：

```mermaid
erDiagram
SYNC_LOG {
NUMBER ID PK
VARCHAR2 HOSPITAL_ID
VARCHAR2 SYNC_TYPE
TIMESTAMP START_TIME
TIMESTAMP END_TIME
VARCHAR2 STATUS
NUMBER RECORDS_SYNCED
VARCHAR2 ERROR_MESSAGE
TIMESTAMP CREATED_AT
TIMESTAMP UPDATED_AT
}
STATUS_TRANSITION_HISTORY {
NUMBER ID PK
NUMBER PROMPT_ID
VARCHAR2 FROM_STATUS
VARCHAR2 TO_STATUS
VARCHAR2 REASON
VARCHAR2 OPERATOR_INFO
TIMESTAMP TRANSITION_TIME
NUMBER DURATION_MS
NUMBER SUCCESS
VARCHAR2 ERROR_MESSAGE
NUMBER VERSION_AT_TIME
CLOB CONTEXT_INFO
}
DRG_ANALYSIS_RESULTS {
NUMBER RESULT_ID PK
VARCHAR2 PATIENT_ID
NUMBER DRG_ID
VARCHAR2 DRG_CODE
CLOB MAIN_DIAGNOSES
CLOB MAIN_PROCEDURES
VARCHAR2 USER_SELECTED_MCC_TYPE
VARCHAR2 FINAL_DRG_CODE
TIMESTAMP CREATED_TIME
NUMBER DELETED
NUMBER PROMPT_ID
NUMBER PROMPT_RESULT_ID
VARCHAR2 PRIMARY_DIAGNOSIS
VARCHAR2 PRIMARY_PROCEDURE
}
SYNC_LOG ||--o{ STATUS_TRANSITION_HISTORY : "记录同步状态"
DRG_ANALYSIS_RESULTS ||--o{ STATUS_TRANSITION_HISTORY : "关联状态历史"
```

**图表来源**
- [同步日志表脚本.sql:13-24](file://med_ai_assistant_1.0_bs_backend/sql-scripts/create-sync-log-table.sql#L13-L24)
- [状态转换历史表脚本.sql:13-26](file://med_ai_assistant_1.0_bs_backend/sql-scripts/create-status-transition-history-table.sql#L13-L26)

**章节来源**
- [DRG分析结果表创建脚本.sql:1-188](file://med_ai_assistant_1.0_bs_backend/sql-scripts/create-drg-analysis-results-table.sql#L1-L188)
- [DRG分析输入快照表.sql:1-58](file://med_ai_assistant_1.0_bs_backend/sql-scripts/drg_analysis_input_snapshot.sql#L1-L58)
- [DRG分析输入快照存储过程.sql:1-119](file://med_ai_assistant_1.0_bs_backend/sql-scripts/gen_drg_input_snapshot_procedure.sql#L1-L119)

## 架构概览

系统采用分层架构设计，数据库层提供核心数据存储和处理能力：

```mermaid
graph TB
subgraph "应用层"
A[前端应用]
B[后端服务]
end
subgraph "数据库层"
subgraph "Oracle数据库"
C[DRG分析结果表]
D[DRG分析输入快照表]
E[状态转换历史表]
F[同步日志表]
end
subgraph "MySQL数据库"
G[初始化数据库]
H[系统配置表]
I[版本管理表]
end
end
subgraph "存储过程层"
J[DRG分析输入快照存储过程]
K[序列和触发器管理]
end
A --> B
B --> C
B --> D
B --> E
B --> F
B --> G
B --> H
B --> I
J --> D
K --> C
K --> D
K --> E
K --> F
```

**图表来源**
- [Oracle IDENTITY策略支持脚本.sql:1-741](file://med_ai_assistant_1.0_bs_backend/sql-scripts/create-identity-sequences.sql#L1-L741)
- [数据库初始化脚本.sql:1-119](file://med_ai_assistant_1.0_bs_backend/init.sql#L1-L119)

## 详细组件分析

### DRG数据导入系统

DRG数据导入系统提供了完整的数据处理和验证机制：

```mermaid
sequenceDiagram
participant U as 用户
participant SD as SQL Developer
participant DB as 数据库
participant SP as 存储过程
U->>SD : 上传Excel文件
SD->>DB : 验证表结构
SD->>DB : 执行数据导入
DB->>DB : 更新衍生字段
DB->>DB : 提交事务
U->>SP : 调用缓存刷新接口
SP->>DB : 刷新DRG目录缓存
DB-->>SP : 返回刷新结果
SP-->>U : 返回验证结果
```

**图表来源**
- [DRG数据导入SQL Developer操作指南.md:71-166](file://med_ai_assistant_1.0_bs_backend/doc/数据库操作/DRG数据导入SQL Developer操作指南.md#L71-L166)

#### 数据导入流程

系统支持多种数据导入模式，包括直接XLSX导入和CSV转换导入：

| 导入模式 | 适用场景 | 优点 | 注意事项 |
|---------|---------|------|---------|
| 直接XLSX导入 | 大多数情况 | 保持数据完整性，支持复杂格式 | 需要SQL Developer支持 |
| CSV转换导入 | 特殊情况 | 兼容性好 | 需要注意换行符处理 |
| 手工SQL导入 | 大数据量 | 性能最优 | 需要SQL技能 |

**章节来源**
- [DRG数据导入SQL Developer操作指南.md:1-246](file://med_ai_assistant_1.0_bs_backend/doc/数据库操作/DRG数据导入SQL Developer操作指南.md#L1-L246)

### Oracle IDENTITY策略支持

系统通过序列和触发器实现Oracle数据库的IDENTITY策略支持：

```mermaid
flowchart TD
A[插入记录] --> B{检查主键是否为空}
B --> |是| C[获取序列值]
B --> |否| D[使用现有值]
C --> E[设置主键值]
E --> F[执行插入]
D --> F
F --> G[提交事务]
H[表结构变更] --> I[删除现有序列]
I --> J[创建新序列]
J --> K[调整序列起始值]
K --> L[创建触发器]
L --> M[验证配置]
```

**图表来源**
- [Oracle IDENTITY策略支持脚本.sql:16-53](file://med_ai_assistant_1.0_bs_backend/sql-scripts/create-identity-sequences.sql#L16-L53)

#### 序列管理策略

系统为每个使用IDENTITY的表维护独立的序列管理：

| 表名称 | 序列名称 | 触发器名称 | 起始值 | 缓存大小 |
|--------|----------|------------|--------|----------|
| MEDICAL_RECORDS | MEDICAL_RECORDS_SEQ | TRG_MEDICAL_RECORDS_ID | 1 | 20 |
| TODO_ITEM | TODO_ITEM_SEQ | TRG_TODO_ITEM_ID | 1 | 20 |
| LAB_RESULT | LAB_RESULT_SEQ | TRG_LAB_RESULT_ID | 1 | 20 |
| EMR_CONTENT | EMR_CONTENT_SEQ | TRG_EMR_CONTENT_ID | 1 | 20 |
| PROMPTRESULT | PROMPTRESULT_SEQ | TRG_PROMPTRESULT_ID | 1 | 20 |

**章节来源**
- [Oracle IDENTITY策略支持脚本.sql:1-741](file://med_ai_assistant_1.0_bs_backend/sql-scripts/create-identity-sequences.sql#L1-L741)

### 数据同步和状态管理

系统提供完整的数据同步和状态管理功能：

```mermaid
stateDiagram-v2
[*] --> 初始化
初始化 --> 运行中 : 开始同步
运行中 --> 成功 : 同步完成
运行中 --> 失败 : 发生错误
成功 --> [*]
失败 --> 重试 : 自动重试
失败 --> [*]
重试 --> 运行中 : 重新同步
重试 --> 失败 : 重试次数耗尽
```

**图表来源**
- [同步日志表脚本.sql:13-24](file://med_ai_assistant_1.0_bs_backend/sql-scripts/create-sync-log-table.sql#L13-L24)

#### 同步状态跟踪

系统通过状态转换历史记录完整的状态变更过程：

| 状态类型 | 描述 | 持续时间 | 错误处理 |
|----------|------|----------|----------|
| RUNNING | 同步进行中 | 动态计算 | 记录错误信息 |
| SUCCESS | 同步成功 | 实际耗时 | 无错误信息 |
| FAILED | 同步失败 | 实际耗时 | 详细错误描述 |
| RETRYING | 重试中 | 动态计算 | 记录重试原因 |

**章节来源**
- [状态转换历史表脚本.sql:1-50](file://med_ai_assistant_1.0_bs_backend/sql-scripts/create-status-transition-history-table.sql#L1-L50)

## 依赖关系分析

系统数据库组件之间的依赖关系如下：

```mermaid
graph LR
subgraph "核心表依赖"
A[DRG分析结果表] --> B[DRG分析输入快照表]
A --> C[状态转换历史表]
B --> D[DRG目录表]
C --> E[Prompt表]
end
subgraph "辅助表"
F[同步日志表] --> G[医院配置表]
H[序列管理表] --> A
H --> B
H --> C
H --> F
end
subgraph "存储过程依赖"
I[DRG分析输入快照存储过程] --> B
I --> D
J[数据验证存储过程] --> A
J --> F
end
```

**图表来源**
- [DRG分析结果表创建脚本.sql:4-76](file://med_ai_assistant_1.0_bs_backend/sql-scripts/create-drg-analysis-results-table.sql#L4-L76)
- [DRG分析输入快照表.sql:14-27](file://med_ai_assistant_1.0_bs_backend/sql-scripts/drg_analysis_input_snapshot.sql#L14-L27)

### 数据完整性约束

系统通过多种机制确保数据完整性：

```mermaid
flowchart TD
A[数据插入] --> B[序列生成主键]
B --> C[触发器自动填充]
C --> D[约束验证]
D --> E{验证通过?}
E --> |是| F[数据持久化]
E --> |否| G[错误处理]
G --> H[事务回滚]
I[数据更新] --> J[版本检查]
J --> K[并发控制]
K --> L[冲突解决]
M[数据删除] --> N[软删除标记]
N --> O[历史记录保留]
```

**图表来源**
- [Oracle IDENTITY策略支持脚本.sql:45-52](file://med_ai_assistant_1.0_bs_backend/sql-scripts/create-identity-sequences.sql#L45-L52)

**章节来源**
- [ENCRYPTED_DATA_TEMP唯一约束脚本.sql:1-80](file://med_ai_assistant_1.0_bs_backend/sql-scripts/add-request-id-unique-constraint.sql#L1-L80)

## 性能考虑

### 索引优化策略

系统采用多层次索引策略优化查询性能：

| 表名称 | 索引类型 | 列组合 | 性能收益 |
|--------|----------|--------|----------|
| DRG_ANALYSIS_RESULTS | 主键索引 | RESULT_ID | 快速主键查找 |
| DRG_ANALYSIS_RESULTS | 复合索引 | PATIENT_ID, CREATED_TIME | 历史记录查询 |
| DRG_ANALYSIS_RESULTS | 复合索引 | DRG_ID, FINAL_DRG_CODE | 分析结果检索 |
| SYNC_LOG | 复合索引 | HOSPITAL_ID, STATUS | 同步状态查询 |
| STATUS_TRANSITION_HISTORY | 复合索引 | PROMPT_ID, TRANSITION_TIME | 状态历史查询 |

### 存储过程优化

DRG分析输入快照存储过程采用智能缓存机制避免重复计算：

```mermaid
flowchart TD
A[接收分析请求] --> B[参数验证]
B --> C{强制重算?}
C --> |是| D[直接创建快照]
C --> |否| E[查找最新快照]
E --> F{集合是否相同?}
F --> |是| G[返回空值]
F --> |否| H[创建新快照]
D --> I[返回快照ID]
H --> I
G --> J[结束]
I --> J
```

**图表来源**
- [DRG分析输入快照存储过程.sql:38-92](file://med_ai_assistant_1.0_bs_backend/sql-scripts/gen_drg_input_snapshot_procedure.sql#L38-L92)

## 故障排除指南

### 常见数据库问题及解决方案

| 问题类型 | 错误代码 | 症状描述 | 解决方案 |
|----------|----------|----------|----------|
| 主键约束错误 | ORA-01400 | 无法将NULL插入主键列 | 执行IDENTITY策略支持脚本 |
| 唯一约束冲突 | ORA-00001 | 重复值违反唯一约束 | 清理重复数据后添加约束 |
| CLOB字段过大 | ORA-12899 | 值超出VARCHAR2长度限制 | 修改字段类型为CLOB |
| 序列缓存不足 | ORA-08004 | 序列缓存耗尽 | 调整序列缓存大小 |
| 触发器失效 | PL/SQL-00936 | 触发器语法错误 | 重新创建触发器 |

### 数据库连接问题

系统提供完整的连接池管理和监控功能：

```mermaid
sequenceDiagram
participant APP as 应用程序
participant CP as 连接池
participant DB as 数据库
participant MON as 监控系统
APP->>CP : 获取数据库连接
CP->>DB : 建立数据库连接
DB-->>CP : 返回连接状态
CP-->>APP : 返回可用连接
APP->>DB : 执行数据库操作
DB-->>APP : 返回操作结果
APP->>CP : 归还数据库连接
CP->>MON : 更新连接状态
MON-->>CP : 返回监控数据
```

**图表来源**
- [数据库初始化脚本.sql:28-32](file://med_ai_assistant_1.0_bs_backend/init.sql#L28-L32)

**章节来源**
- [Oracle IDENTITY策略主键NULL插入错误修复.md:135-182](file://med_ai_assistant_1.0_bs_backend/doc/问题修复/Oracle数据库IDENTITY策略主键NULL插入错误修复.md#L135-L182)

## 结论

MedAiAssistant项目的数据库操作体系展现了高度的专业性和完整性。通过精心设计的表结构、存储过程和索引策略，系统实现了高效的数据处理能力和强大的状态管理功能。

### 主要优势

1. **双数据库支持**：同时支持Oracle和MySQL数据库，提供灵活的部署选项
2. **智能缓存机制**：通过DRG分析输入快照避免重复计算，提升系统性能
3. **完整的状态管理**：提供详细的状态转换历史和同步日志记录
4. **数据完整性保障**：通过约束、触发器和存储过程确保数据一致性
5. **性能优化策略**：多层次索引和序列管理优化查询性能

### 技术特色

- **模块化设计**：各个数据库组件职责明确，便于维护和扩展
- **自动化程度高**：通过序列和触发器实现自动化的主键生成和数据填充
- **监控完善**：提供完整的数据库健康状态监控和性能指标
- **故障恢复**：具备完善的错误处理和恢复机制

该数据库操作体系为整个MedAiAssistant系统的稳定运行奠定了坚实的基础，为后续的功能扩展和性能优化提供了良好的架构支撑。