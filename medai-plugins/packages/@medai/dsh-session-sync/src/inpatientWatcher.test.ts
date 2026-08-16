/**
 * inpatientWatcher 测试（P6-C11，US-N2-05 在院清单定时对比）。
 *
 * 验收标准（对齐实现方案 §4.3 cleaner 表格）：
 *   - 启动 + 每 6h 拉取 `GET /api/mcp/archive/inpatients`；
 *   - 清单对比本地映射：清单缺失的患者 → 触发 discharge 清理；
 *   - 拉取失败（N3 不可达）→ 跳过本轮（不误删，降级铁律）。
 *
 * 设计语义：contextKey 格式 `patientId|admissionTime`（N1 组装约定，
 * 联调校正点），本模块只提取 patientId 用于清单对比，零医疗判断。
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createInpatientWatcher, extractPatientId } from './inpatientWatcher'
import type { InpatientWatcherDeps } from './inpatientWatcher'

function makeDeps(overrides?: Partial<InpatientWatcherDeps>) {
  const deps: InpatientWatcherDeps = {
    fetchInpatients: vi.fn(async () => ['P000123', 'P000456']),
    getLocalContextKeys: vi.fn(() => ['P000123|A1', 'P000789|A1']),
    onPatientDischarged: vi.fn(async () => undefined),
    checkIntervalMs: 6 * 60 * 60 * 1000,
    ...overrides,
  }
  return deps
}

describe('inpatientWatcher 在院清单对比（US-N2-05）', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('清单缺失的本地患者 → 触发 discharge 清理；清单内患者不动', async () => {
    const deps = makeDeps()
    const watcher = createInpatientWatcher(deps)

    await watcher.checkNow()

    // P000789 不在清单 → discharge；P000123 在清单 → 不动
    expect(deps.onPatientDischarged).toHaveBeenCalledTimes(1)
    expect(deps.onPatientDischarged).toHaveBeenCalledWith('P000789|A1')
  })

  it('拉取失败（返回 null）→ 跳过本轮，不触发清理', async () => {
    const deps = makeDeps({ fetchInpatients: vi.fn(async () => null) })
    const watcher = createInpatientWatcher(deps)

    await watcher.checkNow()

    expect(deps.onPatientDischarged).not.toHaveBeenCalled()
  })

  it('定时周期：start 后按 checkIntervalMs（6h）周期检查', async () => {
    const deps = makeDeps()
    const watcher = createInpatientWatcher(deps)

    watcher.start()
    expect(deps.fetchInpatients).toHaveBeenCalledTimes(1) // 启动立即检查

    await vi.advanceTimersByTimeAsync(6 * 60 * 60 * 1000)
    expect(deps.fetchInpatients).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(6 * 60 * 60 * 1000)
    expect(deps.fetchInpatients).toHaveBeenCalledTimes(3)
    watcher.dispose()
  })

  it('extractPatientId：contextKey（patientId|admissionTime）提取患者 ID', () => {
    expect(extractPatientId('P000123|2026-08-14 10:30')).toBe('P000123')
    expect(extractPatientId('P000123')).toBe('P000123') // 无分隔符兼容
  })
})
