/**
 * McpResultEnvelope 解析与错误态映射（纯函数，P6-C12）。
 *
 * - parseEnvelope：校验基本结构，非法输入返回 null（容错，避免渲染崩溃）
 * - truncationText：截断提示"已显示 N 条，共 M 条"（旧信封无 totalCount 时降级"已截断"）
 * - classifyError：错误码/错误文本 → 医生可读的卡片错误态
 *
 * @module @medai/dsh-ui-report-card/envelope
 */

export interface McpResultEnvelope {
  patientId?: string
  patientLabel?: string
  items?: unknown[]
  truncated?: boolean
  totalCount?: number
  sourceRefs?: string[]
}

export type CardErrorKind = 'unauthorized' | 'forbidden' | 'timeout' | 'tool-error'

/** 错误态 → 医生文案（唯一事实源，N2b 渲染层直接消费）。 */
export const ERROR_MESSAGES: Record<CardErrorKind, string> = {
  unauthorized: '本机未授权，请重新登录工作站',
  forbidden: '该患者不在您的科室范围内，无法查询',
  timeout: '查询超时，请重试',
  'tool-error': '查询失败，请稍后重试',
}

/**
 * 解析工具输出为信封；非对象 / items 非数组视为非法（返回 null）。
 * @param raw - MCP 工具返回的原始对象
 */
export function parseEnvelope(raw: unknown): McpResultEnvelope | null {
  if (typeof raw !== 'object' || raw === null) return null
  const env = raw as McpResultEnvelope
  if (!Array.isArray(env.items)) return null
  return env
}

/**
 * 截断提示文案；未截断返回 null（不显示提示）。
 * @param env - 已解析信封（或直接传原始对象，内部会解析）
 */
export function truncationText(env: McpResultEnvelope): string | null {
  if (!env || env.truncated !== true) return null
  const shown = Array.isArray(env.items) ? env.items.length : 0
  if (typeof env.totalCount === 'number') {
    return `已显示 ${shown} 条，共 ${env.totalCount} 条`
  }
  return '已截断'
}

/**
 * 错误分类：401 → 未授权；403/科室拒绝 → 越权；超时 → timeout；其余 → tool-error。
 * @param code - 错误码（如 HTTP 状态）
 * @param text - 错误文本（工具返回/错误消息）
 */
export function classifyError(code: string | undefined, text: string): CardErrorKind {
  const t = (text ?? '').toLowerCase()
  if (code === '401' || t.includes('401') || t.includes('未登录') || t.includes('unauthorized')) {
    return 'unauthorized'
  }
  if (code === '403' || t.includes('403') || t.includes('科室') || t.includes('无权') || t.includes('forbidden')) {
    return 'forbidden'
  }
  if (t.includes('超时') || t.includes('timed out') || t.includes('timeout')) {
    return 'timeout'
  }
  return 'tool-error'
}
