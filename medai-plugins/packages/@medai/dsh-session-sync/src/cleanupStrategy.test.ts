/**
 * cleanupStrategy 测试（P6-C11 重构，三层清理统一策略接口）。
 *
 * 三实现（logout/discharge/stale）统一 kind 标识 + run() 成功语义；
 * 调度方按统一接口组合，不感知各层实现差异。
 */

import { describe, expect, it, vi } from 'vitest'
import type { FlushCoordinator } from './flushCoordinator'
import { createLogoutStrategy, createDischargeStrategy, createStaleStrategy } from './cleanupStrategy'

describe('cleanupStrategy 三层清理统一接口（P6-C11 重构）', () => {
  it('logout 策略：委托 flushCoordinator，成功语义 = outcome.ok', async () => {
    const coordinator: FlushCoordinator = {
      runLogoutFlush: vi.fn(async () => ({ ok: true })),
    }
    const strategy = createLogoutStrategy(coordinator)

    expect(strategy.kind).toBe('logout')
    expect(await strategy.run()).toBe(true)
    expect(coordinator.runLogoutFlush).toHaveBeenCalledTimes(1)

    coordinator.runLogoutFlush = vi.mocked(coordinator.runLogoutFlush).mockResolvedValueOnce({ ok: false, timedOut: true })
    expect(await strategy.run()).toBe(false)
  })

  it('discharge 策略：委托 dischargeCleaner（绑定 contextKey）', async () => {
    const cleaner = {
      onPatientDischarged: vi.fn(async () => true),
    }
    const strategy = createDischargeStrategy(cleaner, 'P000123|A1')

    expect(strategy.kind).toBe('discharge')
    expect(await strategy.run()).toBe(true)
    expect(cleaner.onPatientDischarged).toHaveBeenCalledWith('P000123|A1')

    cleaner.onPatientDischarged.mockResolvedValueOnce(false) // 推不完保留
    expect(await strategy.run()).toBe(false)
  })

  it('stale 策略：委托 staleCleaner（删除 0 个也为成功）', async () => {
    const staleCleaner = {
      runStaleCleanup: vi.fn(async () => 0),
    }
    const strategy = createStaleStrategy(staleCleaner)

    expect(strategy.kind).toBe('stale')
    expect(await strategy.run()).toBe(true)
    expect(staleCleaner.runStaleCleanup).toHaveBeenCalledTimes(1)
  })
})
