/**
 * 工具调用块 → 信封 / 错误态（纯函数，P6-C13）。
 *
 * block 是 DSH `tool.call.toolview` 传入的 ToolCallBlock 的最小视图
 * （running/settled 形态；result 可能是对象或 JSON 字符串——MCP 信封转义场景）。
 * 类型自声明（不 import DSH 运行时包），鸭子类型兼容。
 *
 * @module @medai/dsh-ui-report-card/result
 */

import { parseEnvelope, classifyError, type McpResultEnvelope, type CardErrorKind } from './envelope.js'

/** ToolCallBlock 的最小视图（运行中或已结算）。 */
export interface ToolResultLike {
  result?: unknown
  isError?: boolean
  error?: unknown
}

/**
 * 从工具调用块解析信封；不可解析返回 null（渲染兜底，不崩溃）。
 */
export function parseToolResult(block: ToolResultLike | null | undefined): McpResultEnvelope | null {
  if (!block) return null
  const raw = block.result
  if (typeof raw === 'string') {
    try {
      return parseEnvelope(JSON.parse(raw))
    } catch {
      return null
    }
  }
  return parseEnvelope(raw)
}

/**
 * 错误块 → 卡片错误态；非错误块返回 null。
 */
export function blockErrorView(block: ToolResultLike | null | undefined): CardErrorKind | null {
  if (!block || block.isError !== true) return null
  const text = typeof block.error === 'string' ? block.error : ''
  return classifyError(undefined, text)
}
