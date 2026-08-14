SET ECHO OFF
SET FEEDBACK ON
SET HEADING ON
SET LINESIZE 300
SET PAGESIZE 200
SET LONG 100

PROMPT ============================================================
PROMPT   步骤1/3：数据量摸底（确认提取范围）
PROMPT ============================================================

PROMPT 诊断分析记录数（近90天，含模板分布）
SELECT p.PromptTemplateName, COUNT(*) cnt
FROM promptresult pr
JOIN prompts p ON pr.PromptId = p.PromptId
WHERE p.PromptTemplateName IN ('诊断分析','鉴别诊断分析')
  AND NVL(pr.deleted, 0) = 0
  AND pr.ExecutionTime >= SYSDATE - 90
GROUP BY p.PromptTemplateName;

PROMPT 内容长度检查（若 max_len 超 30000 需调整导出格式）
SELECT COUNT(*) cnt,
       MIN(LENGTH(pr.OriginalResultContent)) min_len,
       MAX(LENGTH(pr.OriginalResultContent)) max_len,
       ROUND(AVG(LENGTH(pr.OriginalResultContent))) avg_len
FROM promptresult pr
JOIN prompts p ON pr.PromptId = p.PromptId
WHERE p.PromptTemplateName IN ('诊断分析','鉴别诊断分析')
  AND NVL(pr.deleted, 0) = 0
  AND pr.ExecutionTime >= SYSDATE - 90;

PROMPT Status 分布（SUCCESS=生成完成 / SAVED=医生已保存操作，两者均需导出）
SELECT pr.Status, COUNT(*) cnt
FROM promptresult pr
JOIN prompts p ON pr.PromptId = p.PromptId
WHERE p.PromptTemplateName IN ('诊断分析','鉴别诊断分析')
  AND NVL(pr.deleted, 0) = 0
  AND pr.ExecutionTime >= SYSDATE - 90
GROUP BY pr.Status;

PROMPT 关联患者的目前诊断行数
SELECT COUNT(*) diag_rows
FROM diagnosis d
WHERE NVL(d.is_deleted, 0) = 0
  AND d.PatientID IN (
    SELECT p.PatientId FROM prompts p
    JOIN promptresult pr ON pr.PromptId = p.PromptId
    WHERE p.PromptTemplateName IN ('诊断分析','鉴别诊断分析')
      AND NVL(pr.deleted, 0) = 0
      AND pr.ExecutionTime >= SYSDATE - 90
  );

PROMPT 时间范围
SELECT MIN(pr.ExecutionTime) min_t, MAX(pr.ExecutionTime) max_t
FROM promptresult pr
JOIN prompts p ON pr.PromptId = p.PromptId
WHERE p.PromptTemplateName IN ('诊断分析','鉴别诊断分析')
  AND NVL(pr.deleted, 0) = 0
  AND pr.ExecutionTime >= SYSDATE - 90;

EXIT;
