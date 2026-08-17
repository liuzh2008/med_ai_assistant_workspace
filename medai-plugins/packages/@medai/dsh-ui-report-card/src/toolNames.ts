/**
 * 7 个一期 MCP 工具名 → DataSection 映射（P6-C13 注册清单）。
 *
 * 与后端 `@Tool(name=...)` 一致（mcp/tool/ 下 PatientQueryTool/MedicalRecordQueryTool/
 * LabExamQueryTool）；新板块工具按《插件化开发规范》§8.1 在此登记即可注册卡片。
 *
 * @module @medai/dsh-ui-report-card/toolNames
 */

export const MEDAI_TOOL_PREFIX = 'mcp__medai__'

/** wire tool name → DataSection 枚举名。 */
export const REPORT_TOOLS: Record<string, string> = {
  'mcp__medai__medai_patient_list_by_department': 'PATIENT_LIST',
  'mcp__medai__medai_patient_basic_info': 'PATIENT_BASIC',
  'mcp__medai__medai_patient_diagnoses': 'DIAGNOSIS',
  'mcp__medai__medai_patient_orders': 'ORDER',
  'mcp__medai__medai_medical_records': 'MEDICAL_RECORD',
  'mcp__medai__medai_lab_results': 'LAB_RESULT',
  'mcp__medai__medai_exam_results': 'EXAM_RESULT',
}

/** 注册清单：全部工具名。 */
export const TOOL_NAMES: string[] = Object.keys(REPORT_TOOLS)

/** 注册清单：全部 DataSection 值（与工具一一对应）。 */
export const TOOL_SECTION_KEYS: string[] = Object.values(REPORT_TOOLS)

/** 工具名 → DataSection；未知工具返回 undefined（不渲染卡片，落 GenericToolCard）。 */
export function sectionKeyOf(toolName: string): string | undefined {
  return REPORT_TOOLS[toolName]
}

/** 折叠行展示名：去 `mcp__medai__` 前缀（如 medai_patient_diagnoses）。 */
export function displayNameOf(toolName: string): string {
  if (typeof toolName !== 'string' || toolName === '') return 'Tool call'
  return toolName.startsWith(MEDAI_TOOL_PREFIX) ? toolName.slice(MEDAI_TOOL_PREFIX.length) : toolName
}
