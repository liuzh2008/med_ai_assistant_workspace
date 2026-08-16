/**
 * cleaner 测试（P6-C10，US-N2-05 三层清理-登出分支）。
 *
 * 登出分支：收到 pre-logout → flushCoordinator 编排（排空→删会话→删文件）
 * → 回 logout-ready{ok}；编排失败/超时 → 回执 ok:false + 上报告警。
 *
 * 设计语义：cleaner 为薄接线层，不持有编排逻辑（重构要求 flushCoordinator
 * 独立）；sendLogoutReady 依赖注入（postMessage 协议回执，N1 侧 T4 已接线）。
 */

import { describe, expect, it, vi } from 'vitest'
import { createLogoutCleaner } from './cleaner'
import type { LogoutCleanerDeps } from './cleaner'

function makeCoordinator(outcome: { ok: boolean; timedOut?: boolean }) {
  return {
    runLogoutFlush: vi.fn(async () => outcome),
  }
}

describe('cleaner 登出分支（US-N2-05）', () => {
  it('编排成功 → 回 logout-ready{ok:true}，不告警', async () => {
    const coord = makeCoordinator({ ok: true })
    const sendLogoutReady = vi.fn()
    const onAlert = vi.fn()
    const cleaner = createLogoutCleaner({
      coordinator: coord,
      sendLogoutReady,
      onAlert,
    })

    await cleaner.onPreLogout()

    expect(coord.runLogoutFlush).toHaveBeenCalledTimes(1)
    expect(sendLogoutReady).toHaveBeenCalledWith(true)
    expect(onAlert).not.toHaveBeenCalled()
  })

  it('编排超时/失败 → 回 logout-ready{ok:false} + 上报告警', async () => {
    const coord = makeCoordinator({ ok: false, timedOut: true })
    const sendLogoutReady = vi.fn()
    const onAlert = vi.fn()
    const cleaner = createLogoutCleaner({
      coordinator: coord,
      sendLogoutReady,
      onAlert,
    })

    await cleaner.onPreLogout()

    expect(sendLogoutReady).toHaveBeenCalledWith(false)
    expect(onAlert).toHaveBeenCalledTimes(1)
  })
})
