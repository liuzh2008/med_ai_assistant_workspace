/**
 * @medai/dsh-session-sync client 半（P6-A1 接线，browser bundle）。
 *
 * 职责（实现方案 §4.1 ①④，client 承担）：
 *   - postMessage 上下文接收（identity / patient-select / pre-logout / ping）
 *   - 身份内存持有（identity：JWT 仅内存、登出置空、换人先清后换）
 *   - 每患者一会话（sessionMap：ctx.sessions 导航恢复 + localStorage 持久化；
 *     新建会话为 S1 联调接入点——ISessions 无 create）
 *   - 心跳回执（ping → pong）；登出两阶段回执（pre-logout → flush → logout-ready）
 *
 * host 半（src/index.ts）承担：session/event → syncEngine 事件同步、
 * agent/pre-step 患者上下文注入、三层清理（联调接入点见 host 注释）。
 *
 * 注意：禁止 export default（对齐官方 tsdown 产物：仅命名导出）。
 */

import { createBrowserSessionMapStore, createSessionsNavigator, type BrowserStorageLike, type SessionsLike } from './browserAdapters'
import { createPostMessageBridge, MESSAGE_TYPES, type PatientSelectPayload, type WindowLike } from './postMessageBridge'
import { beginLogout, clearIdentity, setIdentity } from '../identity'
import { createSessionMap, type SessionMap } from '../sessionMap'

export const name = '@medai/dsh-session-sync'

/** DSH client runtime 注入面：sessions（导航/恢复）。 */
export const inject = ['sessions']

export interface ClientContext {
  sessions: SessionsLike
}

export interface ClientApplyOptions {
  /** 工作站 origin 白名单（默认按当前 hostname 推导 :8080 + 127.0.0.1）。 */
  allowedOrigins?: readonly string[]
  /** 出站 targetOrigin（工作站 origin，默认白名单首项）。 */
  targetOrigin?: string
  /** 浏览器 window（测试注入）。 */
  windowLike?: WindowLike
  /** localStorage（测试注入；无则内存降级）。 */
  storage?: BrowserStorageLike
  /** 新建 DSH 会话（S1 联调接入点；ISessions 无 create，T22 验证）。 */
  createSession?: () => Promise<string>
  /** 登出前 flush（联调接 host flushCoordinator；默认直接清理不等待）。 */
  flushBeforeLogout?: () => Promise<boolean>
  /** 患者上下文回调（联调接 pre-step 状态通道；N2 不持有医疗语义）。 */
  onPatientContext?: (patient: PatientSelectPayload) => void
}

/** 无 localStorage 环境的降级存储（内存 Map）。 */
function memoryStorage(): BrowserStorageLike {
  const store = new Map<string, string>()
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value) },
    removeItem: (key: string) => { store.delete(key) },
  }
}

export function apply(ctx: ClientContext, options: ClientApplyOptions = {}): void {
  const win = options.windowLike ?? (typeof window !== 'undefined' ? (window as unknown as WindowLike) : undefined)
  const hostname = typeof window !== 'undefined' && window.location ? window.location.hostname : '127.0.0.1'
  const allowedOrigins = options.allowedOrigins ?? [`http://${hostname}:8080`, 'http://127.0.0.1:8080']
  const targetOrigin = options.targetOrigin ?? allowedOrigins[0]

  let sessionMap: SessionMap | undefined

  async function ensureSessionMap(): Promise<SessionMap | undefined> {
    if (sessionMap) return sessionMap
    try {
      const navigator = createSessionsNavigator({
        sessions: ctx.sessions,
        createSession: options.createSession
          ?? (() => Promise.reject(new Error('createSession not wired（S1 联调接入点，T22 接入 DSH 会话创建 API）'))),
      })
      const storage = options.storage ?? (typeof localStorage !== 'undefined' ? localStorage : memoryStorage())
      sessionMap = await createSessionMap(navigator, createBrowserSessionMapStore(storage))
      return sessionMap
    } catch {
      return undefined // 映射不可用不阻塞对话（降级铁律）
    }
  }

  const bridge = createPostMessageBridge({
    allowedOrigins,
    targetOrigin,
    windowLike: win,
    targetWindow: () => {
      if (typeof window === 'undefined' || !window.parent) return null
      return window.parent as unknown as WindowLike & { postMessage(message: unknown, targetOrigin: string): void }
    },
    handlers: {
      async onIdentity(payload) {
        await setIdentity(payload)
      },
      async onPatientSelect(payload) {
        options.onPatientContext?.(payload)
        if (payload.inHospital === false) {
          // 出院/转科：本地会话清理由清理层（host 出院策略/在院清单）负责；
          // client 侧即时清理映射条目（未同步先推完再删语义在清理层，T22 联调验证）
          await sessionMap?.remove(payload.contextKey).catch(() => {})
          return
        }
        const sm = await ensureSessionMap()
        if (!sm) return
        await sm.select(payload.contextKey).catch(() => {})
      },
      async onPreLogout() {
        beginLogout()
        const ok = options.flushBeforeLogout
          ? await options.flushBeforeLogout().catch(() => false)
          : true
        clearIdentity()
        bridge.send(MESSAGE_TYPES.LOGOUT_READY, { ok })
      },
      async onPing() {
        bridge.send(MESSAGE_TYPES.PONG, { ok: true })
      },
    },
  })

  // 桥已挂 window message 监听；dispose 由应用生命周期管理（导出给上层可选）
  ;(apply as unknown as { __bridge?: unknown }).__bridge = bridge
}
