import { describe, it, expect } from 'vitest'

import {
  parseToolResult, blockErrorView, isSettled, resultTextOf, argsSummary, errorTextOf,
} from './result.js'

const ENVELOPE = { patientId: 'P000123', items: [{ a: 1 }] }

describe('isSettled / resultTextOf（真实 ToolResultNode 契约）', () => {
  it('content 含文本 → settled，取 text 拼接', () => {
    const block = { content: [{ type: 'text', text: JSON.stringify(ENVELOPE) }] }
    expect(isSettled(block)).toBe(true)
    expect(resultTextOf(block)).toBe(JSON.stringify(ENVELOPE))
  })

  it('运行中（无 content）→ 未结算，文本为 null', () => {
    const running = { name: 'mcp__medai__medai_lab_results', argsRaw: '{"patientId":"P1"}' }
    expect(isSettled(running)).toBe(false)
    expect(resultTextOf(running)).toBeNull()
  })

  it('content 为空数组 / null → 未结算', () => {
    expect(isSettled({ content: [] })).toBe(false)
    expect(isSettled({ content: [{ type: 'text', text: '' }] })).toBe(false)
    expect(isSettled(null)).toBe(false)
  })
})

describe('parseToolResult（真实块结构：信封在 content[0].text）', () => {
  it('content text 为信封 JSON → 解析成功', () => {
    const block = { content: [{ type: 'text', text: JSON.stringify(ENVELOPE) }] }
    const env = parseToolResult(block)
    expect(env?.patientId).toBe('P000123')
    expect(env?.items?.length).toBe(1)
  })

  it('content text 为 MCP 转义字符串（内含 \"）→ 解析成功', () => {
    const escaped = '{\\"patientId\\":\\"P000123\\",\\"items\\":[]}'
    const block = { content: [{ type: 'text', text: escaped }] }
    expect(parseToolResult(block)?.patientId).toBe('P000123')
  })

  it('运行中（无 content）→ null（折叠行用 argsSummary 摘要）', () => {
    expect(parseToolResult({ name: 'x', argsRaw: '{}' })).toBeNull()
    expect(parseToolResult(null)).toBeNull()
    expect(parseToolResult(undefined)).toBeNull()
  })

  it('非法 JSON / 非法结构 → null（不崩溃）', () => {
    expect(parseToolResult({ content: [{ type: 'text', text: 'not-json' }] })).toBeNull()
    expect(parseToolResult({ content: [{ type: 'text', text: '{"items": 1}' }] })).toBeNull()
    expect(parseToolResult({ content: [{ type: 'image', text: '' }] })).toBeNull()
  })
})

describe('argsSummary（运行中折叠摘要）', () => {
  it('JSON 参数 → 首行且截断 80 字符', () => {
    expect(argsSummary({ argsRaw: '{"patientId":"P1"}' })).toBe('{"patientId":"P1"}')
    expect(argsSummary({ argsRaw: 'x'.repeat(200) })).toHaveLength(81)
  })

  it('空/缺失 → undefined', () => {
    expect(argsSummary({})).toBeUndefined()
    expect(argsSummary(null)).toBeUndefined()
  })
})

describe('errorTextOf', () => {
  it('error 字符串 / 对象 message → 文本', () => {
    expect(errorTextOf({ isError: true, error: '401 Unauthorized' })).toBe('401 Unauthorized')
    expect(errorTextOf({ isError: true, error: { message: '设备未授权', code: 'X' } })).toBe('设备未授权')
  })

  it('非错误 / 空错误 → null', () => {
    expect(errorTextOf({ isError: false })).toBeNull()
    expect(errorTextOf({ isError: true })).toBeNull()
  })
})

describe('blockErrorView', () => {
  it('isError 且错误含401 → unauthorized', () => {
    expect(blockErrorView({ isError: true, error: '401 Unauthorized' })).toBe('unauthorized')
  })

  it('isError 且错误含科室拒绝 → forbidden', () => {
    expect(blockErrorView({ isError: true, error: '该患者不在您的科室范围内' })).toBe('forbidden')
  })

  it('非错误块返回 null', () => {
    expect(blockErrorView({ isError: false })).toBeNull()
    expect(blockErrorView({})).toBeNull()
  })

  it('通用错误降级 tool-error', () => {
    expect(blockErrorView({ isError: true, error: 'boom' })).toBe('tool-error')
  })
})
