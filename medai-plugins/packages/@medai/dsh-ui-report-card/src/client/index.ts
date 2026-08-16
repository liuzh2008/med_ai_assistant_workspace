/**
 * @medai/dsh-ui-report-card client 半（P6-C13，browser bundle）。
 *
 * 按 wire tool name 为 7 个一期 MCP 工具注册 `tool.call.toolview` keyed renderer：
 * 未注册工具名自动落 DSH 通用工具行（GenericToolCard）；新板块工具在
 * `toolNames.ts` 登记即可。类型自声明（DSH `ui-tool` slot 契约：keyed, scope session）。
 *
 * inject 声明 `slots`（对齐官方 client 插件 `ui-tool`/`ui-file-browser`）：
 * Cordis 严格代理下，未声明 inject 就访问 ctx.slots 会直接抛错，不能靠运行时自检。
 */

import { ReportCard } from '../ReportCard.js'
import { TOOL_NAMES } from '../toolNames.js'

export const name = '@medai/dsh-ui-report-card'

/** Required service: the slot registry that owns the tool.call.toolview seats. */
export const inject = ['slots']

interface SlotCtx {
  slots: {
    inject(key: string, provider: () => unknown): unknown
    register(options: { name: string; key: string }, component: unknown): unknown
  }
}

/** 浏览器端注册 7 个一期 MCP 工具的 toolview keyed renderer。 */
export function apply(ctx: SlotCtx): void {
  for (const toolName of TOOL_NAMES) {
    ctx.slots.inject('tool.call.toolview', () =>
      ctx.slots.register({ name: 'tool.call.toolview', key: toolName }, ReportCard))
  }
}

// 注意：禁止 export default。vendor/loader 的 unwrapExports 优先取
// `exports.default ?? exports`，default 存在时会拿到裸 apply 函数（无 inject
// 属性），导致 Cordis 激活报 "cannot get property slots without inject"。
// 对齐官方 tsdown 产物：仅命名导出 apply/inject（无 default）。
