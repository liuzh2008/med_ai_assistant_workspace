/**
 * 报告单数据模型：DataSection → 渲染分派与字段映射（纯函数，P6-C13）。
 *
 * 后端 `DataSection` 枚举（mcp/desensitize/DataSection.java）的板块名 → 前端分派，
 * 未知板块（护理/麻醉等未来新增）走 generic 安全兜底（显示全部值）。
 *
 * @module @medai/dsh-ui-report-card/sections
 */

export type SectionKind =
  | 'patient-list'
  | 'lab-report'
  | 'exam-report'
  | 'record-timeline'
  | 'diagnosis-list'
  | 'order-groups'
  | 'generic'

export interface ReportRow {
  label: string
  value: string
  /** 检验异常标记（abnormalIndicator 非空 → 高亮）。 */
  abnormal?: boolean
}

export interface ReportSection {
  kind: SectionKind
  title: string
  rows: ReportRow[]
}

/** 后端板块枚举 → 前端分派（未知 → generic）。 */
const SECTION_KIND_MAP: Record<string, SectionKind> = {
  PATIENT_LIST: 'patient-list',
  PATIENT_BASIC: 'patient-list',
  LAB_RESULT: 'lab-report',
  EXAM_RESULT: 'exam-report',
  MEDICAL_RECORD: 'record-timeline',
  DIAGNOSIS: 'diagnosis-list',
  ORDER: 'order-groups',
}

export function sectionOf(sectionKey: string | undefined): SectionKind {
  if (!sectionKey) return 'generic'
  return SECTION_KIND_MAP[sectionKey] ?? 'generic'
}

function str(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v)
}

/** 通用字段 → 行（未知板块安全兜底：字段名做 label）。 */
function genericRows(item: Record<string, unknown>): ReportRow[] {
  return Object.entries(item).map(([key, value]) => ({ label: key, value: str(value) }))
}

/**
 * 把单个 item（白名单字段）映射为报告单行结构。
 * @param sectionKey - 后端 DataSection 枚举名（如 'LAB_RESULT'）
 * @param item - 信封 items 中的一项
 */
export function buildReportSection(sectionKey: string | undefined, item: Record<string, unknown>): ReportSection {
  const kind = sectionOf(sectionKey)
  const title = str(item.labName || item.checkName || item.diagnosisText || item.orderName || item.docTypeName || '')
  switch (kind) {
    case 'lab-report': {
      const result = str(item.labResult)
      const unit = str(item.unit)
      const abnormal = Boolean(item.abnormalIndicator && String(item.abnormalIndicator).length > 0)
      const rows: ReportRow[] = [
        { label: '结果', value: unit ? `${result} ${unit}` : result, abnormal },
        { label: '参考范围', value: str(item.referenceRange) },
        { label: '时间', value: str(item.labReportTime) },
      ].filter((r) => r.value !== '')
      return { kind, title, rows }
    }
    case 'exam-report': {
      const rows: ReportRow[] = [
        { label: '类型', value: str(item.checkType) },
        { label: '描述', value: str(item.checkDescription) },
        { label: '结论', value: str(item.checkConclusion) },
        { label: '时间', value: str(item.checkReportTime) },
      ].filter((r) => r.value !== '')
      return { kind, title, rows }
    }
    case 'record-timeline': {
      const label = [str(item.recordDate), str(item.docTypeName)].filter(Boolean).join(' ')
      return {
        kind,
        title: label,
        rows: [{ label, value: str(item.content) }],
      }
    }
    case 'diagnosis-list': {
      return {
        kind,
        title: str(item.diagnosisText),
        rows: [{ label: str(item.icd10Code), value: str(item.diagnosisText) }],
      }
    }
    case 'order-groups': {
      const detail = [str(item.dosage), str(item.unit), str(item.frequency), str(item.route)].filter(Boolean).join(' ')
      return {
        kind,
        title: str(item.orderName),
        rows: [{ label: str(item.orderName), value: detail }],
      }
    }
    default:
      return { kind: 'generic', title, rows: genericRows(item) }
  }
}
