/**
 * flushCoordinator 测试（P6-C10，US-N2-05 三层清理-登出 flush 编排）。
 *
 * 验收标准（对齐 US-N2-05 + 实现方案 §4.3 cleaner 登出分支）：
 *   - 在途推送全部确认（≤30s）→ 删全部本地会话 → 删映射/watermark 文件
 *     → 回执 ok:true；
 *   - 30s 超时（N3 不可达）→ 丢弃缓冲 + 上报告警 + **本地文件仍删除**
 *     （防跨使用者数据残留）+ 回执 ok:false；
 *   - 删除失败 → 告警 + 回执 ok:false，不进入后续步骤（不删不完整状态）。
 *
 * 设计语义：超时计时职责在 waitForDrain 实现方（syncEngine 侧），编排器
 * 只负责传递 timeoutMs（默认 30000）并按结果编排；各步骤依赖注入可测。
 */

import { describe, expect, it, vi } from 'vitest'
import { createFlushCoordinator } from './flushCoordinator'
import type { FlushCoordinatorDeps, FlushOutcome } from './flushCoordinator'

function makeDeps(overrides?: Partial<FlushCoordinatorDeps>) {
  const deps: FlushCoordinatorDeps = {
    waitForDrain: vi.fn(async () => true),
    deleteAllSessions: vi.fn(async () => undefined),
    deleteLocalStateFiles: vi.fn(async () => undefined),
    discardBuffer: vi.fn(),
    onAlert: vi.fn(),
    ...overrides,
  }
  return deps
}

function orderOf(pairs: Array<[string, ReturnType<typeof vi.fn>]>): string[] {
  return pairs
    .map(([name, f]) => ({ name, order: f.mock.invocationCallOrder[0] }))
    .sort((a, b) => a.order - b.order)
    .map((x) => x.name)
}

describe('flushCoordinator 登出 flush 编排（US-N2-05）', () => {
  it('排空成功 → 按序：确认 → 删会话 → 删本地文件 → 回执 ok:true（无告警）', async () => {
    const drain = vi.fn(async () => true)
    const delSessions = vi.fn(async () => undefined)
    const delFiles = vi.fn(async () => undefined)
    const alert = vi.fn()
    const coord = createFlushCoordinator({
      waitForDrain: drain,
      deleteAllSessions: delSessions,
      deleteLocalStateFiles: delFiles,
      discardBuffer: vi.fn(),
      onAlert: alert,
    })

    const outcome = await coord.runLogoutFlush()

    expect(outcome).toEqual({ ok: true })
    expect(alert).not.toHaveBeenCalled()
    expect(orderOf([
      ['waitForDrain', drain],
      ['deleteAllSessions', delSessions],
      ['deleteLocalStateFiles', delFiles],
    ])).toEqual(['waitForDrain', 'deleteAllSessions', 'deleteLocalStateFiles'])
  })

  it('超时（waitForDrain=false）→ 丢弃缓冲 + 告警 + 本地文件仍删除 + 回执 ok:false', async () => {
    const drain = vi.fn(async () => false)
    const delSessions = vi.fn(async () => undefined)
    const delFiles = vi.fn(async () => undefined)
    const discard = vi.fn()
    const alert = vi.fn()
    const coord = createFlushCoordinator({
      waitForDrain: drain,
      deleteAllSessions: delSessions,
      deleteLocalStateFiles: delFiles,
      discardBuffer: discard,
      onAlert: alert,
    })

    const outcome = await coord.runLogoutFlush()

    expect(outcome).toEqual({ ok: false, timedOut: true })
    expect(discard).toHaveBeenCalledTimes(1)
    expect(alert).toHaveBeenCalledTimes(1)
    expect(alert.mock.calls[0][0]).toContain('超时')
    // 防跨使用者数据残留：超时后本地会话/文件仍删除
    expect(delSessions).toHaveBeenCalledTimes(1)
    expect(delFiles).toHaveBeenCalledTimes(1)
  })

  it('删会话失败 → 告警 + 回执 ok:false，不继续删文件（不删不完整状态）', async () => {
    const delSessions = vi.fn(async () => {
      throw new Error('session delete failed')
    })
    const delFiles = vi.fn(async () => undefined)
    const alert = vi.fn()
    const coord = createFlushCoordinator({
      waitForDrain: vi.fn(async () => true),
      deleteAllSessions: delSessions,
      deleteLocalStateFiles: delFiles,
      discardBuffer: vi.fn(),
      onAlert: alert,
    })

    const outcome = await coord.runLogoutFlush()

    expect(outcome).toEqual({ ok: false })
    expect(delFiles).not.toHaveBeenCalled()
    expect(alert).toHaveBeenCalledTimes(1)
  })

  it('删本地文件失败 → 告警 + 回执 ok:false（会话已删，文件残留待兜底清理）', async () => {
    const delFiles = vi.fn(async () => {
      throw new Error('file delete failed')
    })
    const alert = vi.fn()
    const coord = createFlushCoordinator({
      waitForDrain: vi.fn(async () => true),
      deleteAllSessions: vi.fn(async () => undefined),
      deleteLocalStateFiles: delFiles,
      discardBuffer: vi.fn(),
      onAlert: alert,
    })

    const outcome = await coord.runLogoutFlush()

    expect(outcome).toEqual({ ok: false })
    expect(alert).toHaveBeenCalledTimes(1)
  })

  it('超时时间可配置：waitForDrain 收到 timeoutMs（默认 30000）', async () => {
    const drain = vi.fn(async () => true)
    const coord = createFlushCoordinator(makeDeps({ waitForDrain: drain }))
    await coord.runLogoutFlush()
    expect(drain).toHaveBeenCalledWith(30000)

    const drain2 = vi.fn(async () => true)
    const coord2 = createFlushCoordinator(makeDeps({ waitForDrain: drain2, timeoutMs: 5000 }))
    await coord2.runLogoutFlush()
    expect(drain2).toHaveBeenCalledWith(5000)
  })
})
