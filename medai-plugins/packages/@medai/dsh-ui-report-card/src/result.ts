/**
 * 工具调用块 → 信封 / 错误态（纯函数，P6-C13；P6-C27 契约适配）。
 *
 * block 是 DSH `tool.call.toolview` 传入的真实 ToolCallBlock（自声明鸭子类型）：
 * - 运行中（RunningToolCall）：{ name, argsRaw, time, callView, subCalls }——无结果；
 * - 已结算（ToolResultNode）：{ content: [{type:'text', text}], isError, error, ... }——
 *   **MCP 信封在 content[0].text**（SDK ContentBlock 文本，非 block.result）。
 *
 * 早期实现误读为 `block.result` 导致解析恒失败 → keyed 命中后整行空白
 * （P6-C27 联调发现，修复：按 content 取文本）。
 *
 * @module @medai/dsh-ui-report-card/result
 */

import { parseEnvelope, classifyError, type McpResultEnvelope, type CardErrorKind } from './envelope.js'

/** ToolCallBlock 的最小视图（running/settled 两态，自声明契约）。 */
export interface ToolResultLike {
  /** 运行中态：工具名。 */
  name?: string
  /** 运行中态：参数原文（JSON 字符串）。 */
  argsRaw?: string
  /** 已结算态：SDK ContentBlock 列表（MCP 信封在 text）。 */
  content?: Array<{ type?: string; text?: string }>
  isError?: boolean
  error?: { name?: string; code?: string; message?: string } | string
}

/** 判断调用是否已结算（有非空结果内容）。 */
export function isSettled(block: ToolResultLike | null | undefined): boolean {
  return Array.isArray(block?.content)
    && block.content.some(c => typeof c?.text === 'string' && c.text !== '')
}

/** 已结算结果文本（content 中 text 块拼接；无文本返回 null）。 */
export function resultTextOf(block: ToolResultLike | null | undefined): string | null {
  if (!isSettled(block)) return null
  const parts: string[] = []
  for (const c of block!.content ?? []) {
    if (typeof c?.text === 'string' && c.text !== '') parts.push(c.text)
  }
  return parts.length > 0 ? parts.join('\n') : null
}

/** 运行中参数摘要（argsRaw 首行；空返回 undefined）。 */
export function argsSummary(block: ToolResultLike | null | undefined): string | undefined {
  const raw = block?.argsRaw
  if (typeof raw !== 'string' || raw === '') return undefined
  const nl = raw.indexOf('\n')
  const first = nl === -1 ? raw : raw.slice(0, nl)
  return first.length > 80 ? `${first.slice(0, 80)}…` : first
}

/** 错误文本（error 对象/字符串 → 展示文本；无返回 null）。 */
export function errorTextOf(block: ToolResultLike | null | undefined): string | null {
  if (!block || block.isError !== true) return null
  const e = block.error
  if (typeof e === 'string') return e === '' ? null : e
  if (e && typeof e === 'object') {
    const msg = e.message ?? e.code ?? e.name
    return typeof msg === 'string' && msg !== '' ? msg : null
  }
  return null
}

/**
 * 从工具调用块解析信封；不可解析返回 null（渲染兜底，不崩溃）。
 * 真实块结构：settled 态信封在 content[0].text（JSON 字符串，可能带 MCP
 * 转义 `\"` ——先尝试直解，失败去转义再解）。
 */
export function parseToolResult(block: ToolResultLike | null | undefined): McpResultEnvelope | null {
  if (!block) return null
  const text = resultTextOf(block)
  if (text === null) return null
  const first = tryParseEnvelope(text)
  if (first !== null) return first
  // MCP 转义场景：`{\"patientId\":...}` → 去转义后重解
  if (text.includes('\\"')) {
    const unescaped = text.replace(/\\"/g, '"')
    const second = tryParseEnvelope(unescaped)
    if (second !== null) return second
  }
  return null
}

function tryParseEnvelope(text: string): McpResultEnvelope | null {
  try {
    return parseEnvelope(JSON.parse(text))
  } catch {
    return null
  }
}

/**
 * 错误块 → 卡片错误态；非错误块返回 null。
 */
export function blockErrorView(block: ToolResultLike | null | undefined): CardErrorKind | null {
  if (!block || block.isError !== true) return null
  const text = errorTextOf(block) ?? ''
  return classifyError(undefined, text)
}
