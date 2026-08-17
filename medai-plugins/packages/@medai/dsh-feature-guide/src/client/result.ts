/**
 * G3-C1 契约 ② 结果解析（纯函数，卡片消费方）。
 *
 * 解析失败返回 null（降级态：卡片落通用工具行，不崩溃）。
 * MCP 转义（`\"`）兜底去转义重解（对齐 ui-report-card parseToolResult 经验）。
 *
 * @module @medai/dsh-feature-guide/client/result
 */

import { GUIDE_RESULT_KEYS } from '../tool.js'

/** 契约 ② 渲染视图（G3 只消费契约，不持有目录）。 */
export interface GuideResultView {
  matched: boolean
  features: Array<{
    id: string
    name: string
    summary: string
    description: string
    route: string
    permission?: string
  }>
  hint?: string
}

/** 单条 feature 字段校验（id/name/summary/description/route 均为非空字符串）。 */
function isValidFeature(value: unknown): value is GuideResultView['features'][number] {
  if (typeof value !== 'object' || value === null) return false
  const f = value as Record<string, unknown>
  for (const key of ['id', 'name', 'summary', 'description', 'route'] as const) {
    if (typeof f[key] !== 'string' || (f[key] as string).length === 0) return false
  }
  if (f.permission !== undefined && typeof f.permission !== 'string') return false
  return true
}

/** 顶层结果校验。 */
function isValidResult(value: unknown): value is GuideResultView {
  if (typeof value !== 'object' || value === null) return false
  const r = value as Record<string, unknown>
  if (typeof r[GUIDE_RESULT_KEYS.matched] !== 'boolean') return false
  const features = r[GUIDE_RESULT_KEYS.features]
  if (!Array.isArray(features) || !features.every(isValidFeature)) return false
  if (r[GUIDE_RESULT_KEYS.hint] !== undefined && typeof r[GUIDE_RESULT_KEYS.hint] !== 'string') return false
  return true
}

/** 单次 JSON 解析（直解）。 */
function tryParse(text: string): GuideResultView | null {
  try {
    const value = JSON.parse(text) as unknown
    return isValidResult(value) ? value : null
  } catch {
    return null
  }
}

/**
 * 契约 ② 文本 → 渲染视图；非法返回 null（降级态）。
 * 直解失败且含 MCP 转义（`\"`）时去转义重解。
 */
export function parseGuideResult(text: unknown): GuideResultView | null {
  if (typeof text !== 'string' || text.trim() === '') return null
  const first = tryParse(text)
  if (first !== null) return first
  if (text.includes('\\"')) {
    return tryParse(text.replace(/\\"/g, '"'))
  }
  return null
}

/** 工具调用块最小视图（running/settled 两态，对齐 ui-report-card result.ts）。 */
export interface ToolBlockLike {
  name?: string
  argsRaw?: string
  content?: Array<{ type?: string; text?: string }>
  isError?: boolean
  error?: { name?: string; code?: string; message?: string } | string
}

/** 块是否已结算（有非空 text 内容）。 */
export function isSettled(block: ToolBlockLike | null | undefined): boolean {
  return Array.isArray(block?.content)
    && block.content.some((c) => typeof c?.text === 'string' && c.text !== '')
}

/** 已结算块文本（text 块拼接；无文本返回 null）。 */
export function blockTextOf(block: ToolBlockLike | null | undefined): string | null {
  if (!isSettled(block)) return null
  const parts: string[] = []
  for (const c of block!.content ?? []) {
    if (typeof c?.text === 'string' && c.text !== '') parts.push(c.text)
  }
  return parts.length > 0 ? parts.join('\n') : null
}

/** 工具调用块 → 契约 ② 视图；不可解析返回 null（渲染兜底）。 */
export function parseBlockResult(block: ToolBlockLike | null | undefined): GuideResultView | null {
  return parseGuideResult(blockTextOf(block))
}
