/**
 * serviceJwt 单元测试（N4 接线，2026-08-17）。
 *
 * 覆盖：启动即 exchange / 到期前提前刷新 / 失败保留旧 JWT 并退避重试 / dispose 停止。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createServiceJwtProvider } from './serviceJwt'

describe('createServiceJwtProvider 服务 JWT 自动换取', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // fake timers 接管默认 setTimeout/clearTimeout：推进虚拟时间会真实触发刷新回调
    vi.useFakeTimers()
    fetchMock = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function runTimers(ms: number): void {
    vi.advanceTimersByTime(ms)
  }

  /** 排空 refresh 的异步微任务链（fetch/json/schedule 多个 await）。 */
  async function flush(): Promise<void> {
    for (let i = 0; i < 20; i++) await Promise.resolve()
  }

  it('创建即 exchange：携带每机 token，getJwt 返回服务 JWT', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'svc-jwt-1', expiresAt: new Date(Date.now() + 3600_000).toISOString() }),
    })
    const provider = createServiceJwtProvider({
      exchangeUrl: 'http://127.0.0.1:8081/mcp/auth/exchange',
      token: 'medai-dev-token',
      fetchImpl: fetchMock,
    })
    await flush()

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8081/mcp/auth/exchange',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer medai-dev-token' }),
      }),
    )
    expect(provider.getJwt()).toBe('svc-jwt-1')
    provider.dispose()
  })

  it('到期前提前刷新：推进到刷新点后重新 exchange 并更新 JWT', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'svc-jwt-1', expiresAt: new Date(Date.now() + 3600_000).toISOString() }),
    })
    const provider = createServiceJwtProvider({
      exchangeUrl: 'http://127.0.0.1:8081/mcp/auth/exchange',
      token: 'medai-dev-token',
      ttlBufferMs: 60_000,
      fetchImpl: fetchMock,
    })
    await flush()
    expect(provider.getJwt()).toBe('svc-jwt-1')

    // 刷新点 = 3600s - 60s buffer = 3540s；推进 3600s 必触发
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'svc-jwt-2', expiresAt: new Date(Date.now() + 7200_000).toISOString() }),
    })
    runTimers(3_600_000)
    await flush()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(provider.getJwt()).toBe('svc-jwt-2')
    provider.dispose()
  })

  it('exchange 失败：保留旧 JWT，退避重试后恢复', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'svc-jwt-1', expiresAt: new Date(Date.now() + 3600_000).toISOString() }),
      })
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'svc-jwt-2', expiresAt: new Date(Date.now() + 3600_000).toISOString() }),
      })
    const provider = createServiceJwtProvider({
      exchangeUrl: 'http://127.0.0.1:8081/mcp/auth/exchange',
      token: 'medai-dev-token',
      fetchImpl: fetchMock,
    })
    await flush()
    expect(provider.getJwt()).toBe('svc-jwt-1')

    // 推进到刷新点 → 第一次刷新失败（保留 svc-jwt-1）
    runTimers(3_600_000)
    await flush()
    expect(provider.getJwt()).toBe('svc-jwt-1')

    // 退避 30s 后重试成功
    runTimers(31_000)
    await flush()
    expect(provider.getJwt()).toBe('svc-jwt-2')
    provider.dispose()
  })

  it('dispose 后不再刷新', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'svc-jwt-1', expiresAt: new Date(Date.now() + 3600_000).toISOString() }),
    })
    const provider = createServiceJwtProvider({
      exchangeUrl: 'http://127.0.0.1:8081/mcp/auth/exchange',
      token: 'medai-dev-token',
      fetchImpl: fetchMock,
    })
    await flush()
    const callsAfterInit = fetchMock.mock.calls.length

    provider.dispose()
    runTimers(10_000_000)
    await flush()

    expect(fetchMock.mock.calls.length).toBe(callsAfterInit)
  })
})
