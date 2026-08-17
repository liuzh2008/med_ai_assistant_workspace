/**
 * G2-C1 索要意图检测（规则层，纯函数）。
 *
 * 双命中判定：消息含索要动词 × 目录检索非空 → 硬触发（保守防误报）。
 * LLM 语义兜底（非硬触发时模型自主判断）由工具 description 承担——规则不僭越模型判断。
 *
 * @module @medai/dsh-feature-guide/intent
 */

import type { FeatureCatalog, FeatureEntry } from './catalog.js'

/**
 * 索要/导航动词模式表（数据化：增删动词不动逻辑）。
 * 索要：需要/想要/有没有/能不能/支持吗/帮我做/加一个/实现/开发/做一个；
 * 导航（2026-08-17 3080 实测缺口补）：跳转到/跳转/打开/进入/导航到——用户直接要求
 * 去某功能页面时同样需要引导核对（返回路由供跳转按钮，避免 agent 乱用浏览器工具）。
 */
export const WANT_VERBS: readonly string[] = [
  '需要',
  '想要',
  '有没有',
  '能不能',
  '支持吗',
  '帮我做',
  '加一个',
  '实现',
  '开发',
  '做一个',
  '跳转到',
  '跳转',
  '打开',
  '进入',
  '导航到',
]

/**
 * 双命中检测（纯函数，注入目录便于测试）：
 * ①消息含任一索要动词；②catalog.search 非空。两者缺一返回空数组。
 * 非字符串输入返回空数组，不抛异常（降级铁律）。
 */
export function detectFeatureIntent(message: unknown, catalog: FeatureCatalog): FeatureEntry[] {
  if (typeof message !== 'string' || message.trim() === '') return []
  if (!WANT_VERBS.some((verb) => message.includes(verb))) return []
  try {
    return catalog.search(message)
  } catch {
    return [] // 目录异常不触发（不阻塞对话）
  }
}
