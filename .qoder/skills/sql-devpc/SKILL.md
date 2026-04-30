---
name: sql-devpc
description: 在开发服务器本地 Oracle (127.0.0.1:1521/FREE) 上直接执行 SQL。当用户需要在开发库查询数据、更新数据、检查表结构或执行任意 SQL 时使用。
---

# 开发服务器本地 Oracle SQL 执行

在开发服务器本地 Oracle 数据库（Oracle 23ai Free）上直接执行 SQL，无需 SSH。

## 连接信息

| 项目 | 值 |
|------|------|
| 主机 | 127.0.0.1 |
| 端口 | 1521 |
| SID | FREE |
| 用户 | system |
| 密码 | Liuzh_123 |
| 连接串 | system/Liuzh_123@//127.0.0.1:1521/FREE |
| 字符集 | 默认（中文输出乱码属于正常现象，关注 ORA- 错误码即可） |
| sqlplus路径 | C:\app\47044\product\23ai\dbhomeFree\bin\sqlplus.exe |

## 执行流程

### 本地两步法：写 SQL 文件 → sqlplus 执行

由于 PowerShell 不支持 heredoc（`<<`），且 `@` 是 PowerShell 的展开运算符，需要按以下流程执行：

```powershell
# 1. 用 create_file 工具在项目目录下创建 SQL 文件（如 tmp_query.sql）
#    SET LINESIZE 300
#    SET SERVEROUTPUT ON
#    ... SQL 语句 ...
#    EXIT;

# 2. 切换到目标目录后执行，@ 前加反引号 ` 转义
Set-Location "med_ai_assistant_1.0_bs_backend"
sqlplus -s system/Liuzh_123@//127.0.0.1:1521/FREE `@tmp_query.sql

# 3. 执行完后清理临时文件
del tmp_query.sql
```

### 注意事项
- 路径中如果当前目录正确，可直接用相对路径
- 如果 `Set-Location` 后路径错误（如重复拼接），请直接用绝对路径
- `@` 前必须加反引号 `` ` `` 转义，否则 PowerShell 会报错

## 关键规则

1. **SQL 文件必须始终以 `EXIT;` 结尾**，防止 sqlplus 挂起等待输入
2. **PowerShell @ 转义**：sqlplus 的 `@文件名.sql` 参数中 `@` 要写成 `` `@ ``（反引号+@）
3. **避免路径带空格**：SQL 文件放在 `med_ai_assistant_1.0_bs_backend\` 目录下，执行时先 `Set-Location` 进入该目录
4. **中文乱码正常**：sqlplus 输出的中文在 PowerShell 中显示为乱码（如 `=== 涓婚敭 ===`），这**不影响 SQL 执行结果**，关注 ORA- 错误码即可

## 常用格式化设置

```sql
SET LINESIZE 300        -- 行宽，避免中文列截断
SET PAGESIZE 50         -- 每页行数
SET FEEDBACK ON         -- 显示"N rows selected"
SET SERVEROUTPUT ON     -- 显示 DBMS_OUTPUT.PUT_LINE 输出
```

## 常见查询示例

### 查询表结构
```sql
SELECT column_name, data_type, data_length, nullable, data_default
FROM user_tab_columns
WHERE table_name = 'QC_ASSESSMENT_RESULT'
ORDER BY column_id;
```

### 检查序列和触发器
```sql
SELECT sequence_name FROM user_sequences WHERE sequence_name = 'QC_ASSESSMENT_RESULT_SEQ';
SELECT trigger_name, status FROM user_triggers WHERE trigger_name = 'TRG_QC_ASSESSMENT_RESULT_BI';
```

### DDL操作（ALTER TABLE）
```sql
ALTER TABLE QC_INDICATOR_CONFIG DROP CONSTRAINT FK_QIC_DISEASE_ID;
```

### 带 PL/SQL 的复合操作
```sql
DECLARE
    v_cnt NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_cnt FROM user_sequences WHERE sequence_name = 'QC_ASSESSMENT_RESULT_SEQ';
    IF v_cnt = 0 THEN
        EXECUTE IMMEDIATE 'CREATE SEQUENCE QC_ASSESSMENT_RESULT_SEQ START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE';
        DBMS_OUTPUT.PUT_LINE('序列创建成功');
    ELSE
        DBMS_OUTPUT.PUT_LINE('序列已存在');
    END IF;
END;
/
```

## 注意事项

- 数据库为 **Oracle 23ai Free**（本地开发环境），与测试服务器的 Oracle 21c XE 有细微差异
- 当前连接的是 CDB `FREE`，非 PDB；表在 `SYSTEM` 用户下
- 执行破坏性操作（DROP/ALTER/DELETE）前建议先 SELECT 确认影响范围
- 临时 SQL 文件执行后应及时清理
- 中文输出乱码不影响 SQL 执行，设置 `$env:NLS_LANG="SIMPLIFIED CHINESE_CHINA.AL32UTF8"` 可缓解
