/**
 * flushCoordinator（P6-C10，US-N2-05 登出 flush 编排）。
 *
 * 登出编排：等所有在途推送确认（≤30s）→ 删全部本地会话 → 删映射/watermark
 * 文件 → 回执；**超时（N3 不可达）→ 丢弃缓冲 + 告警 + 本地文件仍删除**
 * （防跨使用者数据残留，US-N2-05），回执 ok:false；删除失败 → 告警 +
 * 回执 ok:false，不进入后续步骤（不删不完整状态）。
 *
 * 设计语义：超时计时职责在 waitForDrain 实现方（syncEngine 侧），编排器
 * 只传递 timeoutMs（默认 30000，cordis 配置 flushTimeoutMs）并按结果编排；
 * 各步骤依赖注入（S1 会话删除 API / 文件系统 / 告警通道替换点）。
 *
 * @module @medai/dsh-session-sync/flushCoordinator
 */

export interface FlushCoordinatorDeps {
  /** 等所有在途推送确认（含后台重试）；实现方负责超时，超时返回 false。 */
  waitForDrain: (timeoutMs: number) => Promise<boolean>
  /** 删除全部本地 DSH 会话（S1 会话 API，清理策略接口实现之一）。 */
  deleteAllSessions: () => Promise<void>
  /** 删除 map.json / watermark.json（本地状态文件）。 */
  deleteLocalStateFiles: () => Promise<void>
  /** 超时后丢弃未同步缓冲（登出流程不再等待）。 */
  discardBuffer: () => void
  /** 上报告警（超时/删除失败，N1 旁路降级明示通道）。 */
  onAlert: (message: string) => void
  /** 排空等待上限（默认 30000ms，与 N1 等待一致）。 */
  timeoutMs?: number
}

export interface FlushOutcome {
  ok: boolean
  timedOut?: boolean
}

export interface FlushCoordinator {
  /** 执行登出 flush 编排，返回回执结果。 */
  runLogoutFlush(): Promise<FlushOutcome>
}

export function createFlushCoordinator(deps: FlushCoordinatorDeps): FlushCoordinator {
  const timeoutMs = deps.timeoutMs ?? 30000

  async function deleteLocalState(): Promise<boolean> {
    try {
      await deps.deleteAllSessions()
    } catch {
      deps.onAlert('登出清理失败：本地会话删除异常，回执 ok:false')
      return false
    }
    try {
      await deps.deleteLocalStateFiles()
    } catch {
      deps.onAlert('登出清理失败：本地映射/watermark 文件删除异常，回执 ok:false')
      return false
    }
    return true
  }

  return {
    async runLogoutFlush(): Promise<FlushOutcome> {
      const drained = await deps.waitForDrain(timeoutMs)
      if (!drained) {
        deps.discardBuffer()
        deps.onAlert('登出 flush 超时（30s）：未同步缓冲已丢弃，本地文件仍清理')
        await deleteLocalState()
        return { ok: false, timedOut: true }
      }
      const cleaned = await deleteLocalState()
      if (!cleaned) return { ok: false }
      return { ok: true }
    },
  }
}
