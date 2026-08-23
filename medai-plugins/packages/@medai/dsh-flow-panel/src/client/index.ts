/**
 * @medai/dsh-flow-panel client 半（TDD 指南 C10~C12，browser bundle）。
 *
 * 三路注册：
 *   ① tool.call.toolview keyed renderer（既有）：medai_flow_tasks 单患者任务卡片；
 *   ② shell.overlay（G4 常驻概要角标）：全局浮层「N 进行中 · M 失败」；
 *   ③ conversation.view（G4 流程看板 Tab）：与 Chat/Trajectory 并列的完整看板。
 * 数据均经 host 半 G3 同源端点（/medai/flow-board）获取，client 不持凭据。
 */

import { FlowPanel } from './FlowPanel.js'
import { BoardBadge } from './BoardBadge.js'
import { BoardTab } from './BoardTab.js'
import { MEDAI_FLOW_STYLES, STYLE_TAG_ID } from './styles.js'

export const name = '@medai/dsh-flow-panel'

/** Required service: the slot registry that owns the tool.call.toolview seats. */
export const inject = ['slots']

/**
 * 幂等注入插件样式（<style data-plugin="@medai/dsh-flow-panel">）。
 * 带 data-plugin 属性 → 纳入 DSH client-modules 样式认领/清理（HMR、卸载自动管理）；
 * 重复 apply 不产生重复标签（同 data-plugin 已存在则跳过）。
 */
function ensureStylesInjected(): void {
  if (typeof document === 'undefined') return
  if (document.head.querySelector(`style[data-plugin=${JSON.stringify(STYLE_TAG_ID)}]`) !== null) return
  const tag = document.createElement('style')
  tag.setAttribute('data-plugin', STYLE_TAG_ID)
  tag.textContent = MEDAI_FLOW_STYLES
  document.head.append(tag)
}

/** 注册 key：本地工具名 + MCP 前缀兜底（既有 toolview 卡片）。 */
export const TOOL_KEYS = ['medai_flow_tasks', 'mcp__medai__medai_flow_tasks']

interface SlotCtx {
  slots: {
    inject(key: string, provider: () => unknown): unknown
    register(options: { name: string; key?: string; id?: string; label?: string }, component: unknown): unknown
  }
}

/** 浏览器端注册三路 UI（toolview 卡片 + overlay 角标 + 流程看板 Tab）。 */
export function apply(ctx: SlotCtx): void {
  // 样式先行：三路 UI 的类名样式统一由本插件注入
  ensureStylesInjected()
  // ① tool.call.toolview（既有单患者卡片）
  for (const key of TOOL_KEYS) {
    ctx.slots.inject('tool.call.toolview', () =>
      ctx.slots.register({ name: 'tool.call.toolview', key }, FlowPanel))
  }
  // ② shell.overlay 常驻概要角标（root scope，全场景可见）
  ctx.slots.inject('shell.overlay', () =>
    ctx.slots.register({ name: 'shell.overlay', id: 'medai-flow-badge' }, BoardBadge))
  // ③ conversation.view 流程看板 Tab（session scope，与 Chat/Trajectory 并列）
  ctx.slots.inject('conversation.view', () =>
    ctx.slots.register({ name: 'conversation.view', id: 'medai-flow-board', label: '流程看板' }, BoardTab))
}

// 注意：禁止 export default。vendor/loader 的 unwrapExports 优先取
// `exports.default ?? exports`，default 存在时会拿到裸 apply 函数（无 inject
// 属性），导致 Cordis 激活报 "cannot get property slots without inject"。
// 对齐官方 tsdown 产物：仅命名导出 apply/inject/name。
