---
name: json-edit
description: Edit JSON files precisely using a Python script instead of SearchReplace text matching. Use when modifying any .json file, updating JSON configs, editing package.json, or changing structured JSON data. Avoids whitespace/formatting sensitivity issues inherent in text-based replacement.
---

# JSON 精确编辑

**规则：修改任何 JSON 文件时，必须使用 `scripts/json_editor.py`，禁止用 SearchReplace 直接编辑 JSON。**

## 脚本路径

```
scripts/json_editor.py
```

位于项目根目录 `d:\MedAiAssistant 1.0\MedAiAssistant 1.0 BS\scripts\json_editor.py`。

## 命令速查

| 命令 | 用途 | 示例 |
|------|------|------|
| `get` | 读取值 | `python scripts/json_editor.py config.json get server.port` |
| `set` | 设置值 | `python scripts/json_editor.py config.json set server.port 8080` |
| `delete` | 删除键/索引 | `python scripts/json_editor.py config.json delete debug` |
| `append` | 数组追加 | `python scripts/json_editor.py config.json append hosts "new-host" --type str` |
| `merge` | 合并对象 | `python scripts/json_editor.py config.json merge db '{"host":"x","port":3306}'` |

## 路径语法

点号分隔键名，数组用 `[N]` 索引：

```
version                    → 根级键
server.port                → 嵌套键
items[0].name              → 数组第一个元素的 name
config.hosts[2]            → hosts 数组的第3个
```

## --type 参数

| --type | 示例输入 | 结果 |
|--------|---------|------|
| `str` | `hello` | `"hello"` |
| `int` | `42` | `42` |
| `float` | `3.14` | `3.14` |
| `bool` | `true` | `true` |
| `null` | `null` | `null` |
| `json` | `{"a":1}` | 解析为对象 |

省略 `--type` 时自动推断：尝试 int→float→bool→null→JSON→默认字符串。

## 工作流

### 修改前必须做的事

1. **先 `get` 确认当前值**：`python scripts/json_editor.py <file> get <path>`
2. **再 `set`/`delete`/`append`/`merge`**
3. **最后 `get` 验证结果**

### 批量修改同一个文件

`set` 支持路径自动创建中间节点（字典），但不会自动创建数组索引。

多个修改操作在同一个 Bash 调用中用分号串联：

```powershell
python scripts/json_editor.py p.json set a.b 1; python scripts/json_editor.py p.json set a.c 2
```

⚠ 不可并行执行对同一文件的修改。

## 安全机制

- **自动备份**：修改前备份为 `<原文件>.bak`
- **原子写入**：先写临时文件 → 解析验证 → `os.replace` 原子替换
- **失败回滚**：写入或验证失败，自动从 `.bak` 恢复

## PowerShell 注意事项

在 PowerShell 中传递含双引号的 JSON 时，需用反引号转义内部引号：

```powershell
python scripts/json_editor.py config.json merge db '{\"host\":\"127.0.0.1\",\"port\":3306}' --type json
```

或先把 JSON 写成临时文件再使用（更可靠）：

```powershell
# 1. 创建临时 JSON
echo '{"host":"127.0.0.1","port":3306}' > temp_payload.json
# 2. 读取文件内容作为 merge 参数
$json = Get-Content temp_payload.json -Raw
python scripts/json_editor.py config.json merge db $json --type json
```

## 完整示例

### 场景1：修改 package.json 版本号

```powershell
python scripts/json_editor.py package.json get version
# "1.0.0"

python scripts/json_editor.py package.json set version "1.1.0" --type str
# [OK] 已设置: version = "1.1.0"

python scripts/json_editor.py package.json get version
# "1.1.0"
```

### 场景2：向数组追加元素

```powershell
python scripts/json_editor.py config.json get patients
# [{"id":1,"name":"张三"},{"id":2,"name":"李四"}]

python scripts/json_editor.py config.json append patients '{"id":3,"name":"王五"}' --type json
# [OK] 已追加到 patients: {"id":3,"name":"王五"}
```

### 场景3：删除键

```powershell
python scripts/json_editor.py config.json delete debug.tempFiles
# [OK] 已删除: debug.tempFiles
```

### 场景4：合并嵌套对象

```powershell
python scripts/json_editor.py config.json merge llm.default '{"model":"gpt-4","temperature":0.7}' --type json
# [OK] 已合并到 llm.default
```

