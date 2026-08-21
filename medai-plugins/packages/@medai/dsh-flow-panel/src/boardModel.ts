/**
 * boardModel（G4 呈现面渲染模型，纯函数，TDD 指南 C9）。
 *
 * 将后端契约①（FlowBoardResult JSON）映射为医生可读视图：
 * 概要串（"3 进行中 · 1 失败"）、异常标记（failed>0）、病人排序（失败置顶 →
 * 进行中 → 其他）、单病人流程摘要。未知值容错降级（不崩溃，对齐 model.ts 惯例）。
 *
 * @module @medai/dsh-flow-panel/boardModel
 */

import { flowStatusLabel, flowStepLabel } from './model.js'

/** 契约① 结构（字段全部容错）。 */
export interface BoardCounts {
  active?: unknown
  done?: unknown
  failed?: unknown
  cancelled?: unknown
}

export interface FlowItem {
  flowId?: unknown
  currentStep?: unknown
  status?: unknown
  failureReason?: unknown
  updatedAt?: unknown
}

export interface PatientBoard {
  patientId?: unknown
  name?: unknown
  bedNumber?: unknown
  flows?: unknown
}

export interface BoardData {
  counts: BoardCounts
  patients: PatientBoard[]
}

/** flowId → 医生可读流程名（未知降级原文）。 */
export const FLOW_LABELS: Record<string, string> = {
  'admission-first-mile': '首诊收治',
}

export function flowLabel(flowId: unknown): string {
  if (typeof flowId !== 'string' || flowId === '') return '流程'
  return FLOW_LABELS[flowId] ?? flowId
}

function toInt(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

/** 容错解析契约① JSON（非法/缺结构 → null，不崩溃）。 */
export function parseBoardData(env: unknown): BoardData | null {
  if (typeof env !== 'object' || env === null) return null
  const counts = (env as { counts?: unknown }).counts
  const patients = (env as { patients?: unknown }).patients
  if (typeof counts !== 'object' || counts === null) return null
  if (!Array.isArray(patients)) return null
  return {
    counts: counts as BoardCounts,
    patients: patients as PatientBoard[],
  }
}

/** 概要串：`3 进行中 · 1 失败`；全零也显示（灰标让医生知道功能在运行）；无数据 → null。 */
export function buildSummary(data: BoardData | null): string | null {
  if (!data) return null
  const active = toInt(data.counts.active)
  const failed = toInt(data.counts.failed)
  return `${active} 进行中 · ${failed} 失败`
}

/** 异常标记：failed>0 → 角标红色高亮。 */
export function isAlerted(data: BoardData | null): boolean {
  return data !== null && toInt(data.counts.failed) > 0
}

function statusRank(item: PatientBoard): number {
  const first = Array.isArray(item.flows) ? item.flows[0] : undefined
  const status = typeof first === 'object' && first !== null
    ? (first as FlowItem).status
    : undefined
  if (status === 'FAILED') return 0
  if (status === 'ACTIVE') return 1
  return 2
}

/** 病人排序：失败置顶 → 进行中 → 其他（稳定排序，保持原相对顺序）。 */
export function sortPatients(patients: PatientBoard[]): PatientBoard[] {
  if (!Array.isArray(patients)) return []
  return [...patients].sort((a, b) => statusRank(a) - statusRank(b))
}

/** 单病人流程摘要：`首诊收治·等待医嘱窗口（约1小时）·进行中`（取首个实例）。 */
export function patientFlowSummary(patient: PatientBoard): string {
  const flows = Array.isArray(patient.flows) ? patient.flows : []
  if (flows.length === 0) return '暂无流程任务'
  const first = flows[0] as FlowItem
  const name = flowLabel(first.flowId)
  const step = flowStepLabel(first.currentStep)
  const status = flowStatusLabel(first.status)
  return `${name}·${step}·${status}`
}
