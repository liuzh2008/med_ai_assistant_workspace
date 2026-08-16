/**
 * syncEngine 缓冲队列测试（P6-C8，US-N2-04 事件同步-缓冲）。
 *
 * 验收标准（缓冲触发条件）：
 *   - turn 结束事件 → 优先立即推送；
 *   - 缓冲满 200 事件 → 推送；
 *   - 5s 无新事件 → 兜底推送。
 *
 * 设计语义（对齐实现方案 §4.3 syncEngine 算法步骤 2-3）：
 *   - enqueue 不阻塞对话：触发推送为 fire-and-forget（T9 接真实推送）；
 *   - 定时器每次 enqueue 重置（idle 语义）；flush 后清空并复位；
 *   - 防重入：flush 进行中再次触发不重复取队列。
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createEventBuffer, TURN_END_TYPE } from './syncEngine'
import type { SyncEvent } from './syncEngine'

function makeEvent(seq: number, type = 'message'): SyncEvent {
  return { sessionId: 'sess-1', seq, type, payload: { content: `e${seq}` } }
}

describe('syncEngine 缓冲队列（US-N2-04 触发条件）', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('turn 结束事件 → 立即 flush（不等待定时器）', async () => {
    const onFlush = vi.fn()
    const buf = createEventBuffer({ onFlush, maxEvents: 200, idleIntervalMs: 5000 })
    buf.enqueue(makeEvent(1))
    expect(onFlush).not.toHaveBeenCalled() // 普通消息不立即推送

    buf.enqueue(makeEvent(2, TURN_END_TYPE))
    await vi.waitFor(() => expect(onFlush).toHaveBeenCalledTimes(1))
    expect(onFlush).toHaveBeenCalledWith([makeEvent(1), makeEvent(2, TURN_END_TYPE)])
    buf.dispose()
  })

  it('缓冲满 maxEvents（200 条）→ 自动 flush', async () => {
    const onFlush = vi.fn()
    const buf = createEventBuffer({ onFlush, maxEvents: 200, idleIntervalMs: 5000 })
    for (let i = 1; i <= 200; i++) buf.enqueue(makeEvent(i))
    await vi.waitFor(() => expect(onFlush).toHaveBeenCalledTimes(1))
    expect(onFlush.mock.calls[0][0]).toHaveLength(200)
    buf.dispose()
  })

  it('5s 无新事件 → 兜底 flush（idle 定时器）', async () => {
    const onFlush = vi.fn()
    const buf = createEventBuffer({ onFlush, maxEvents: 200, idleIntervalMs: 5000 })
    buf.enqueue(makeEvent(1))
    expect(onFlush).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(5000)
    expect(onFlush).toHaveBeenCalledTimes(1)
    expect(onFlush).toHaveBeenCalledWith([makeEvent(1)])
    buf.dispose()
  })

  it('flush 后队列清空：后续事件重新累积', async () => {
    const onFlush = vi.fn()
    const buf = createEventBuffer({ onFlush, maxEvents: 200, idleIntervalMs: 5000 })
    buf.enqueue(makeEvent(1))
    await vi.advanceTimersByTimeAsync(5000) // 第一次兜底
    buf.enqueue(makeEvent(2, TURN_END_TYPE))
    await vi.waitFor(() => expect(onFlush).toHaveBeenCalledTimes(2))
    expect(onFlush.mock.calls[1][0]).toEqual([makeEvent(2, TURN_END_TYPE)]) // 只含新事件
    buf.dispose()
  })

  it('enqueue 不阻塞：onFlush 为异步时 enqueue 立即返回', async () => {
    let resolveFlush: (() => void) | undefined
    const onFlush = vi.fn(() => new Promise<void>((r) => (resolveFlush = r)))
    const buf = createEventBuffer({ onFlush, maxEvents: 200, idleIntervalMs: 5000 })

    buf.enqueue(makeEvent(1, TURN_END_TYPE)) // 不应挂起
    await vi.waitFor(() => expect(onFlush).toHaveBeenCalled())
    resolveFlush?.()
    buf.dispose()
  })
})
