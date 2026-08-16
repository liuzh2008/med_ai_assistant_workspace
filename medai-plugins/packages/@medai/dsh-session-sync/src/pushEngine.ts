/**
 * pushEngine（P6-C9，US-N2-04 同步-推送与 watermark）。
 *
 * 推送：`POST {endpoint}` 载荷 {doctorId, patientId, sessionId, version, baseSeq,
 * events[{seq,type,data}]}（本地 SyncEvent.payload → 协议 data 字段，联调校正点）。
 *
 * 成功（{ok:true}）→ watermark 推进到本批最后事件 seq 并持久化
 * （`watermark.json` 原子写，与 map.json 同构）；失败 → 按 retryBackoffMs
 * （1s/2s/4s/8s 封顶 30s）退避重试，**重试复用同一载荷**（幂等键一致，
 * 服务端按 version/baseSeq/seq 幂等兜底，§5.6）；冲突响应（conflict:true）
 * → 停止重试（快照恢复流程处理）；HTTP 超时经 AbortController 中止。
 *
 * **不阻塞对话**（降级铁律）：push() 在首次尝试完成后即返回，重试在后台
 * 进行；watermark 持久化失败吞掉（内存仍推进，下次变更再写）。
 *
 * @module @medai/dsh-session-sync/pushEngine
 */

import type { SyncEvent } from './syncEngine'
import type { FsPromisesLike } from './fsTypes'
import { promises as fs } from 'node:fs'

/** watermark 存储（{sessionId: lastSeq} 持久化）。 */
export interface WatermarkStore {
  load(): Promise<Record<string, number>>
  save(watermarks: Record<string, number>): Promise<void>
}

/** 推送上下文（医疗语义由 N1 组装，N2 零判断）。 */
export interface ArchivePushContext {
  doctorId: string
  patientId: string
  /** 会话快照版本（服务端幂等/冲突判定依据）。 */
  version: number
}

export interface PushResult {
  ok: boolean
  conflict?: boolean
  latestVersion?: number
}

export interface PushEngineOptions {
  /** POST /api/mcp/archive/events 端点。 */
  endpoint: string
  /** JWT 提供者（null 时请求不带 Authorization）。 */
  getToken: () => string | null
  watermarkStore: WatermarkStore
  /** 测试注入；默认全局 fetch。 */
  fetchImpl?: typeof fetch
  /** 重试退避序列（ms），耗尽后重复末位（封顶 30s）。默认 [1000,2000,4000,8000,30000]。 */
  retryBackoffMs?: number[]
  /** 单次请求超时（AbortController），默认 10000ms。 */
  requestTimeoutMs?: number
  /** watermark 推进回调（P6-C10 flush 编排"等 N3 确认"复用）。 */
  onConfirmed?: (sessionId: string, lastSeq: number) => void
}

export interface PushEngine {
  /**
   * 推送一批事件；首次尝试完成后返回（无论成败），失败重试在后台进行。
   * 冲突时返回 conflict:true 并停止重试。
   */
  push(events: readonly SyncEvent[], ctx: ArchivePushContext): Promise<PushResult>
  /** 当前已确认推进到的 watermark（未推进过返回 undefined）。 */
  getWatermark(sessionId: string): number | undefined
  /** 停止后台重试（登出清理/插件卸载时调用）。 */
  dispose(): void
}

interface ArchivePushPayload {
  doctorId: string
  patientId: string
  sessionId: string
  version: number
  baseSeq: number
  events: Array<{ seq: number; type: string; data: unknown }>
}

interface PushResponseBody {
  ok?: boolean
  conflict?: boolean
  latestVersion?: number
}

export function createPushEngine(opts: PushEngineOptions): PushEngine {
  const fetchImpl = opts.fetchImpl ?? fetch
  const backoff = opts.retryBackoffMs ?? [1000, 2000, 4000, 8000, 30000]
  const requestTimeoutMs = opts.requestTimeoutMs ?? 10000

  const watermarks = new Map<string, number>()
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  let disposed = false

  async function doFetch(payload: ArchivePushPayload): Promise<Response> {
    const token = opts.getToken()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), requestTimeoutMs)
    try {
      return await fetchImpl(opts.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timer)
    }
  }

  function scheduleRetry(payload: ArchivePushPayload, lastSeq: number, attempt: number): void {
    if (disposed) return
    const delay = backoff[Math.min(attempt, backoff.length - 1)]
    retryTimer = setTimeout(() => {
      retryTimer = undefined
      void attemptPush(payload, lastSeq, attempt + 1)
    }, delay)
  }

  async function attemptPush(payload: ArchivePushPayload, lastSeq: number, attempt: number): Promise<PushResult> {
    let res: Response
    try {
      res = await doFetch(payload)
    } catch {
      // 网络错误/超时 → 退避重试（fire-and-forget）
      scheduleRetry(payload, lastSeq, attempt)
      return { ok: false }
    }

    let body: PushResponseBody | null = null
    try {
      body = (await res.json()) as PushResponseBody
    } catch {
      body = null
    }

    if (res.ok && body?.ok) {
      const prev = watermarks.get(payload.sessionId) ?? 0
      watermarks.set(payload.sessionId, Math.max(prev, lastSeq))
      try {
        await opts.watermarkStore.save(Object.fromEntries(watermarks))
      } catch {
        // 持久化失败不阻塞：内存已推进，下次变更再写
      }
      opts.onConfirmed?.(payload.sessionId, lastSeq)
      return { ok: true }
    }

    if (body?.conflict) {
      // 服务端版本更新 → 停止重试（快照恢复流程处理，T16 语义）
      return { ok: false, conflict: true, latestVersion: body.latestVersion }
    }

    scheduleRetry(payload, lastSeq, attempt)
    return { ok: false }
  }

  return {
    push(events: readonly SyncEvent[], ctx: ArchivePushContext): Promise<PushResult> {
      const first = events[0]
      const last = events[events.length - 1]
      if (!first || !last) return Promise.resolve({ ok: false })
      // 载荷一次构建，重试复用 → 幂等键一致
      const payload: ArchivePushPayload = {
        doctorId: ctx.doctorId,
        patientId: ctx.patientId,
        sessionId: first.sessionId,
        version: ctx.version,
        baseSeq: first.seq,
        events: events.map((e) => ({ seq: e.seq, type: e.type, data: e.payload })),
      }
      return attemptPush(payload, last.seq, 0)
    },

    getWatermark(sessionId: string): number | undefined {
      return watermarks.get(sessionId)
    },

    dispose(): void {
      disposed = true
      if (retryTimer !== undefined) {
        clearTimeout(retryTimer)
        retryTimer = undefined
      }
    },
  }
}

/** watermark.json 文件存储（原子写 = 同目录 .tmp + rename，与 map.json 同构）。 */
export function createFileWatermarkStore(
  filePath: string,
  fsImpl: FsPromisesLike = fs,
): WatermarkStore {
  return {
    async load(): Promise<Record<string, number>> {
      try {
        const raw = await fsImpl.readFile(filePath, 'utf8')
        const parsed = JSON.parse(raw) as Record<string, number>
        return typeof parsed === 'object' && parsed !== null ? parsed : {}
      } catch {
        // 文件不存在/损坏 → 空 watermark（不抛）
        return {}
      }
    },
    async save(watermarks: Record<string, number>): Promise<void> {
      const tmp = `${filePath}.tmp`
      await fsImpl.writeFile(tmp, JSON.stringify(watermarks, null, 2), 'utf8')
      await fsImpl.rename(tmp, filePath)
    },
  }
}
