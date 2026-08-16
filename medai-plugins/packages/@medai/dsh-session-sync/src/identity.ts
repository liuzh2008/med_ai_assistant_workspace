/**
 * identity（P6-C5，US-N2-01 身份内存持有）。
 *
 * 工作站经 postMessage 注入的 JWT 仅存模块级变量：不落盘、不进任何
 * 日志/事件/审计（本模块零输出通道）；pre-logout 后由 flush 编排器在
 * 完成后调用 clearIdentity 置空；换人登录先执行旧身份登出清理
 * （onSwitchAway 钩子，index.ts 接线 cleaner）再持有新 JWT。
 *
 * 状态机：absent → active ⇄ logging-out → absent
 *   - active：正常持有，getIdentity 供存档推送签名使用；
 *   - logging-out：pre-logout 已收到、flush 进行中——JWT 保留到
 *     flush 完成（推送签名仍需要），期间收到新 identity 视为快速
 *     重新登录，不再重复触发清理（避免双重 flush）；
 *   - absent：无身份（登出完成 / 初始态）。
 *
 * @module @medai/dsh-session-sync/identity
 */

export interface IdentityPayload {
  jwt: string
  doctorName: string
  departmentName: string
}

export type IdentityContext = IdentityPayload

export type IdentityState = 'absent' | 'active' | 'logging-out'

/** 换人钩子：旧身份登出清理（由 index.ts 接线 cleaner；失败不阻塞切换）。 */
export type SwitchAwayHandler = (prev: IdentityContext) => void | Promise<void>

let state: IdentityState = 'absent'
let current: IdentityContext | null = null
let onSwitchAway: SwitchAwayHandler | null = null

/** 注入换人清理钩子；传 null 解除。 */
export function setSwitchAwayHandler(handler: SwitchAwayHandler | null): void {
  onSwitchAway = handler
}

export function getState(): IdentityState {
  return state
}

/** 当前身份上下文；absent 时为 null。JWT 仅经此访问器供签名用途取用。 */
export function getIdentity(): IdentityContext | null {
  return current
}

/**
 * 持有/切换身份。
 * - active 中再调用（换人登录）：先 await onSwitchAway(旧身份) 再替换；
 *   钩子异常被吞掉——N3 不可达等场景下新身份仍须生效；
 * - logging-out 中再调用（快速重新登录）：登出清理已启动，不重复触发，
 *   直接替换为 active。
 */
export async function setIdentity(payload: IdentityPayload): Promise<IdentityContext> {
  const prev = current
  if (prev && state === 'active' && onSwitchAway) {
    try {
      await onSwitchAway(prev)
    } catch {
      // 旧身份清理失败不阻塞新身份生效
    }
  }
  current = { ...payload }
  state = 'active'
  return current
}

/** pre-logout：进入登出中状态；absent 时为空操作。JWT 保留供 flush 签名。 */
export function beginLogout(): void {
  if (state === 'absent') return
  state = 'logging-out'
}

/** flush 完成：JWT 置空，回到 absent。此后任何推送请求不再携带该 JWT。 */
export function clearIdentity(): void {
  current = null
  state = 'absent'
}
