/**
 * maskEvents 测试（P6-C8，US-N2-04 事件同步-掩码）。
 *
 * 验收标准：
 *   - DSH 会话事件（含用户输入姓名"张三"）→ 推送副本姓名掩码为"张*"
 *     （复用 @medai/dsh-pii-guard patterns/mapper，与 M2/M3 同源）；
 *   - 身份证/手机/医保/住院号确定性正则掩码（对齐 patterns.test.ts 样本）；
 *   - 只作用于"将要推送的事件副本"，不改写 DSH 本地会话内的原文。
 */

import { describe, expect, it } from 'vitest'
import { maskEvents, maskEventText } from './maskEvents'
import type { SyncEvent } from './syncEngine'

const NAME_MAPPING = { 张三: '张*', 张伟: '张*', 欧阳娜娜: '欧*' }

function makeEvent(payload: Record<string, unknown>, type = 'message'): SyncEvent {
  return { sessionId: 'sess-1', seq: 1, type, payload }
}

/** 测试辅助：SyncEvent.payload 为 unknown，断言处取为可索引对象。 */
function payloadOf(event: SyncEvent): Record<string, unknown> {
  return (event.payload ?? {}) as Record<string, unknown>
}

describe('maskEvents（US-N2-04 事件掩码，与 pii-guard 同源）', () => {
  it('身份证掩码（样本对齐 patterns.test.ts）', () => {
    const out = maskEvents([makeEvent({ content: '身份证110101199001011234' })])
    expect(payloadOf(out[0]).content).toBe('身份证1101**********1234')
  })

  it('手机号掩码', () => {
    const out = maskEvents([makeEvent({ content: '电话13800138000' })])
    expect(payloadOf(out[0]).content).toBe('电话138****8000')
  })

  it('医保号掩码', () => {
    const out = maskEvents([makeEvent({ content: '医保B123456' })])
    expect(payloadOf(out[0]).content).toBe('医保B1****56')
  })

  it('住院号掩码', () => {
    const out = maskEvents([makeEvent({ content: '住院号ZY20260814001' })])
    expect(payloadOf(out[0]).content).toBe('住院号ZY*******4001')
  })

  it('姓名掩码：映射表命中 → 替换为泛化指代（张*）', () => {
    const out = maskEvents([makeEvent({ content: '患者张三今天发烧' })], NAME_MAPPING)
    expect(payloadOf(out[0]).content).toBe('患者张*今天发烧')
  })

  it('映射为空 → 纯正则降级（姓名不掩码、身份证仍掩码，不抛异常）', () => {
    const out = maskEvents([makeEvent({ content: '患者张三身份证110101199001011234' })], null)
    expect(payloadOf(out[0]).content).toBe('患者张三身份证1101**********1234')
  })

  it('不改写原事件：输入事件对象与其 payload 保持原样', () => {
    const input = makeEvent({ content: '患者张三身份证110101199001011234' })
    const snapshot = JSON.stringify(input)
    maskEvents([input], NAME_MAPPING)
    expect(JSON.stringify(input)).toBe(snapshot)
    expect(payloadOf(input).content).toBe('患者张三身份证110101199001011234')
  })

  it('非字符串字段与嵌套对象原样保留（只掩码顶层字符串字段）', () => {
    const payload = { content: '身份证110101199001011234', seq: 5, meta: { name: '张三' } }
    const out = maskEvents([makeEvent(payload)], NAME_MAPPING)
    expect(payloadOf(out[0]).seq).toBe(5)
    expect(payloadOf(out[0]).meta).toEqual({ name: '张三' }) // 嵌套不掩码（联调校正点）
  })

  it('maskEventText：姓名映射 + 正则兜底串联', () => {
    expect(maskEventText('张三的手机13800138000', NAME_MAPPING)).toBe('张*的手机138****8000')
    expect(maskEventText('无敏感内容', null)).toBe('无敏感内容')
  })
})
