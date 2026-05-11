---
trigger: always_on
alwaysApply: true
---

## API 设计规范

### URL 规则

- 所有接口必须以 `/api` 为前缀（执行服务器同理）
- 资源用复数名词，路径用 kebab-case
- ✓ `/api/patients`, `/api/drg-groups`, `/api/quality-controls`
- ✗ `/patient`, `/api/drgGroups`, `/api/quality_control`

### 响应格式

- 单资源返回 `ResponseEntity<T>`，集合直接返回 `List<T>` 或 `Page<T>`
- DTO 通过工厂方法构建响应：

```java
// ✓
return ResponseEntity.ok(PatientDTO.fromEntity(patient));
return ResponseEntity.created(uri).body(PatientDTO.created(patient));

// ✗
return ResponseEntity.ok(new HashMap<String, Object>() {{ put("data", patient); }});
```

### 错误返回

- 返回 `Map<String, Object>`，必须包含 `"error"` 字段
- HTTP 状态码语义正确：400 参数错误，404 不存在，409 冲突，500 服务器错误

```java
// ✓
return ResponseEntity.status(404).body(Map.of("error", "患者不存在", "id", id));

// ✗
return ResponseEntity.status(200).body(Map.of("code", 404, "msg", "患者不存在"));
```

### Controller 方法命名

- 命名模式：`get*/add*/update*/delete*` + 资源名
- ✓ `getPatientById`, `addDiagnosis`, `updateQualityControl`, `deletePrompt`
- ✗ `handlePost`, `process`, `doAction`

### 参数绑定

| 参数来源 | 注解 | 示例 |
|---------|------|------|
| 路径参数 | `@PathVariable` | `/api/patients/{id}` |
| 查询参数 | `@RequestParam` | `?status=active` |
| 请求体 | `@RequestBody` | JSON 体 |
