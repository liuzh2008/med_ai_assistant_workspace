# AI服务API

<cite>
**Referenced Files in This Document**  
- [ai.js](file://src/api/ai.js)
- [request.js](file://src/api/request.js)
</cite>

## 目录
1. [简介](#简介)
2. [核心接口定义](#核心接口定义)
3. [认证与请求头](#认证与请求头)
4. [错误响应结构](#错误响应结构)
5. [接口调用示例](#接口调用示例)
6. [请求处理机制](#请求处理机制)

## 简介
本文档详细描述了医疗AI助手系统中AI服务相关的RESTful API接口。这些接口主要定义在`ai.js`文件中，用于实现患者数据获取、Prompt模板管理、AI响应生成及结果保存等核心功能。所有接口均通过封装的axios实例进行网络通信，确保了请求的一致性和安全性。

## 核心接口定义

### getPatientData - 获取患者数据
获取指定患者在特定Prompt模板下的格式化医疗数据。

**HTTP方法**: `GET`  
**URL路径**: `/ai/patient-data`  

**请求参数**:
- **查询参数**:
  - `patientId` (string, 必填): 患者ID
  - `promptType` (string, 必填): Prompt类型，已进行URL编码
  - `promptName` (string, 必填): Prompt名称，已进行URL编码

**成功响应 (200)**:
- **响应体**: 格式化后的患者医疗数据字符串

**请求示例**:
```json
GET /ai/patient-data?patientId=P12345&promptType=%E8%AF%8A%E6%96%AD%E5%88%86%E6%9E%90&promptName=%E5%BF%83%E8%84%8F%E7%96%BE%E7%97%85%E8%AF%8A%E6%96%AD
```

**响应示例**:
```json
"患者ID: P12345，姓名: 张三，年龄: 65岁，主诉: 胸痛，诊断: 冠心病..."
```

**可能的状态码**:
- `200`: 成功获取患者数据
- `400`: 参数错误（如缺少必填参数）
- `401`: 未授权访问
- `500`: 服务器内部错误

**Section sources**
- [ai.js](file://src/api/ai.js#L291-L306)

### getPromptTemplate - 获取Prompt模板
根据类型和名称获取完整的Prompt模板信息。

**HTTP方法**: `GET`  
**URL路径**: `/ai/promptTemplate`  

**请求参数**:
- **查询参数**:
  - `promptType` (string, 必填): Prompt模板类型
  - `promptName` (string, 必填): Prompt模板名称

**成功响应 (200)**:
- **响应体**: 包含完整Prompt模板信息的JSON对象

**请求示例**:
```json
GET /ai/promptTemplate?promptType=诊断分析&promptName=心脏疾病诊断模板
```

**响应示例**:
```json
{
  "promptType": "诊断分析",
  "promptName": "心脏疾病诊断模板",
  "prompt": "根据患者症状进行心脏疾病诊断分析...",
  "requiredDataTypes": "一般信息,诊断信息,化验结果"
}
```

**可能的状态码**:
- `200`: 成功获取模板
- `400`: 请求参数无效
- `404`: 模板不存在
- `500`: 服务器内部错误

**Section sources**
- [ai.js](file://src/api/ai.js#L172-L187)

### addPrompt - 添加Prompt记录
创建一条新的Prompt执行记录。

**HTTP方法**: `POST`  
**URL路径**: `/ai/savePrompt`  

**请求参数**:
- **Body参数 (application/json)**:
  - `userId` (number, 必填): 用户ID
  - `patientId` (string, 必填): 患者ID
  - `promptTemplateName` (string, 必填): Prompt模板名称
  - `objectiveContent` (string, 必填): 目标内容
  - `promptTemplateContent` (string, 必填): Prompt模板内容
  - `priority` (number, 可选): 优先级，默认值为3
  - `generatedBy` (string, 可选): 生成来源，默认为'user'
  - `sortNumber` (number, 可选): 排序号，默认为0
  - `retryCount` (number, 可选): 重试次数，默认为0
  - `statusName` (string, 可选): 状态名称，默认为'CREATED'
  - `submissionTime` (string, 可选): 提交时间，ISO格式，默认为当前时间
  - `estimatedWaitTime` (number, 固定): 预计等待时间，固定为0

**成功响应 (200)**:
- **响应体**: 包含创建记录ID、状态和时间戳的对象
```json
{
  "id": "prompt-123",
  "status": "CREATED",
  "timestamp": "2025-07-24T12:00:00Z"
}
```

**可能的状态码**:
- `200`: 成功创建记录
- `400`: 参数验证失败
- `401`: 未授权
- `500`: 服务器内部错误

**Section sources**
- [ai.js](file://src/api/ai.js#L321-L363)

### getAIResponse - 获取AI回复
向AI服务发送请求并获取回复。

**HTTP方法**: `POST`  
**URL路径**: `/ai/response`  

**请求参数**:
- **Body参数 (application/json)**:
  - `model` (string, 必填): LLM模型名称
  - `parameters` (object, 必填): LLM调用参数对象

**成功响应 (200)**:
- **响应体**: AI生成的JSON数据

**请求示例**:
```json
{
  "model": "gpt-4",
  "parameters": {
    "prompt": "分析以下患者数据...",
    "temperature": 0.7
  }
}
```

**响应示例**:
```json
{
  "diagnosis": "初步诊断为急性心肌梗死",
  "recommendations": ["立即进行心电图检查", "启动溶栓治疗"]
}
```

**可能的状态码**:
- `200`: 成功获取AI回复
- `400`: 请求参数无效
- `401`: 未授权
- `500`: AI服务内部错误

**Section sources**
- [ai.js](file://src/api/ai.js#L47-L62)

### saveAIResult - 保存AI结果
将AI生成的结果保存到数据库。

**HTTP方法**: `POST`  
**URL路径**: `/ai/saveResult`  

**请求参数**:
- **Body参数 (application/json)**:
  - `id` (string, 必填): 结果ID
  - `content` (string, 必填): 修改后的内容
  - `originalContent` (string, 必填): 原始内容
  - `promptId` (string, 必填): 关联的Prompt ID
  - `title` (string, 可选): 结果标题
  - `timestamp` (string, 可选): 时间戳
  - `patientId` (string, 可选): 关联的患者ID
  - `lastModifiedBy` (string, 可选): 最后修改人ID
  - `isRead` (number, 可选): 是否已读标记 (0/1)

**成功响应 (200)**:
- **响应体**: 保存成功的响应数据
```json
{
  "id": "result-123",
  "status": "success",
  "timestamp": "2025-07-24T12:00:00Z"
}
```

**可能的状态码**:
- `200`: 成功保存结果
- `400`: 参数验证失败
- `401`: 未授权
- `500`: 服务器内部错误

**Section sources**
- [ai.js](file://src/api/ai.js#L149-L163)

## 认证与请求头
所有API请求都需要进行身份验证。
- **认证方式**: Bearer Token
- **请求头**: `Authorization: Bearer <token>`
- **Content-Type**: 对于POST请求，必须设置为`application/json`

## 错误响应结构
当请求失败时，服务器会返回相应的错误状态码和错误信息。具体的错误响应体结构由后端服务定义，前端通常会捕获这些错误并抛出带有描述信息的JavaScript Error对象。

## 接口调用示例