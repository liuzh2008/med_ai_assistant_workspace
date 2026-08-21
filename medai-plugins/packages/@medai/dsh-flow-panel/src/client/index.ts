/**
 * @medai/dsh-flow-panel client 半（TDD 指南 T4.3，browser bundle）。
 *
 * 为 medai_flow_tasks 注册 `tool.call.toolview` keyed renderer（双 key：
 * 本地工具名 + MCP 前缀兜底，对齐 draft-card 惯例）。面板渲染当前病人
 * 流程任务情况（进度/状态/失败原因），任务项后续联调接入 AI 辅助页面跳转。
 */

import { FlowPanel } from './FlowPanel.js'

export const name = '@medai/dsh-flow-panel'

/** Required service: the slot registry that owns the tool.call.toolview seats. */
export const inject = ['slots']

/** 注册 key：本地工具名 + MCP 前缀兜底。 */
export const TOOL_KEYS = ['medai_flow_tasks', 'mcp__medai__medai_flow_tasks']

interface SlotCtx {
  slots: {
    inject(key: string, provider: () => unknown): unknown
    register(options: { name: string; key: string }, component: unknown): unknown
  }
}

/** 浏览器端为 medai_flow_tasks 注册任务面板 renderer。 */
export function apply(ctx: SlotCtx): void {
  for (const key of TOOL_KEYS) {
    ctx.slots.inject('tool.call.toolview', () =>
      ctx.slots.register({ name: 'tool.call.toolview', key }, FlowPanel))
  }
}

// 注意：禁止 export default。vendor/loader 的 unwrapExports 优先取
// `exports.default ?? exports`，default 存在时会拿到裸 apply 函数（无 inject
// 属性），导致 Cordis 激活报 "cannot get property slots without inject"。
// 对齐官方 tsdown 产物：仅命名导出 apply/inject/name。
