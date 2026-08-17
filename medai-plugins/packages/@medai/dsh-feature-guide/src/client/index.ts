/**
 * @medai/dsh-feature-guide client 半（G3 说明呈现与跳转触发，browser bundle）。
 *
 * 按 wire tool name 注册 `tool.call.toolview` keyed renderer（对齐 ui-report-card）：
 * - inject 声明 `slots`（Cordis 严格代理下未声明 inject 就访问 ctx.slots 会抛错）；
 * - FeatureGuideCard 为整行组件（折叠摘要行 + 展开说明卡片 + 跳转按钮）。
 *
 * 注意：禁止 export default（vendor/loader unwrapExports 优先取 default → 丢失 inject）。
 *
 * @module @medai/dsh-feature-guide/client
 */

import { FeatureGuideCard } from './FeatureGuideCard.js'
import { TOOL_NAME } from '../tool.js'

export const name = '@medai/dsh-feature-guide'

/** Required service: the slot registry that owns the tool.call.toolview seats. */
export const inject = ['slots']

interface SlotCtx {
  slots: {
    inject(key: string, provider: () => unknown): unknown
    register(options: { name: string; key: string }, component: unknown): unknown
  }
}

/** 浏览器端注册 medai_feature_guide 的 toolview keyed renderer。 */
export function apply(ctx: SlotCtx): void {
  ctx.slots.inject('tool.call.toolview', () =>
    ctx.slots.register({ name: 'tool.call.toolview', key: TOOL_NAME }, FeatureGuideCard))
}
