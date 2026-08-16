/**
 * identity 生命周期测试（P6-C5，US-N2-01 身份内存持有）。
 *
 * 验收标准：
 *   1. 工作站发送 identity{jwt, doctorName, departmentName} → JWT 存模块级变量，
 *      任何事件/日志输出中不出现 JWT 原文；
 *   2. 收到 pre-logout → 登出清理执行后 JWT 置空，后续推送不带该 JWT；
 *   3. 换人登录 → 先执行旧身份的登出清理，再持有新 JWT。
 *
 * 设计语义（对齐实现方案 §4.3 identity 节）：
 *   - beginLogout（pre-logout）进入 logging-out：JWT 保留到 flush 完成
 *     （推送签名仍需要），clearIdentity 由 flush 编排器在完成后调用；
 *   - 换人（active 中再 setIdentity）：await onSwitchAway(旧身份) 再替换，
 *     钩子失败不阻塞切换（N3 不可达等场景新身份仍须生效）；
 *   - logging-out 中收到新 identity：不再重复触发清理（登出流程已启动，
 *     避免双重 flush），直接替换为 active。
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  setIdentity,
  beginLogout,
  clearIdentity,
  getIdentity,
  getState,
  setSwitchAwayHandler,
} from './identity'

const JWT_OLD = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJEMDAxIn0.old-signature'
const JWT_NEW = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJEMDAyIn0.new-signature'

const OLD = { jwt: JWT_OLD, doctorName: '张医生', departmentName: '心血管一病区' }
const NEW = { jwt: JWT_NEW, doctorName: '李医生', departmentName: '呼吸内科' }

describe('identity（US-N2-01 身份内存持有）', () => {
  beforeEach(() => {
    setSwitchAwayHandler(null)
    clearIdentity()
  })

  it('持有：setIdentity 后 getIdentity 返回完整身份上下文，状态 active', async () => {
    await setIdentity(OLD)
    expect(getIdentity()).toEqual(OLD)
    expect(getState()).toBe('active')
  })

  it('登出两段：beginLogout 进入 logging-out（JWT 保留供 flush 签名），clearIdentity 后置空回 absent', async () => {
    await setIdentity(OLD)
    beginLogout()
    expect(getState()).toBe('logging-out')
    // flush 编排期间推送签名仍需 JWT（"后续存档推送请求不带该 JWT"以 clearIdentity 为界）
    expect(getIdentity()?.jwt).toBe(JWT_OLD)
    clearIdentity()
    expect(getIdentity()).toBeNull()
    expect(getState()).toBe('absent')
  })

  it('JWT 零输出通道：完整生命周期不产生任何日志输出', async () => {
    const spies = ['log', 'info', 'warn', 'error', 'debug'].map((k) =>
      vi.spyOn(console, k as never).mockImplementation(() => {}),
    )
    await setIdentity(OLD)
    beginLogout()
    clearIdentity()
    await setIdentity(NEW)
    beginLogout()
    clearIdentity()
    for (const s of spies) {
      expect(s).not.toHaveBeenCalled()
      s.mockRestore()
    }
  })

  it('换人先清后换：active 状态下 setIdentity 先 await onSwitchAway(旧身份)，再持有新身份', async () => {
    const away = vi.fn(async (prev: typeof OLD) => {
      expect(prev.jwt).toBe(JWT_OLD)
    })
    setSwitchAwayHandler(away)
    await setIdentity(OLD)
    await setIdentity(NEW)
    expect(away).toHaveBeenCalledTimes(1)
    expect(away).toHaveBeenCalledWith(OLD)
    expect(getIdentity()).toEqual(NEW)
    expect(getState()).toBe('active')
  })

  it('换人钩子失败不阻塞：onSwitchAway 抛错后新身份仍生效', async () => {
    setSwitchAwayHandler(async () => {
      throw new Error('archive unreachable')
    })
    await setIdentity(OLD)
    await expect(setIdentity(NEW)).resolves.toEqual(NEW)
    expect(getIdentity()).toEqual(NEW)
  })

  it('logging-out 中收到新 identity：不重复触发清理（避免双重 flush），直接替换为 active', async () => {
    const away = vi.fn()
    setSwitchAwayHandler(away)
    await setIdentity(OLD)
    beginLogout()
    await setIdentity(NEW)
    expect(away).not.toHaveBeenCalled()
    expect(getState()).toBe('active')
    expect(getIdentity()).toEqual(NEW)
  })

  it('absent 状态 beginLogout 为空操作（无身份可登出）', () => {
    beginLogout()
    expect(getState()).toBe('absent')
    expect(getIdentity()).toBeNull()
  })

  afterEach(() => {
    setSwitchAwayHandler(null)
    clearIdentity()
  })
})
