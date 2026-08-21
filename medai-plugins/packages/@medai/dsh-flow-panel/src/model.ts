/**
 * 流程任务面板视图模型（纯函数，TDD 指南 T4.3 model）。
 *
 * 将 medai_flow_tasks 的信封 items（后端 FlowTasksTool 输出）映射为医生可读
 * 视图：步骤标签（如"入院记录生成中"/"等待医嘱窗口"）、状态标签（进行中/
 * 已完成/失败）、失败原因透出。未知值容错降级（不崩溃）。
 *
 * @module @medai/dsh-flow-panel/model
 */

/** 步骤 ID → 医生可读标签（首诊收治一期；未知步骤降级原文）。 */
export const STEP_LABELS: Record<string, string> = {
  'gen-admission-record': '入院记录生成中',
  'wait-orders-window': '等待医嘱窗口（约1小时）',
  'gen-followups': '首次病程/入院沟通生成中',
}

/** 状态 → 医生可读标签。 */
export const STATUS_LABELS: Record<string, string> = {
  ACTIVE: '进行中',
  DONE: '已完成',
  FAILED: '失败',
}

/** 流程任务项（信封 items 元素，字段全部可选容错）。 */
export interface FlowTaskItem {
  flowId?: unknown
  currentStep?: unknown
  status?: unknown
  definitionVersion?: unknown
  failureReason?: unknown
  updatedAt?: unknown
}

/** 医生可读视图项。 */
export interface FlowTaskView {
  flowId: string
  stepLabel: string
  status: string
  statusLabel: string
  failureReason: string | null
  updatedAt: string
}

/** 面板模型。 */
export interface FlowPanelModel {
  tasks: FlowTaskView[]
  empty: boolean
}

/** 步骤 ID → 标签（未知/空 → 原文或"待启动"）。 */
export function flowStepLabel(step: unknown): string {
  if (typeof step !== 'string' || step === '') return '待启动'
  return STEP_LABELS[step] ?? step
}

/** 状态 → 标签（未知 → 原文）。 */
export function flowStatusLabel(status: unknown): string {
  if (typeof status !== 'string' || status === '') return '未知'
  return STATUS_LABELS[status] ?? status
}

/** 信封 → 面板模型；非法输入返回空模型（不崩溃）。 */
export function buildPanelModel(env: unknown): FlowPanelModel {
  if (typeof env !== 'object' || env === null) return { tasks: [], empty: true }
  const items = (env as { items?: unknown }).items
  if (!Array.isArray(items) || items.length === 0) return { tasks: [], empty: true }

  const tasks: FlowTaskView[] = []
  for (const raw of items) {
    const item = (typeof raw === 'object' && raw !== null ? raw : {}) as FlowTaskItem
    tasks.push({
      flowId: typeof item.flowId === 'string' && item.flowId !== '' ? item.flowId : '未知流程',
      stepLabel: flowStepLabel(item.currentStep),
      status: typeof item.status === 'string' ? item.status : '未知',
      statusLabel: flowStatusLabel(item.status),
      failureReason: typeof item.failureReason === 'string' && item.failureReason !== ''
        ? item.failureReason
        : null,
      updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : '',
    })
  }
  return { tasks, empty: false }
}
