/**
 * maskEvents（P6-C8，US-N2-04 事件掩码）。
 *
 * 推送前对"将要推送的事件副本"掩码：姓名经映射表替换（复用 pii-guard
 * `applyNameMapping`，长名优先防子串误替换）+ 确定性正则兜底（复用
 * pii-guard `maskPii`，身份证/手机/医保/住院号，与 M2/M3 同源）。
 *
 * **不改写 DSH 本地会话原文**（agent 理解不受影响）；映射为空降级纯正则。
 * 嵌套对象不递归掩码（payload 结构未知，联调校正点，见 syncEngine.test）。
 *
 * @module @medai/dsh-session-sync/maskEvents
 */

import { maskPii } from '@medai/dsh-pii-guard/src/patterns'
import { applyNameMapping } from '@medai/dsh-pii-guard/src/mapper'
import type { NameMapping } from '@medai/dsh-pii-guard/src/mapper'
import type { SyncEvent } from './syncEngine'

export type { NameMapping }

/** 单条文本：姓名映射替换 + 正则兜底。 */
export function maskEventText(text: string, mapping?: NameMapping | null): string {
  return maskPii(applyNameMapping(text, mapping ?? undefined).text)
}

/** 事件副本掩码：payload 顶层字符串字段全量处理，非字符串原样保留。 */
export function maskEvents(events: readonly SyncEvent[], mapping?: NameMapping | null): SyncEvent[] {
  return events.map((e) => ({
    ...e,
    payload: maskPayload(e.payload, mapping),
  }))
}

function maskPayload(payload: unknown, mapping?: NameMapping | null): unknown {
  if (typeof payload !== 'object' || payload === null) return payload
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(payload)) {
    out[k] = typeof v === 'string' ? maskEventText(v, mapping) : v
  }
  return out
}
