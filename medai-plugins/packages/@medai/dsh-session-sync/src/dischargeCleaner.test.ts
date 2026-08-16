/**
 * dischargeCleaner 测试（P6-C11，US-N2-05 三层清理-出院/转科分支）。
 *
 * 验收标准（对齐 US-N2-05 + 实现方案 §4.3 cleaner 表格）：
 *   - patient-select{inHospital:false} 即时 → 删除该患者本地会话；
 *   - **未同步缓冲先推完再删（watermark 判定）**：已同步（watermark 覆盖）
 *     直接删；有未同步缓冲先 flushSession 推送，成功后删；
 *   - 推不完（N3 不可达）→ 保留文件待下次（不删，防丢服务器副本）。
 *
 * 设计语义：N2 零医疗判断——contextKey 由 N1 下发，本模块只做
 * "删会话 + 删映射条目"的确定性操作；isFullySynced/flushSession 依赖注入
 * （组装时接 syncEngine + pushEngine）。
 */

import { describe, expect, it, vi } from 'vitest'
import { createDischargeCleaner } from './dischargeCleaner'
import type { DischargeCleanerDeps } from './dischargeCleaner'

const KEY_A1 = 'P000123|A1'

function makeDeps(overrides?: Partial<DischargeCleanerDeps>) {
  const deps: DischargeCleanerDeps = {
    getSessionId: vi.fn(() => 'session-1'),
    removeMapping: vi.fn(async () => undefined),
    isFullySynced: vi.fn(() => true),
    flushSession: vi.fn(async () => true),
    deleteSession: vi.fn(async () => undefined),
    ...overrides,
  }
  return deps
}

describe('dischargeCleaner 出院/转科清理（US-N2-05）', () => {
  it('已同步（watermark 覆盖）→ 直接删会话 + 删映射，不触发 flush', async () => {
    const deps = makeDeps()
    const cleaner = createDischargeCleaner(deps)

    const result = await cleaner.onPatientDischarged(KEY_A1)

    expect(result).toBe(true)
    expect(deps.isFullySynced).toHaveBeenCalledWith('session-1')
    expect(deps.flushSession).not.toHaveBeenCalled() // 已同步不推
    expect(deps.deleteSession).toHaveBeenCalledWith('session-1')
    expect(deps.removeMapping).toHaveBeenCalledWith(KEY_A1)
  })

  it('有未同步缓冲 → 先 flushSession 推送，成功后删会话 + 删映射', async () => {
    const deps = makeDeps({
      isFullySynced: vi.fn(() => false),
      flushSession: vi.fn(async () => true),
    })
    const cleaner = createDischargeCleaner(deps)

    const result = await cleaner.onPatientDischarged(KEY_A1)

    expect(result).toBe(true)
    expect(deps.flushSession).toHaveBeenCalledWith('session-1') // 先推完
    expect(deps.deleteSession).toHaveBeenCalledWith('session-1')
    expect(deps.removeMapping).toHaveBeenCalledWith(KEY_A1)
  })

  it('未同步且 flush 失败（N3 不可达）→ 保留待下次：不删会话、不删映射', async () => {
    const deps = makeDeps({
      isFullySynced: vi.fn(() => false),
      flushSession: vi.fn(async () => false),
    })
    const cleaner = createDischargeCleaner(deps)

    const result = await cleaner.onPatientDischarged(KEY_A1)

    expect(result).toBe(false) // 推不完保留文件待下次
    expect(deps.deleteSession).not.toHaveBeenCalled()
    expect(deps.removeMapping).not.toHaveBeenCalled()
  })

  it('无会话（contextKey 无映射）→ 空操作返回 true', async () => {
    const deps = makeDeps({ getSessionId: vi.fn(() => undefined) })
    const cleaner = createDischargeCleaner(deps)

    const result = await cleaner.onPatientDischarged(KEY_A1)

    expect(result).toBe(true)
    expect(deps.deleteSession).not.toHaveBeenCalled()
    expect(deps.removeMapping).not.toHaveBeenCalled()
  })

  it('删除会话失败 → 返回 false，映射保留（下次可重试）', async () => {
    const deps = makeDeps({
      deleteSession: vi.fn(async () => {
        throw new Error('session delete failed')
      }),
    })
    const cleaner = createDischargeCleaner(deps)

    const result = await cleaner.onPatientDischarged(KEY_A1)

    expect(result).toBe(false)
    expect(deps.removeMapping).not.toHaveBeenCalled()
  })
})
