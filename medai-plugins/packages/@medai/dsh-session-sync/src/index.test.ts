import { describe, expect, it, vi } from 'vitest'
import { apply, getHostPatientContext, setHostPatientContext, toSyncEvent, type HostContext } from './index'
import type { SyncEvent } from './syncEngine'

describe('toSyncEvent（DSH 会话事件 → SyncEvent）', () => {
  it('seq/type 透传，payload 取事件 data', () => {
    expect(toSyncEvent('s-1', { seq: 7, type: 'user/message', time: 1723881600000, data: { content: 'x' } }))
      .toEqual({ sessionId: 's-1', seq: 7, type: 'user/message', payload: { content: 'x' } })
  })

  it('data 缺失降级为空对象', () => {
    expect(toSyncEvent('s-1', { seq: 1, type: 'turn/end', time: 1 }))
      .toEqual({ sessionId: 's-1', seq: 1, type: 'turn/end', payload: {} })
  })
})

describe('setHostPatientContext（pre-step 患者状态通道）', () => {
  it('设置与读取当前患者；未设置为 null（反问降级）', () => {
    setHostPatientContext(null)
    expect(getHostPatientContext()).toBeNull()
    setHostPatientContext({ patientId: 'P1', patientLabel: '心血管一病区 3床 张*' })
    expect(getHostPatientContext()).toEqual({ patientId: 'P1', patientLabel: '心血管一病区 3床 张*' })
    setHostPatientContext(null)
  })
})

describe('apply（host 装配：session/event → 缓冲 → 掩码 → 推送）', () => {
  function fakeHost(on: ReturnType<typeof vi.fn>): HostContext {
    return { on: on ?? vi.fn() }
  }

  it('订阅 session/event 且 turn-end 事件触发 onFlush（掩码后推送，明文 PII 不达端点）', async () => {
    const on = vi.fn()
    const ctx = fakeHost(on)
    const pushes: Array<{ body: string; headers: Record<string, string> }> = []
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      pushes.push({ body: String(init?.body), headers: (init?.headers ?? {}) as Record<string, string> })
      return new Response(JSON.stringify({ ok: true, conflict: false, latestVersion: 1 }), { status: 200 })
    }) as unknown as typeof fetch

    apply(ctx, {
      endpoint: 'http://test/api/mcp/archive/events',
      getToken: () => 'good-jwt',
      getContext: () => ({ doctorId: 'D001', patientId: 'P1', version: 1 }),
      fetchImpl,
      idleIntervalMs: 60000,
    })

    // 注册的监听器：第一个是 session/event，第二个是 agent/pre-step
    expect(on).toHaveBeenCalled()
    const eventListener = on.mock.calls.find(([name]) => name === 'session/event')
    expect(eventListener).toBeTruthy()

    const listener = eventListener![1] as (session: unknown, event: unknown) => void
    // turn-end 触发立即 flush
    listener({ id: 's-1' }, { seq: 1, type: 'user/message', time: 1, data: { content: '身份证110101199001011234' } })
    listener({ id: 's-1' }, { seq: 2, type: 'turn-end', time: 2, data: { content: '结束' } })

    await vi.waitFor(() => {
      expect(pushes.length).toBeGreaterThan(0)
    })

    const body = JSON.parse(pushes[0].body) as {
      doctorId: string
      events: Array<{ seq: number; type: string; data: unknown }>
    }
    expect(body.doctorId).toBe('D001')
    expect(body.events).toHaveLength(2)
    // 掩码生效：身份证不达端点
    expect(JSON.stringify(body)).not.toContain('110101199001011234')
    expect(pushes[0].headers.Authorization).toBe('Bearer good-jwt')
  })

  it('未选定患者（getContext null）→ 缓冲保留不推送、不丢数据', async () => {
    const on = vi.fn()
    const ctx = fakeHost(on)
    const push = vi.fn()
    apply(ctx, { fetchImpl: push as unknown as typeof fetch })

    const listener = on.mock.calls.find(([name]) => name === 'session/event')![1] as (s: unknown, e: unknown) => void
    listener({ id: 's-1' }, { seq: 1, type: 'turn-end', time: 1, data: {} })

    // 无 getContext → onFlush 提前返回，不调用 fetch
    await new Promise((r) => setTimeout(r, 50))
    expect(push).not.toHaveBeenCalled()
  })
})
