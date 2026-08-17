/**
 * browserAdapters（P6-A1）——client bundle 浏览器侧适配器。
 *
 * - {@link createBrowserSessionMapStore}：localStorage 持久化 sessionMap
 *   （浏览器无 node:fs，localStorage.setItem 本身原子，对齐 map.json 语义）；
 * - {@link createSessionsNavigator}：ctx.sessions（DSH client runtime ISessions）
 *   适配 SessionNavigator——open 恢复既有会话；create 为注入的 DSH 新会话
 *   API（ISessions 无 create，S1 spike 结论：服务端 SessionStore 创建，
 *   联调接入点，T22 验证）。
 *
 * @module @medai/dsh-session-sync/client/browserAdapters
 */

import type { SessionMapStore, SessionNavigator } from '../sessionMap'

/** DSH client runtime sessions 面（自声明子集，不 import DSH 包）。 */
export interface SessionsLike {
  /** 打开既有会话（unknown ids fail loud，故 open 需 try）。 */
  open(id: string): void
}

export interface BrowserStorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface SessionsNavigatorOptions {
  sessions: SessionsLike
  /** 创建新会话（DSH 新会话 API；联调接入点，默认不可用降级为抛错）。 */
  createSession: () => Promise<string>
}

const DEFAULT_KEY = 'medai.dsh.session-map'

/**
 * localStorage 版 SessionMapStore（浏览器无 node:fs；localStorage.setItem 原子）。
 */
export function createBrowserSessionMapStore(
  storage: BrowserStorageLike,
  key: string = DEFAULT_KEY,
): SessionMapStore {
  return {
    async load(): Promise<Record<string, string>> {
      try {
        const raw = storage.getItem(key)
        if (raw === null || raw === '') return {}
        const parsed = JSON.parse(raw) as unknown
        if (parsed === null || typeof parsed !== 'object') return {}
        return parsed as Record<string, string>
      } catch {
        return {} // 损坏容错（对齐文件 store 语义：load 失败返回空映射）
      }
    },
    async save(map: Record<string, string>): Promise<void> {
      storage.setItem(key, JSON.stringify(map))
    },
  }
}

/**
 * ctx.sessions 适配 SessionNavigator：open 恢复既有会话（未知 id 抛错 → false）；
 * create 走注入的 DSH 新会话 API（S1 替换点，T22 联调接入）。
 */
export function createSessionsNavigator(opts: SessionsNavigatorOptions): SessionNavigator {
  return {
    async open(sessionId: string): Promise<boolean> {
      try {
        opts.sessions.open(sessionId)
        return true
      } catch {
        return false // 会话已不存在（看门狗清理等）→ 调用方重建
      }
    },
    async create(): Promise<string> {
      return opts.createSession()
    },
  }
}
