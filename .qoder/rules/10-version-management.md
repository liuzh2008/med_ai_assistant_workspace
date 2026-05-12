---
trigger: always_on
---
## 版本号管理规则

### 禁止直接编辑版本号

- 禁止直接编辑 `pom.xml` 中的 `<version>` 标签或 `<revision>` 属性值
- 禁止直接编辑 `package.json` 中的 `version` 字段
- pom.xml 中的 `<version>${revision}</version>` 永不修改

### 版本更新方式

- 版本更新必须通过项目根目录的 `bump-version.ps1` 脚本执行
- `VERSION` 文件是唯一版本来源（位于项目根目录）
- 脚本会自动同步到：VERSION、.mvn/maven.config、pom.xml 的 revision 属性、package.json

### 使用方法

```powershell
# 自动递增末位版本号
.\bump-version.ps1
# 指定版本号
.\bump-version.ps1 -Version "0.9.084"
```

### 版本号格式

- 格式：`0.9.xxx`（三位数补零，如 `0.9.083`、`0.9.084`）
- 前后端版本号必须一致
