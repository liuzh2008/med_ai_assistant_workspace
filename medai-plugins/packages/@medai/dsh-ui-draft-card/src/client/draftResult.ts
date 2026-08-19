/**
 * 工具调用块 → 草稿视图（纯函数，T2.5 卡片消费方）。
 *
 * block 是 DSH `tool.call.toolview` 传入的真实 ToolCallBlock（自声明鸭子类型，
 * 对齐 dsh-ui-report-card result.ts 经验）：
 * - 运行中（RunningToolCall）：{ name, argsRaw, ... }——无结果；
 * - 已结算（ToolResultNode）：{ content: [{type:'text', text}], isError, error, ... }——
 *   工具结果 JSON 在 content[0].text（SDK ContentBlock 文本，非 block.result）。
 *
 * 解析失败返回 null（降级态：卡片落通用工具行，不崩溃）。
 *
 * @module @medai/dsh-ui-draft-card/client/draftResult
 */

/** 工具调用块最小视图（running/settled 两态，自声明契约）。 */
export interface ToolBlockLike {
  name?: string
  argsRaw?: string
  content?: Array<{ type?: string; text?: string }>
  isError?: boolean
  error?: { name?: string; code?: string; message?: string } | string
}

/** 同步生成工具契约视图（medai_record_generate_sync 返回；卡片只消费脱敏字段）。 */
export interface DraftView {
  status: string
  promptId?: string
  summary?: string
  message?: string
  viewHint?: string
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

/** 单次 JSON 解析（直解，兼容 MCP 转义 `\"` 去转义重解）。 */
export function parseDraftResult(text: unknown): DraftView | null {
  if (typeof text !== 'string' || text.trim() === '') return null
  const first = tryParse(text)
  if (first !== null) return first
  if (text.includes('\\"')) return tryParse(text.replace(/\\"/g, '"'))
  return null
}

function tryParse(text: string): DraftView | null {
  try {
    const value = JSON.parse(text) as unknown
    if (typeof value !== 'object' || value === null) return null
    const v = value as Record<string, unknown>
    if (typeof v.status !== 'string') return null
    const view: DraftView = { status: v.status }
    if (typeof v.promptId === 'string' && v.promptId !== '') view.promptId = v.promptId
    if (typeof v.summary === 'string' && v.summary !== '') view.summary = v.summary
    if (typeof v.message === 'string' && v.message !== '') view.message = v.message
    if (typeof v.viewHint === 'string' && v.viewHint !== '') view.viewHint = v.viewHint
    return view
  } catch {
    return null
  }
}

/** 工具调用块 → 草稿视图；不可解析返回 null（渲染兜底）。 */
export function parseBlockResult(block: ToolBlockLike | null | undefined): DraftView | null {
  return parseDraftResult(blockTextOf(block))
}

/** 错误块文本（error 对象/字符串 → 展示文本；无返回 null）。 */
export function errorTextOf(block: ToolBlockLike | null | undefined): string | null {
  if (!block || block.isError !== true) return null
  const e = block.error
  if (typeof e === 'string') return e === '' ? null : e
  if (e && typeof e === 'object') {
    const msg = e.message ?? e.code ?? e.name
    return typeof msg === 'string' && msg !== '' ? msg : null
  }
  return null
}
