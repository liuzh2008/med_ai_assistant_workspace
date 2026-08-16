/**
 * staleCleaner（P6-C11，US-N2-05 定时兜底清理）。
 *
 * DSH 启动 + 每晚执行：删 mtime 超 staleDays（默认 3 天）未访问的会话文件
 * + 无映射的孤儿文件（无患者归属，直接删）；**在院患者的会话不受影响**
 * （不误删，US-N2-05）。删除数量返回便于调度方记录/告警。
 *
 * 设计语义：listSessionFiles/deleteSession 依赖注入（S1 会话文件 API +
 * DSH 看门狗文件扫描替换点）；staleDays/now 可注入（cordis 配置
 * cleanupStaleDays）。
 *
 * @module @medai/dsh-session-sync/staleCleaner
 */

export interface StaleSessionFile {
  sessionId: string
  /** 最近访问时间戳（ms）。 */
  mtimeMs: number
}

export interface StaleCleanerDeps {
  /** 扫描本地会话文件（含 mtime）。 */
  listSessionFiles: () => Promise<StaleSessionFile[]>
  /** 有映射的会话集合（孤儿判定：不在其中 = 无患者归属）。 */
  getMappedSessionIds: () => Set<string>
  /** 在院保护：该会话患者是否在院（在院不删）。 */
  isInpatientSession: (sessionId: string) => Promise<boolean>
  /** 删除会话（S1 会话 API）。 */
  deleteSession: (sessionId: string) => Promise<void>
  /** 未访问超期阈值（默认 3 天）。 */
  staleDays?: number
  /** 当前时刻（测试注入；默认 Date.now）。 */
  now?: () => number
}

export interface StaleCleaner {
  /** 执行兜底清理，返回删除的会话数。 */
  runStaleCleanup(): Promise<number>
}

export function createStaleCleaner(deps: StaleCleanerDeps): StaleCleaner {
  const staleMs = (deps.staleDays ?? 3) * 24 * 60 * 60 * 1000
  const now = deps.now ?? Date.now

  return {
    async runStaleCleanup(): Promise<number> {
      const files = await deps.listSessionFiles()
      const mapped = deps.getMappedSessionIds()
      const current = now()
      let deleted = 0

      for (const file of files) {
        if (!mapped.has(file.sessionId)) {
          // 无映射孤儿文件：无患者归属，直接删
          await deps.deleteSession(file.sessionId)
          deleted++
          continue
        }
        if (current - file.mtimeMs <= staleMs) continue // 未超期不删
        if (await deps.isInpatientSession(file.sessionId)) continue // 在院不误删
        await deps.deleteSession(file.sessionId)
        deleted++
      }
      return deleted
    },
  }
}
