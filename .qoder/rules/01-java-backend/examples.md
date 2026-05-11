# Java 后端编码示例

## Bean 命名正反例

```java
// ✓ 正确
class PatientController {}
class PatientService {}
class PatientRepository {}
class Patient {}                    // Entity 无后缀
class PatientSaveRequest {}         // Request 后缀
class SurgeryTaskDTO {}             // DTO 后缀
class LoginResponse {}              // Response 后缀

// ✗ 错误
class PatientEntity {}              // 禁止 Entity 后缀
class PatientVo {}                  // 禁止 Vo 后缀
class PatientModel {}               // 禁止 Model 后缀
class SurgeryTaskData {}            // 语义不清
```

## 构造器注入 vs @Autowired

```java
// ✓ 构造器注入
@RestController
public class DataCollectionAdviceController {
    private final TimerPromptGenerator timerPromptGenerator;
    private final PatientRepository patientRepository;
    private final DataCollectionAdviceService dataCollectionAdviceService;

    public DataCollectionAdviceController(TimerPromptGenerator timerPromptGenerator,
                                          PatientRepository patientRepository,
                                          DataCollectionAdviceService dataCollectionAdviceService) {
        this.timerPromptGenerator = timerPromptGenerator;
        this.patientRepository = patientRepository;
        this.dataCollectionAdviceService = dataCollectionAdviceService;
    }
}

// ✗ @Autowired 字段注入
@RestController
public class DataCollectionAdviceController {
    @Autowired
    private TimerPromptGenerator timerPromptGenerator;
    @Autowired
    private PatientRepository patientRepository;
}
```

## Service 层事务

```java
// ✓ 正确：Service 层声明事务，多数据源指定 transactionManager
@Service
public class DiagnosisService {
    private static final Logger logger = LoggerFactory.getLogger(DiagnosisService.class);

    @Transactional(rollbackFor = Exception.class)
    public Diagnosis replaceDiagnosis(ReplaceDiagnosisDTO request) {
        // 业务逻辑
    }

    @Transactional(value = "executionTransactionManager", rollbackFor = Exception.class)
    public void syncToExecutionServer(List<Prompt> prompts) {
        // 执行服务器数据源事务
    }
}

// ✗ 错误：Controller 层声明事务
@RestController
public class DiagnosisController {
    @Transactional(rollbackFor = Exception.class)  // 禁止
    public ResponseEntity<?> replace() { ... }
}
```

## Repository 查询

```java
// ✓ 方法名派生
List<DrgAnalysisResult> findByPatientId(String patientId);
long countByPatientId(String patientId);

// ✓ @Query JPQL
@Query("SELECT d FROM DrgAnalysisResult d WHERE d.patientId = ?1 AND d.deleted = 0 ORDER BY d.createdTime DESC")
Optional<DrgAnalysisResult> findLatestByPatientId(String patientId);

// ✗ 禁止 Native SQL
@Query(value = "SELECT * FROM drg_analysis_result WHERE patient_id = ?1", nativeQuery = true)
List<DrgAnalysisResult> findByPatientIdNative(String patientId);
```

## 异常处理

```java
// ✓ 自定义异常 + Controller try-catch
public class DeptSpecialContentException extends RuntimeException {
    public DeptSpecialContentException(String message) { super(message); }
}

@RestController
public class DeptSpecialContentController {
    public ResponseEntity<Map<String, Object>> update(@RequestBody UpdateDeptSpecialDTO request) {
        try {
            PromptTemplateDeptSpecial updated = service.update(request);
            return ResponseEntity.ok(Map.of("specialId", updated.getSpecialId(), "status", "UPDATED"));
        } catch (DeptSpecialContentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to update: " + e.getMessage()));
        }
    }
}
```

## UTF-8 编码配置

### Spring Boot 编码（application.properties）

```properties
# 字符编码配置
spring.http.encoding.charset=UTF-8
spring.http.encoding.enabled=true
spring.http.encoding.force=true
server.servlet.encoding.charset=UTF-8
server.servlet.encoding.enabled=true
server.servlet.encoding.force=true

# JSON响应编码
spring.jackson.default-property-inclusion=non_null
spring.jackson.time-zone=GMT+8
```

### Controller 响应编码

```java
// ✓ 显式设置 produces
@RestController
@RequestMapping(value = "/api", produces = "application/json; charset=utf-8")
public class ApiController {}

// ✗ 未设置 produces
@RestController
@RequestMapping("/api")
public class ApiController {}
```

### 数据库连接编码

```properties
# Oracle
spring.datasource.url=jdbc:oracle:thin:@host:1521/SID?characterEncoding=utf8&useUnicode=true
# MySQL
spring.datasource.url=jdbc:mysql://host:3306/db?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai
```

### JVM 启动参数

```bat
set JAVA_OPTS=-Dfile.encoding=UTF-8 -Dsun.jnu.encoding=UTF-8
```

### 字符串与文件操作

```java
// ✓ 显式指定 UTF-8
String str = new String(bytes, StandardCharsets.UTF_8);
Files.readAllLines(path, StandardCharsets.UTF_8);
Files.write(path, content.getBytes(StandardCharsets.UTF_8));

// ✗ 使用平台默认编码
String str = new String(bytes);
Files.readAllLines(path);
```

## DTO 工厂方法

```java
// ✓ 静态工厂方法转换 Entity → DTO
@Data
public class TreatmentPlanItemDTO {
    private Long itemId;
    private String patientId;
    private String content;

    public static TreatmentPlanItemDTO from(TreatmentPlanItem entity) {
        TreatmentPlanItemDTO dto = new TreatmentPlanItemDTO();
        dto.setItemId(entity.getItemId());
        dto.setPatientId(entity.getPatientId());
        dto.setContent(entity.getContent());
        return dto;
    }
}
```
