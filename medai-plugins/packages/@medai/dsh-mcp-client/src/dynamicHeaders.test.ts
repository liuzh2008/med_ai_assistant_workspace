import { describe, expect, it } from 'vitest'
import { buildDynamicHeaders } from './dynamicHeaders'

describe('buildDynamicHeaders（每请求动态 JWT 头）', () => {
  it('静态头保留；Authorization 为可枚举 getter 每请求求值', () => {
    let jwt: string | null = 'jwt-A'
    const headers = buildDynamicHeaders({
      staticHeaders: { 'X-MedAI-Machine-Token': 'dev-device', Accept: 'application/json' },
      getJwt: () => jwt,
    })

    // 可枚举展开（SDK normalizeHeaders 每请求 {…headers} 触发 getter）
    const first = { ...headers }
    jwt = 'jwt-B'
    const second = { ...headers }

    expect(headers['X-MedAI-Machine-Token']).toBe('dev-device')
    expect(first.Authorization).toBe('Bearer jwt-A')
    expect(second.Authorization).toBe('Bearer jwt-B')
    expect(Object.keys(headers)).toContain('Authorization')
  })

  it('JWT 为空回退静态 Authorization（旧每机 token 过渡）', () => {
    const headers = buildDynamicHeaders({
      staticHeaders: { Authorization: 'Bearer medai-dev-token' },
      getJwt: () => null,
    })
    expect({ ...headers }.Authorization).toBe('Bearer medai-dev-token')
  })

  it('无静态 Authorization 且 JWT 为空 → 空字符串（不带鉴权头）', () => {
    const headers = buildDynamicHeaders({ staticHeaders: {}, getJwt: () => null })
    expect({ ...headers }.Authorization).toBe('')
  })

  it('无 getJwt → 纯静态头（零回归：旧形态行为不变）', () => {
    const headers = buildDynamicHeaders({ staticHeaders: { Authorization: 'Bearer static' } })
    expect(headers.Authorization).toBe('Bearer static')
    expect(Object.keys(headers)).toEqual(['Authorization'])
  })
})
