/**
 * pushEngine 测试（P6-C9，US-N2-04 同步-推送与 watermark）。
 *
 * 验收标准（对齐实现方案 §4.3 步骤 5-7 + §5.4 API 契约）：
 *   - `POST {endpoint}` 载荷 {doctorId, patientId, sessionId, version, baseSeq, events[]}，
 *     events 元素为 {seq, type, data}（本地 SyncEvent.payload → 协议 data 字段）；
 *   - 推送成功（{ok:true}）→ watermark 推进到最后事件 seq 并持久化；
 *   - 推送失败 → 按 retryBackoffMs（1s/2s/4s/8s/30s 封顶）退避重试，
 *     重试复用同一载荷（幂等键一致，服务端幂等语义兜底）；
 *   - 冲突响应（{ok:false, conflict:true}）→ 停止重试不轰炸；
 *   - HTTP 超时（AbortController）→ 中止并进入重试；
 *   - watermark 持久化失败不阻塞（降级铁律）。
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createPushEngine, createFileWatermarkStore } from './pushEngine'
import type { PushEngineOptions, WatermarkStore } from './pushEngine'
import type { SyncEvent } from './syncEngine'
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

function makeEvent(seq: number, type = 'message', payload?: unknown): SyncEvent {
  return { sessionId: 's-1', seq, type, payload: payload ?? { content: `e${seq}` } }
}

function makeStore(): WatermarkStore & { saved: Array<Record<string, number>> } {
  const saved: Array<Record<string, number>> = []
  return {
    saved,
    async load() {
      return {}
    },
    async save(w: Record<string, number>) {
      saved.push({ ...w })
    },
  }
}

function okResponse(): Response {
  return new Response(JSON.stringify({ ok: true, conflict: false }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** fetch mock 显式签名（vi.fn 无参推断为空元组，tsc 报 TS2493/TS2339）。 */
type FetchFn = (url: string | URL | Request, init?: RequestInit) => Promise<Response>

function makeEngine(
  fetchImpl: typeof fetch,
  opts?: Partial<PushEngineOptions>,
): { engine: ReturnType<typeof createPushEngine>; store: ReturnType<typeof makeStore> } {
  const store = makeStore()
  const engine = createPushEngine({
    endpoint: 'http://archive.test/api/mcp/archive/events',
    getToken: () => 'jwt-token',
    watermarkStore: store,
    fetchImpl,
    retryBackoffMs: [1000, 2000, 4000, 8000, 30000],
    requestTimeoutMs: 5000,
    ...opts,
  })
  return { engine, store }
}

describe('pushEngine 推送 + watermark + 退避（US-N2-04）', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('推送载荷断言：POST body 含 doctorId/patientId/sessionId/version/baseSeq，events 转换 seq/type/data', async () => {
    const fetchImpl = vi.fn<FetchFn>(async () => okResponse())
    const { engine } = makeEngine(fetchImpl as unknown as typeof fetch)

    const result = await engine.push(
      [makeEvent(101, 'user/message', { content: '你好' }), makeEvent(102, 'tool/result', { rows: 1 })],
      { doctorId: 'D001', patientId: 'P000123', version: 3 },
    )

    expect(result).toEqual({ ok: true })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('http://archive.test/api/mcp/archive/events')
    expect(init?.method).toBe('POST')
    expect(init?.headers).toMatchObject({
      'Content-Type': 'application/json',
      Authorization: 'Bearer jwt-token',
    })
    expect(JSON.parse(String(init?.body))).toEqual({
      doctorId: 'D001',
      patientId: 'P000123',
      sessionId: 's-1',
      version: 3,
      baseSeq: 101,
      events: [
        { seq: 101, type: 'user/message', data: { content: '你好' } },
        { seq: 102, type: 'tool/result', data: { rows: 1 } },
      ],
    })
  })

  it('推送成功 → watermark 推进到最后事件 seq 并持久化', async () => {
    const fetchImpl = vi.fn<FetchFn>(async () => okResponse())
    const { engine, store } = makeEngine(fetchImpl as unknown as typeof fetch)

    await engine.push([makeEvent(101), makeEvent(102)], { doctorId: 'D001', patientId: 'P000123', version: 3 })

    expect(store.saved).toEqual([{ 's-1': 102 }])
    expect(engine.getWatermark('s-1')).toBe(102)
  })

  it('推送失败 → 按 1s/2s/4s/8s 退避重试，且重试复用同一载荷（幂等键一致）', async () => {
    const fetchImpl = vi.fn<FetchFn>(async () => {
      throw new Error('network down')
    })
    fetchImpl
      .mockImplementationOnce(() => Promise.reject(new Error('down')))
      .mockImplementationOnce(() => Promise.reject(new Error('down')))
      .mockImplementation(() => Promise.resolve(okResponse()))
    const { engine, store } = makeEngine(fetchImpl as unknown as typeof fetch)

    const p = engine.push([makeEvent(101)], { doctorId: 'D001', patientId: 'P000123', version: 3 })
    await p // 首次尝试失败后立即返回（后台重试，不阻塞）
    expect(fetchImpl).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1000) // 第 2 次（失败）
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2))
    await vi.advanceTimersByTimeAsync(2000) // 第 3 次（成功）
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(3))

    const bodies = fetchImpl.mock.calls.map((c) => String(c[1]?.body))
    expect(bodies[0]).toBe(bodies[1]) // 幂等键一致：重试不改载荷
    expect(bodies[1]).toBe(bodies[2])
    expect(store.saved).toEqual([{ 's-1': 101 }]) // 重试成功后仍推进 watermark
    engine.dispose()
  })

  it('退避序列封顶 30s：耗尽后持续 30s 间隔重试', async () => {
    const times: number[] = []
    const fetchImpl = vi.fn<FetchFn>(async () => {
      times.push(Date.now())
      throw new Error('down')
    })
    const { engine } = makeEngine(fetchImpl as unknown as typeof fetch)

    const p = engine.push([makeEvent(101)], { doctorId: 'D001', patientId: 'P000123', version: 1 })
    await p
    expect(fetchImpl).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(15000) // 1+2+4+8 → 第 5 次（序列耗尽）
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(5))
    expect(times.slice(1).map((t, i) => t - times[i])).toEqual([1000, 2000, 4000, 8000])

    await vi.advanceTimersByTimeAsync(30000) // 第 6 次（30s 封顶）
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(6))
    expect(times[5] - times[4]).toBe(30000) // 序列耗尽后首次重试间隔 = 30s

    await vi.advanceTimersByTimeAsync(30000) // 第 7 次（持续封顶）
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(7))
    expect(times[6] - times[5]).toBe(30000) // 非继续翻倍，恒 30s
    engine.dispose()
  })

  it('冲突响应（ok:false, conflict:true）→ 停止重试，watermark 不推进', async () => {
    const fetchImpl = vi.fn<FetchFn>(async () =>
      new Response(JSON.stringify({ ok: false, conflict: true, latestVersion: 5 }), { status: 200 }),
    )
    const { engine, store } = makeEngine(fetchImpl as unknown as typeof fetch)

    const result = await engine.push([makeEvent(101)], { doctorId: 'D001', patientId: 'P000123', version: 3 })

    expect(result).toEqual({ ok: false, conflict: true, latestVersion: 5 })
    await vi.advanceTimersByTimeAsync(60000)
    expect(fetchImpl).toHaveBeenCalledTimes(1) // 冲突不轰炸
    expect(store.saved).toEqual([])
    engine.dispose()
  })

  it('watermark 持久化失败不阻塞：save 抛错 → push 正常返回，内存 watermark 仍推进', async () => {
    const fetchImpl = vi.fn(async () => okResponse())
    const { engine } = makeEngine(fetchImpl as unknown as typeof fetch, {
      watermarkStore: {
        async load() {
          return {}
        },
        async save() {
          throw new Error('disk full')
        },
      },
    })

    await expect(
      engine.push([makeEvent(101)], { doctorId: 'D001', patientId: 'P000123', version: 1 }),
    ).resolves.toEqual({ ok: true })
    expect(engine.getWatermark('s-1')).toBe(101)
    engine.dispose()
  })

  it('HTTP 超时（requestTimeoutMs）→ AbortController 中止请求并进入重试', async () => {
    const fetchImpl = vi.fn<FetchFn>(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
        }),
    )
    const { engine } = makeEngine(fetchImpl as unknown as typeof fetch, { requestTimeoutMs: 5000 })

    const p = engine.push([makeEvent(101)], { doctorId: 'D001', patientId: 'P000123', version: 1 })
    await vi.advanceTimersByTimeAsync(5000) // 超时 → abort
    await p
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(fetchImpl.mock.calls[0][1]?.signal).toBeDefined()

    await vi.advanceTimersByTimeAsync(1000) // 进入退避重试
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2))
    engine.dispose()
  })

  it('非 2xx 响应视为失败 → 退避重试；成功后再推进 watermark', async () => {
    const fetchImpl = vi.fn<FetchFn>(async () => new Response('bad gateway', { status: 502 }))
    fetchImpl.mockImplementationOnce(() => Promise.resolve(new Response('bad gateway', { status: 502 })))
    fetchImpl.mockImplementation(() => Promise.resolve(okResponse()))
    const { engine, store } = makeEngine(fetchImpl as unknown as typeof fetch)

    const p = engine.push([makeEvent(101)], { doctorId: 'D001', patientId: 'P000123', version: 1 })
    await p
    await vi.advanceTimersByTimeAsync(1000)
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2))
    await vi.waitFor(() => expect(store.saved).toEqual([{ 's-1': 101 }]))
    engine.dispose()
  })

  it('watermark 文件 store：原子写（临时文件 + rename），save 后无 .tmp 残留', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'watermark-'))
    const file = join(dir, 'watermark.json')
    const store = createFileWatermarkStore(file)

    expect(await store.load()).toEqual({}) // 文件不存在 → 空 watermark

    await store.save({ 's-1': 102 })
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ 's-1': 102 })
    expect(readdirSync(dir).filter((n) => n.includes('.tmp'))).toEqual([]) // 原子写无残留
    expect(existsSync(file)).toBe(true)

    expect(await store.load()).toEqual({ 's-1': 102 }) // 重新 load 恢复
  })

  it('watermark 文件 store：损坏 JSON → 空 watermark 不抛', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'watermark-'))
    const file = join(dir, 'watermark.json')
    writeFileSync(file, '{broken', 'utf8')

    const store = createFileWatermarkStore(file)
    expect(await store.load()).toEqual({})
  })
})
