/**
 * cleaner（P6-C10 登出分支；P6-C11 出院/定时分支）。
 *
 * 三层清理的薄接线层（编排逻辑在 flushCoordinator/清理策略实现）：
 * 登出分支 = 收到 pre-logout → flushCoordinator.runLogoutFlush()
 * → 回 logout-ready{ok}；失败/超时 → 回执 ok:false + 告警。
 *
 * 设计语义：sendLogoutReady 依赖注入（postMessage 协议回执）；ctx 接线
 * （ctx.on('session/pre-logout')）在 client/index.ts 组装时完成。
 *
 * @module @medai/dsh-session-sync/cleaner
 */

import type { FlushCoordinator } from './flushCoordinator'

export interface LogoutCleanerDeps {
  coordinator: FlushCoordinator
  /** postMessage 回执：logout-ready{ok}（N1 侧 T4 已接线等待）。 */
  sendLogoutReady: (ok: boolean) => void
  /** 上报告警（超时/失败，旁路降级明示）。 */
  onAlert: (message: string) => void
}

export interface LogoutCleaner {
  /** pre-logout 入口：编排登出 flush 并回执。 */
  onPreLogout(): Promise<void>
}

export function createLogoutCleaner(deps: LogoutCleanerDeps): LogoutCleaner {
  return {
    async onPreLogout(): Promise<void> {
      const outcome = await deps.coordinator.runLogoutFlush()
      deps.sendLogoutReady(outcome.ok)
      if (!outcome.ok) {
        deps.onAlert(
          outcome.timedOut
            ? '登出 flush 超时：未同步内容已丢弃（服务器不可达），本地文件已清理'
            : '登出清理失败：本地会话/文件删除异常，请手工检查后重试',
        )
      }
    },
  }
}
