/**
 * cleanupStrategy（P6-C11 重构，US-N2-05 三层清理统一策略接口）。
 *
 * logout/discharge/stale 三实现统一 `CleanupStrategy`：kind 标识 + run()
 * 返回是否成功（false = 未完成：登出超时/出院推不完/删除失败，调度方可
 * 告警或重试）。cleaner 聚合调度（登出、出院、定时）可插拔组合。
 *
 * @module @medai/dsh-session-sync/cleanupStrategy
 */

import type { FlushCoordinator } from './flushCoordinator'
import type { DischargeCleaner } from './dischargeCleaner'
import type { StaleCleaner } from './staleCleaner'

export type CleanupKind = 'logout' | 'discharge' | 'stale'

export interface CleanupStrategy {
  readonly kind: CleanupKind
  /** 执行清理；true=成功/已清理，false=未完成（超时/推不完/删除失败）。 */
  run(): Promise<boolean>
}

/** 登出策略：flushCoordinator 编排（排空→删会话→删文件→回执）。 */
export function createLogoutStrategy(coordinator: FlushCoordinator): CleanupStrategy {
  return {
    kind: 'logout',
    async run(): Promise<boolean> {
      const outcome = await coordinator.runLogoutFlush()
      return outcome.ok
    },
  }
}

/** 出院策略：指定 contextKey 的会话清理（未同步先推完再删）。 */
export function createDischargeStrategy(
  cleaner: DischargeCleaner,
  contextKey: string,
): CleanupStrategy {
  return {
    kind: 'discharge',
    run(): Promise<boolean> {
      return cleaner.onPatientDischarged(contextKey)
    },
  }
}

/** 定时兜底策略：超期/孤儿清理（删除 0 个也为成功）。 */
export function createStaleStrategy(staleCleaner: StaleCleaner): CleanupStrategy {
  return {
    kind: 'stale',
    async run(): Promise<boolean> {
      await staleCleaner.runStaleCleanup()
      return true
    },
  }
}
