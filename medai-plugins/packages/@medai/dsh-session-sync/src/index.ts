/**
 * @medai/dsh-session-sync host 半（P6-A1 接线，node 插件）。
 *
 * 职责（实现方案 §4.1 ②③④，host 承担——服务端事件流/钩子/持久化都在 node 侧）：
 *   - 会话事件同步：订阅 DSH `session/event`（core/session 全局事件）→ 缓冲
 *     → 掩码（复用 pii-guard 同源）→ 增量推送 N3 → watermark 推进/退避重试
 *   - 患者上下文注入：`agent/pre-step`（patientContextInject；当前患者状态由
 *     {@link setHostPatientContext} 提供，联调接 client 状态通道，未选患者反问降级）
 *   - 三层清理：登出 flush / 出院·转科 / 定时兜底（inpatientWatcher + cleaner 组合，
 *     联调接入点：真实 DSH 会话删除 API 与在院清单拉取）
 *
 * client 半（src/client/index.ts）承担：postMessage 接收（identity/patient-select/
 * pre-logout/ping）、身份内存持有、会话导航恢复、心跳与登出回执。
 *
 * 注意：禁止 export default（对齐官方 tsdown 产物：仅命名导出）。
 */

import { apply as applyPatientInject, type PatientContext } from './patientContextInject'
import { createEventBuffer, TURN_END_TYPE, type EventBuffer, type SyncEvent } from './syncEngine'
import { maskEvents } from './maskEvents'
import { createPushEngine, createFileWatermarkStore, type ArchivePushContext, type PushEngine, type WatermarkStore } from './pushEngine'

export const name = '@medai/dsh-session-sync'

/** DSH 会话事件（core/session SessionEvent 子集，自声明不 import DSH 包）。 */
export interface SessionEventLike {
  seq: number
  type: string
  time: number | string
  data?: unknown
}

/** DSH 会话对象（session/event 监听器参数，取 id）。 */
export interface SessionLike {
  id: string
}

/** host 插件上下文（agent/pre-step 与 session/event 事件面）。 */
export interface HostContext {
  on(event: string, listener: (...args: unknown[]) => void, opts?: { global?: boolean }): unknown
}

export interface HostSyncOptions {
  /** N3 存档端点（默认 dev 后端）。 */
  endpoint?: string
  /** JWT 提供者（联调接身份通道；null 不带 Authorization）。 */
  getToken?: () => string | null
  /** 推送上下文提供者（doctorId/patientId/version；联调接患者状态通道）。 */
  getContext?: () => ArchivePushContext | null
  /** watermark 持久化（默认内存；联调接 DSH 数据目录文件 store）。 */
  watermarkStore?: WatermarkStore
  /** 缓冲参数（默认 200 条 / 5s 兜底）。 */
  maxEvents?: number
  idleIntervalMs?: number
  /** 测试注入 fetch。 */
  fetchImpl?: typeof fetch
}

/** 当前患者状态（host pre-step 注入源；client 状态通道联调接入）。 */
let currentPatient: PatientContext | null = null

/** 联调接入：client 状态通道（信任文件/DSH 会话 meta）更新当前患者。 */
export function setHostPatientContext(patient: PatientContext | null): void {
  currentPatient = patient
}

export function getHostPatientContext(): PatientContext | null {
  return currentPatient
}

/**
 * 会话事件 → SyncEvent（纯函数，可测）：seq/type 透传，payload 取事件 data。
 */
export function toSyncEvent(sessionId: string, event: SessionEventLike): SyncEvent {
  return {
    sessionId,
    seq: event.seq,
    type: event.type,
    payload: event.data ?? {},
  }
}

/** 内存 watermark store（默认降级；真实文件 store 联调接入）。 */
function memoryWatermarkStore(): WatermarkStore {
  const store = new Map<string, number>()
  return {
    async load(): Promise<Record<string, number>> {
      return Object.fromEntries(store)
    },
    async save(watermarks: Record<string, number>): Promise<void> {
      store.clear()
      for (const [k, v] of Object.entries(watermarks)) store.set(k, v)
    },
  }
}

/**
 * 插件装配（host）：session/event → 缓冲 → 掩码 → 推送；pre-step 患者注入；
 * 三层清理组装点（联调接入）。
 */
export function apply(ctx: HostContext, options: HostSyncOptions = {}): void {
  const endpoint = options.endpoint ?? 'http://127.0.0.1:8081/api/mcp/archive/events'
  const getToken = options.getToken ?? (() => null)
  const getContext = options.getContext ?? (() => null)

  const pushEngine: PushEngine = createPushEngine({
    endpoint,
    getToken,
    watermarkStore: options.watermarkStore ?? memoryWatermarkStore(),
    fetchImpl: options.fetchImpl,
  })

  const buffer: EventBuffer = createEventBuffer({
    maxEvents: options.maxEvents,
    idleIntervalMs: options.idleIntervalMs,
    isTurnEnd: (event) => event.type === TURN_END_TYPE,
    onFlush: async (events) => {
      const ctxInfo = getContext()
      if (!ctxInfo) return // 未选定患者/医生 → 缓冲保留（下轮再推），不丢数据
      // 掩码只作用于推送副本，不改写 DSH 本地会话原文（US-N2-04）
      const masked = maskEvents(events, null)
      await pushEngine.push(masked, ctxInfo)
    },
  })

  // ① 会话事件流 → 缓冲（core/session 全局事件；session/created 后的事件均可达）
  ctx.on('session/event', (session, event) => {
    const s = session as SessionLike
    const e = event as SessionEventLike
    if (!s || !e || typeof s.id !== 'string' || typeof e.seq !== 'number') return
    buffer.enqueue(toSyncEvent(s.id, e))
  })

  // ② 患者上下文注入（agent/pre-step；未选患者 → 反问降级，N2 零医疗判断）
  applyPatientInject(ctx as Parameters<typeof applyPatientInject>[0], () => currentPatient)

  // ③ 三层清理组装（联调接入点）：登出 flush 由 client pre-logout 触发
  //    （flushBeforeLogout 注入）；出院/定时由 inpatientWatcher + cleaner 组合，
  //    依赖真实 DSH 会话删除 API 与在院清单端点，T22 联调接入。

  // 插件卸载清理
  ;(apply as unknown as { __dispose?: () => void }).__dispose = () => {
    buffer.dispose()
    pushEngine.dispose()
  }
}

// 供测试/联调按需访问内部（不污染公共 API）
export { createFileWatermarkStore }
