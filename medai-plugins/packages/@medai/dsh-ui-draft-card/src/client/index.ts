/**
 * @medai/dsh-ui-draft-card client 半（F4 明文草稿卡片，browser bundle）。
 *
 * 按 wire tool name 注册 `tool.call.toolview` keyed renderer（对齐
 * dsh-ui-report-card / dsh-feature-guide 既有写法）：
 *   - 主 key：`medai_record_generate_sync`（TS 本地工具 wire name）；
 *   - 兜底 key：`mcp__medai__medai_record_generate_sync`（若未来收敛到
 *     MCP 前缀通道，keyed slot 域开放，双注册不冲突、未命中落通用行）。
 *
 * inject 声明 `slots`（Cordis 严格代理下未声明 inject 就访问 ctx.slots 会抛错）。
 *
 * 注意：禁止 export default（vendor/loader unwrapExports 优先取 default → 丢失 inject）。
 *
 * @module @medai/dsh-ui-draft-card/client
 */

import { DraftCard } from './DraftCard.js'

export const name = '@medai/dsh-ui-draft-card'

/** Required service: the slot registry that owns the tool.call.toolview seats. */
export const inject = ['slots']

/** keyed slot 注册键（本地工具 wire name + MCP 前缀兜底）。 */
export const TOOL_KEYS = [
  'medai_record_generate_sync',
  'mcp__medai__medai_record_generate_sync',
] as const

interface SlotCtx {
  slots: {
    inject(key: string, provider: () => unknown): unknown
    register(options: { name: string; key: string }, component: unknown): unknown
  }
}

/** 浏览器端注册同步生成工具的 toolview keyed renderer（明文草稿卡片）。 */
export function apply(ctx: SlotCtx): void {
  for (const key of TOOL_KEYS) {
    ctx.slots.inject('tool.call.toolview', () =>
      ctx.slots.register({ name: 'tool.call.toolview', key }, DraftCard))
  }
}
