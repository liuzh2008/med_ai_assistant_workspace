---
trigger: always_on
alwaysApply: true
---

## 部署与环境规范

### 环境定义

| 环境 | 用途 | 配置 |
|------|------|------|
| 开发 | 本地开发 | `application-dev.properties` |
| 测试 | 测试服务器 | `application-test.properties` |
| 生产 | 医院内网 | `application-prod.properties` |

- Profile 通过 `SPRING_PROFILES_ACTIVE` 环境变量指定

### 双节点架构

| 节点 | 端口 | 职责 |
|------|------|------|
| 主服务器 | 8080 | 业务API、AI调度 |
| 执行服务器 | 8081 | 脚本执行、日志收集 |

- 两个节点独立部署，执行服务器通过主服务器 API 注册

### Docker 部署

- 使用 `docker-compose.yml` 编排，健康检查端点 `/api/health`
- 配置通过环境变量注入，不修改容器内文件

```yaml
# ✓ 健康检查
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8080/api/health"]
  interval: 30s

# ✗ 无健康检查
```

### 开发模式启动

- 后端：`mvn spring-boot:run`（支持热更新）
- 前端：`npm run serve`（热重载）
- 执行服务器：`run-execution-server.bat` / `.sh`

### 配置驱动多医院

- 医院配置放在 `config/hospitals/` 目录
- 每个医院一个配置文件，运行时根据 `hospital.id` 加载
- 禁止在代码中硬编码医院特定逻辑
