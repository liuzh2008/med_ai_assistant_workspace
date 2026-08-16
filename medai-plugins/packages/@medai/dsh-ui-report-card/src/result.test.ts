import { describe, it, expect } from 'vitest'

import { parseToolResult, blockErrorView } from './result.js'

describe('parseToolResult', () => {
  it('result 为信封对象时解析成功', () => {
    const block = { result: { patientId: 'P000123', items: [{ a: 1 }] } }
    const env = parseToolResult(block)
    expect(env?.patientId).toBe('P000123')
    expect(env?.items?.length).toBe(1)
  })

  it('result 为 JSON 字符串（MCP 信封转义）时解析成功', () => {
    const block = { result: '{"patientId":"P000123","items":[]}' }
    expect(parseToolResult(block)?.patientId).toBe('P000123')
  })

  it('非法 JSON / 非法结构返回 null（不崩溃）', () => {
    expect(parseToolResult({ result: 'not-json' })).toBeNull()
    expect(parseToolResult({ result: '{"items": 1}' })).toBeNull()
    expect(parseToolResult(null)).toBeNull()
    expect(parseToolResult(undefined)).toBeNull()
    expect(parseToolResult({})).toBeNull()
  })
})

describe('blockErrorView', () => {
  it('isError 且错误含401 → unauthorized', () => {
    const block = { isError: true, error: '401 Unauthorized' }
    expect(blockErrorView(block)).toBe('unauthorized')
  })

  it('isError 且错误含科室拒绝 → forbidden', () => {
    const block = { isError: true, error: '该患者不在您的科室范围内' }
    expect(blockErrorView(block)).toBe('forbidden')
  })

  it('非错误块返回 null', () => {
    expect(blockErrorView({ isError: false })).toBeNull()
    expect(blockErrorView({})).toBeNull()
  })

  it('通用错误降级 tool-error', () => {
    expect(blockErrorView({ isError: true, error: 'boom' })).toBe('tool-error')
  })
})
