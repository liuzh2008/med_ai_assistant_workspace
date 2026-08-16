/**
 * syncEngine（P6-C8 缓冲队列；P6-C9 推送/watermark/重试）。
 *
 * 事件缓冲：订阅 DSH `session/event` → enqueue 入队 → 按触发条件 flush：
 *   - turn 结束事件 → 优先立即推送（TURN_END_TYPE 约定，联调校正）；
 *   - 缓冲满 maxEvents（200）→ 推送；
 *   - idleIntervalMs（5s）无新事件 → 兜底推送（定时器每次 enqueue 重置）。
 *
 * **不阻塞对话**（降级铁律）：enqueue 触发 flush 为 fire-and-forget，
 * onFlush 的失败由调用方（T9 推送器）处理。防重入：flush 进行中再次
 * 触发不重复取队列。
 *
 * @module @medai/dsh-session-sync/syncEngine
 */

/** turn 结束事件类型约定（对齐 DSH 事件流，联调校正点）。 */
export const TURN_END_TYPE = 'turn-end'

export interface SyncEvent {
  sessionId: string
  seq: number
  type: string
  payload?: unknown
}

export interface EventBufferOptions {
  /** 缓冲超限触发推送（默认 200） */
  maxEvents?: number
  /** 无新事件兜底推送间隔（默认 5000ms） */
  idleIntervalMs?: number
  /** turn 结束判定（默认 type === 'turn-end'） */
  isTurnEnd?: (event: SyncEvent) => boolean
  onFlush: (events: SyncEvent[]) => Promise<void> | void
}

export interface EventBuffer {
  enqueue(event: SyncEvent): void
  /** 立即取空队列并推送（暴露给 T9 推送器与登出 flush 复用）。 */
  flushNow(): Promise<void>
  /** 队列中未推送事件数。 */
  size(): number
  /** 停止兜底定时器（登出清理/插件卸载时调用）。 */
  dispose(): void
}

export function createEventBuffer(opts: EventBufferOptions): EventBuffer {
  const maxEvents = opts.maxEvents ?? 200
  const idleIntervalMs = opts.idleIntervalMs ?? 5000
  const isTurnEnd = opts.isTurnEnd ?? ((e: SyncEvent) => e.type === TURN_END_TYPE)

  const queue: SyncEvent[] = []
  let idleTimer: ReturnType<typeof setTimeout> | undefined
  let flushing = false
  let disposed = false

  function clearIdleTimer(): void {
    if (idleTimer !== undefined) {
      clearTimeout(idleTimer)
      idleTimer = undefined
    }
  }

  async function flushNow(): Promise<void> {
    if (flushing || queue.length === 0) return
    flushing = true
    clearIdleTimer()
    const batch = queue.splice(0, queue.length)
    try {
      await opts.onFlush(batch)
    } finally {
      flushing = false
    }
  }

  return {
    enqueue(event: SyncEvent): void {
      if (disposed) return
      queue.push(event)
      if (isTurnEnd(event)) {
        void flushNow() // 优先立即推送；不阻塞对话
        return
      }
      if (queue.length >= maxEvents) {
        void flushNow()
        return
      }
      clearIdleTimer()
      idleTimer = setTimeout(() => {
        idleTimer = undefined
        void flushNow()
      }, idleIntervalMs)
    },
    flushNow,
    size() {
      return queue.length
    },
    dispose() {
      disposed = true
      clearIdleTimer()
    },
  }
}
