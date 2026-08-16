/**
 * dischargeCleaner（P6-C11，US-N2-05 出院/转科清理）。
 *
 * patient-select{inHospital:false} 即时触发 + 在院清单对比（inpatientWatcher）
 * 共用此清理器：删除该患者本地会话——**未同步缓冲先推完再删（watermark
 * 判定）**：已同步直接删；有未同步先 flushSession 推送，成功后删；
 * 推不完（N3 不可达）→ 保留文件待下次（不删，防丢服务器副本）。
 *
 * 设计语义：N2 零医疗判断——contextKey 由 N1 下发，本模块只做确定性操作；
 * isFullySynced/flushSession 依赖注入（组装时接 syncEngine + pushEngine，
 * 判定 = watermark 覆盖本地最高事件 seq）。
 *
 * @module @medai/dsh-session-sync/dischargeCleaner
 */

export interface DischargeCleanerDeps {
  /** 映射查询（sessionMap.get）。 */
  getSessionId: (contextKey: string) => string | undefined
  /** 删除映射条目并持久化（sessionMap.remove）。 */
  removeMapping: (contextKey: string) => Promise<void>
  /** watermark 覆盖判定：无未同步缓冲（含在途重试）→ true。 */
  isFullySynced: (sessionId: string) => boolean
  /** 未同步时先推送剩余事件；返回是否已全部确认。 */
  flushSession: (sessionId: string) => Promise<boolean>
  /** 删除该患者本地 DSH 会话（S1 会话 API）。 */
  deleteSession: (sessionId: string) => Promise<void>
}

export interface DischargeCleaner {
  /**
   * 出院/转科清理入口。
   * @returns true=已清理（或无可清理）；false=未同步推不完，保留待下次
   */
  onPatientDischarged(contextKey: string): Promise<boolean>
}

export function createDischargeCleaner(deps: DischargeCleanerDeps): DischargeCleaner {
  return {
    async onPatientDischarged(contextKey: string): Promise<boolean> {
      const sessionId = deps.getSessionId(contextKey)
      if (sessionId === undefined) return true // 无会话无需处理

      if (!deps.isFullySynced(sessionId)) {
        const flushed = await deps.flushSession(sessionId)
        if (!flushed) return false // 推不完保留待下次（防丢服务器副本）
      }

      try {
        await deps.deleteSession(sessionId)
      } catch {
        return false // 删除失败：映射保留，下次可重试
      }
      await deps.removeMapping(contextKey)
      return true
    },
  }
}
