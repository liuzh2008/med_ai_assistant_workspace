import { describe, it, expect } from 'vitest'

import {
  parseEnvelope,
  truncationText,
  classifyError,
  type McpResultEnvelope,
} from './envelope.js'

describe('parseEnvelope', () => {
  it('合法信封解析出字段', () => {
    const raw = {
      patientId: 'P000123',
      patientLabel: '心血管一病区 3床 张*',
      items: [{ a: 1 }, { a: 2 }],
      truncated: true,
      totalCount: 12,
      sourceRefs: ['LAB-001'],
    }
    const env = parseEnvelope(raw)
    expect(env).not.toBeNull()
    expect(env?.patientId).toBe('P000123')
    expect(env?.items?.length).toBe(2)
    expect(env?.totalCount).toBe(12)
  })

  it('非对象输入解析为null（容错）', () => {
    expect(parseEnvelope(null)).toBeNull()
    expect(parseEnvelope('not-an-object')).toBeNull()
    expect(parseEnvelope(undefined)).toBeNull()
  })

  it('items 非数组视为非法信封', () => {
    expect(parseEnvelope({ items: 'oops' })).toBeNull()
  })
})

describe('truncationText', () => {
  it('截断且有totalCount显示共M条', () => {
    const env: McpResultEnvelope = { items: Array.from({ length: 50 }), truncated: true, totalCount: 120 }
    expect(truncationText(env)).toBe('已显示 50 条，共 120 条')
  })

  it('旧信封无totalCount时降级为已截断', () => {
    const env: McpResultEnvelope = { items: Array.from({ length: 50 }), truncated: true }
    expect(truncationText(env)).toBe('已截断')
  })

  it('未截断返回null（不显示提示）', () => {
    const env: McpResultEnvelope = { items: [], truncated: false, totalCount: 3 }
    expect(truncationText(env)).toBeNull()
  })

  it('截断但items为空时按0条显示', () => {
    const env: McpResultEnvelope = { items: [], truncated: true, totalCount: 5 }
    expect(truncationText(env)).toBe('已显示 0 条，共 5 条')
  })
})

describe('classifyError', () => {
  it('401映射为本机未授权', () => {
    expect(classifyError('401', '')).toBe('unauthorized')
  })

  it('403或科室拒绝映射为越权', () => {
    expect(classifyError('403', '')).toBe('forbidden')
    expect(classifyError('', '该患者不在您的科室范围内')).toBe('forbidden')
  })

  it('超时映射为timeout', () => {
    expect(classifyError('', '查询超时')).toBe('timeout')
    expect(classifyError('', 'timed out')).toBe('timeout')
  })

  it('其余错误降级为tool-error', () => {
    expect(classifyError('500', '')).toBe('tool-error')
    expect(classifyError('', 'something wrong')).toBe('tool-error')
    expect(classifyError(undefined, '')).toBe('tool-error')
  })
})
