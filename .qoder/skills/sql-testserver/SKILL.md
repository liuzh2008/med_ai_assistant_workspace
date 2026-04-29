---
name: sql-testserver
description: Execute SQL queries on the test server (100.66.1.4) Oracle database via Docker container. Use when the user asks to query, update, or manage data in the test server database, check table structures, or run any SQL on the test Oracle instance.
---

# 测试服务器 Oracle SQL 执行

在测试服务器(100.66.1.4)上通过 Oracle 容器(`med-ai-oracle`)执行 SQL。

## 连接信息

| 项目 | 值 |
|------|------|
| 测试服务器 | 100.66.1.4（SSH别名: testserver） |
| Oracle容器 | med-ai-oracle |
| 连接串 | system/Liuzh_123@//localhost:1521/XE |
| 字符集 | UTF-8（支持中文） |

## 执行流程

### 三步法：heredoc → docker cp → sqlplus

```bash
# 1. SSH到测试服务器，用heredoc写SQL文件（避免PowerShell转义问题）
ssh testserver "cat > /tmp/query.sql << 'EOSQL'
SET LINESIZE 300
SET PAGESIZE 50
COLUMN STATUSNAME FORMAT A15

SELECT STATUSNAME, COUNT(1) as CNT FROM PROMPTS GROUP BY STATUSNAME;

EXIT;
EOSQL
docker cp /tmp/query.sql med-ai-oracle:/tmp/query.sql && docker exec med-ai-oracle sqlplus -s system/Liuzh_123@//localhost:1521/XE @/tmp/query.sql"
```

## 关键规则

1. **必须用 heredoc (`<< 'EOSQL'`)**：用单引号包裹标记防止变量展开，避免 PowerShell 对 `$`、`*`、`()` 等特殊字符的干扰
2. **中文直接写入**：在 heredoc 中直接使用中文字面量（如 `WHERE STATUSNAME = '待处理'`），**绝不用 `CHR()` 拼接中文**（Oracle 的 CHR 在 UTF-8 多字节字符集下行为不可预测，会导致 LIKE 全表匹配等严重问题）
3. **始终以 `EXIT;` 结尾**：防止 sqlplus 挂起等待输入
4. **合并为单条 SSH 命令**：heredoc 写文件 + docker cp + docker exec 用 `&&` 串联在同一条 ssh 命令中

## 常用格式化设置

```sql
SET LINESIZE 300        -- 行宽，避免中文列截断
SET PAGESIZE 50         -- 每页行数
SET FEEDBACK ON         -- 显示"N rows selected"
COLUMN 列名 FORMAT A宽度  -- 字符列宽度（中文按字节，A30约显示10个汉字）
```

## 常见查询示例

### 查询表结构
```sql
SELECT column_name, data_type, data_length, nullable
FROM user_tab_columns
WHERE table_name = 'PROMPTS'
ORDER BY column_id;
```

### 带中文条件的查询
```sql
SELECT PROMPTID, PATIENTID, STATUSNAME
FROM PROMPTS
WHERE STATUSNAME = '待处理'
ORDER BY PROMPTID DESC
FETCH FIRST 10 ROWS ONLY;
```

### DML操作（INSERT/UPDATE/DELETE）
```sql
-- DML后必须显式COMMIT
DELETE FROM PROMPTS WHERE STATUSNAME = '待处理';
COMMIT;
SELECT COUNT(1) as REMAINING FROM PROMPTS;
```

## 注意事项

- Prompts表状态字段名为 `STATUSNAME`（非 STATUS）
- 表名和列名在 Oracle 中默认大写
- 测试服务器数据库为 Oracle 21c XE
- 执行破坏性操作（DELETE/UPDATE）前建议先 SELECT 确认数据量
