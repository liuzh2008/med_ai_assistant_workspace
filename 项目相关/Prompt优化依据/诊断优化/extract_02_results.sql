-- ============================================================
-- 步骤2/3：导出诊断分析记录（AI诊断 + 诊断依据原文）
-- 输出文件：diagnosis_analysis_records.txt
-- 每行一条记录，字段以 |#| 分隔：
--   ResultId | 模板名 | 患者哈希ID | 执行时间 | Status | 内容(转义后)
-- 内容转义：换行->\u000A  制表符->\u0009  分隔符|#|->¦#¦
-- 脱敏：PatientID 经 SHA-256 加盐哈希（前16位），不含任何患者PII
-- 只读查询，不写任何数据
-- ============================================================
SET ECHO OFF
SET FEEDBACK OFF
SET HEADING OFF
SET PAGESIZE 0
SET LINESIZE 32767
SET LONG 200000000
SET LONGCHUNKSIZE 200000000
SET TRIMSPOOL ON
SET TRIMOUT ON
SET WRAP ON
SET TERMOUT ON

PROMPT 正在导出诊断分析记录...

SPOOL diagnosis_analysis_records.txt

SELECT pr.ResultId || '|#|' ||
       p.PromptTemplateName || '|#|' ||
       SUBSTR(RAWTOHEX(STANDARD_HASH('MEDAI_DIAG_EXTRACT' || NVL(p.PatientId, 'UNKNOWN'), 'SHA256')), 1, 16) || '|#|' ||
       TO_CHAR(pr.ExecutionTime, 'YYYY-MM-DD HH24:MI:SS') || '|#|' ||
       NVL(pr.Status, '') || '|#|' ||
       REPLACE(REPLACE(REPLACE(REPLACE(
           NVL(pr.OriginalResultContent, EMPTY_CLOB()),
           CHR(13), ''), CHR(10), '\u000A'), CHR(9), '\u0009'), '|#|', '¦#¦')
FROM promptresult pr
JOIN prompts p ON pr.PromptId = p.PromptId
WHERE p.PromptTemplateName IN ('诊断分析', '鉴别诊断分析')
  AND NVL(pr.deleted, 0) = 0
  AND pr.ExecutionTime >= SYSDATE - 90
ORDER BY pr.ExecutionTime;

SPOOL OFF

PROMPT 导出完成：diagnosis_analysis_records.txt

EXIT;
