/**
 * sessionMap（P6-C6，US-N2-02 每患者一会话分治）。
 *
 * contextKey（N1 下发，= patientId|admissionTime）→ DSH sessionId 映射：
 * 内存 Map 为主，变更即经 store 原子持久化（map.json，临时文件 + rename）。
 *
 * 核心算法（select）：
 *   - 命中且会话存在（navigator.open 成功）→ 导航恢复，不新建；
 *   - 未命中，或命中但会话已消失（看门狗清理等）→ create 新建并更新映射；
 *   - N2 零医疗判断：重入院/转科 key 变化自然开新会话。
 *
 * navigator/store 均为注入依赖：sessionNavigator 接口隔离 S1 会话导航
 * API 的替换点（实现方案 §4.3 / §11）；文件 store 见
 * {@link sessionMapFileStore}（node:fs，仅 host 侧）；
 * client 浏览器侧用 {@link createBrowserSessionMapStore}（localStorage）。
 * 持久化失败不阻塞对话（降级铁律），内存映射始终可用，下次变更再写。
 *
 * @module @medai/dsh-session-sync/sessionMap
 */

/** DSH 会话导航抽象（S1 spike 结论：ctx.sessions.open/create）。 */
export interface SessionNavigator {
  /** 打开既有会话；返回 false 表示会话已不存在（调用方须重建）。 */
  open(sessionId: string): Promise<boolean>
  /** 创建新会话并返回其 sessionId。 */
  create(): Promise<string>
}

/** 映射持久化抽象（真实实现：map.json 原子写）。 */
export interface SessionMapStore {
  load(): Promise<Record<string, string>>
  save(map: Record<string, string>): Promise<void>
}

export interface SessionMap {
  /**
   * 患者上下文选择唯一入口：恢复既有会话或创建新会话。
   * @returns created=false 为恢复既有；true 为新建（映射已更新并尝试持久化）
   */
  select(contextKey: string): Promise<{ sessionId: string; created: boolean }>
  get(contextKey: string): string | undefined
  all(): Record<string, string>
  /** 显式持久化当前映射（原子写；失败静默，不抛）。 */
  persist(): Promise<void>
  /** 删除映射条目并持久化（P6-C11 出院/转科清理用）；条目不存在为空操作。 */
  remove(contextKey: string): Promise<void>
}

/** 创建会话映射：启动即加载既有映射（DSH 重启恢复，不产生重复会话）。 */
export async function createSessionMap(
  navigator: SessionNavigator,
  store: SessionMapStore,
): Promise<SessionMap> {
  const map = await store.load()

  async function persist(): Promise<void> {
    try {
      await store.save({ ...map })
    } catch {
      // 持久化失败不阻塞：内存映射仍可用，下次变更再写（降级铁律）
    }
  }

  return {
    async select(contextKey: string) {
      const existing = map[contextKey]
      if (existing !== undefined && (await navigator.open(existing))) {
        return { sessionId: existing, created: false }
      }
      const sessionId = await navigator.create()
      map[contextKey] = sessionId
      await persist()
      return { sessionId, created: true }
    },
    get(contextKey: string) {
      return map[contextKey]
    },
    all() {
      return { ...map }
    },
    async remove(contextKey: string) {
      if (map[contextKey] === undefined) return // 空操作：无条目不持久化
      delete map[contextKey]
      await persist()
    },
    persist,
  }
}
