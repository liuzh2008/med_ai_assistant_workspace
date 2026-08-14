-- ============================================================
-- 步骤3/3：导出目前诊断（医生最终诊断，按患者聚合）
-- 输出文件：current_diagnoses.txt
-- 每行一条诊断，字段以 |#| 分隔：
--   患者哈希ID | 诊断文本 | IsPrimary | StatusFlag | ModificationType | DiagnosisIndex | ICD10Code
-- ICD10Code 为末位字段（医生最终诊断的医院编码，供诊断编码词典回填）；
-- 追加在末尾不破坏 parse_and_generate.py / build_dict_skeleton.py 的解析（parts[2] 仍为 IsPrimary）。
-- 范围：仅"有诊断分析记录（近90天）"的患者
-- 脱敏：PatientID 加盐哈希（与步骤2同一盐值，保证可关联）
-- ============================================================
SET ECHO OFF
SET FEEDBACK OFF
SET HEADING OFF
SET PAGESIZE 0
SET LINESIZE 32767
SET LONG 200000
SET LONGCHUNKSIZE 200000
SET TRIMSPOOL ON
SET TRIMOUT ON
SET WRAP ON
SET TERMOUT ON

PROMPT 正在导出目前诊断...

SPOOL current_diagnoses.txt

SELECT SUBSTR(RAWTOHEX(STANDARD_HASH('MEDAI_DIAG_EXTRACT' || d.PatientID, 'SHA256')), 1, 16) || '|#|' ||
       REPLACE(REPLACE(NVL(d.DiagnosisText, ''), CHR(10), '\u000A'), '|#|', '¦#¦') || '|#|' ||
       NVL(d.IsPrimary, 0) || '|#|' ||
       NVL(d.StatusFlag, 0) || '|#|' ||
       NVL(d.ModificationType, 0) || '|#|' ||
       NVL(d.DiagnosisIndex, 0) || '|#|' ||
       NVL(d.ICD10Code, '')
FROM diagnosis d
WHERE NVL(d.is_deleted, 0) = 0
  AND d.PatientID IN (
    SELECT p.PatientId
    FROM prompts p
    JOIN promptresult pr ON pr.PromptId = p.PromptId
    WHERE p.PromptTemplateName IN ('诊断分析', '鉴别诊断分析')
      AND NVL(pr.deleted, 0) = 0
      AND pr.ExecutionTime >= SYSDATE - 90
  )
ORDER BY d.PatientID, NVL(d.IsPrimary, 0) DESC, NVL(d.DiagnosisIndex, 0);

SPOOL OFF

PROMPT 导出完成：current_diagnoses.txt（含 ICD10Code 末位字段）

EXIT;
