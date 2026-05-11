---
trigger: always_on
alwaysApply: true
---

# 项目身份

- **项目名称**：医疗AI辅助系统 (MedAiAssistant)
- **技术栈**：Java 21 + Spring Boot 3.5.8 + Oracle 21c / Vue 3.2.13 + Vuex 4 + Element Plus 2.10.2
- **核心包**：`com.example.medaiassistant`
- **架构**：主服务器 + 执行服务器双节点，Prompt模板驱动AI交互

## 全局安全约束

- ✗ 禁止日志输出患者PII（姓名、身份证号、手机号、医保号）
- ✗ 禁止硬编码医院ID，必须从配置读取
