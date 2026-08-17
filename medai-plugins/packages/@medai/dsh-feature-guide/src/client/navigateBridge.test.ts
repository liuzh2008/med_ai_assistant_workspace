/**
 * G3-C3 红阶段：navigate 发送测试（TDD：先写失败测试）。
 *
 * 发送语义（G3→G4 契约 ③ 唯一发送方）：
 * - 合法站内路径 → postMessage({type:'navigate', payload:{path}}) 到推导 origin（http://<hostname>:8080）；
 * - 父窗口不可用 → 静默跳过不抛异常（降级铁律）；
 * - 非站内路径（协议注入/外站）→ 客户端第一道过滤拒绝发送。
 *
 * @module @medai/dsh-feature-guide/client/navigateBridge.test
 */

import { describe, expect, it } from 'vitest'
import { isInternalPath, NAVIGATE_TYPE, resolveTargetOrigin, sendNavigate } from './navigateBridge.js'

interface WindowLike {
  parent: unknown
  postMessage?: (message: unknown, targetOrigin: string) => void
}

describe('G3 navigate 发送 navigateBridge', () => {
  it('sendNavigate_合法path_应postMessage到推导origin', () => {
    const sent: Array<{ message: unknown; origin: string }> = []
    const win = { postMessage: (message: unknown, origin: string) => sent.push({ message, origin }) }
    sendNavigate(win, '/qc/emr-quality', 'http://127.0.0.1:8080')
    expect(sent.length).toBe(1)
    expect(sent[0].message).toEqual({ type: NAVIGATE_TYPE, payload: { path: '/qc/emr-quality' } })
    expect(sent[0].origin).toBe('http://127.0.0.1:8080')
  })

  it('sendNavigate_父窗口不可用_应静默不抛', () => {
    expect(() => sendNavigate(null, '/qc/emr-quality', 'http://127.0.0.1:8080')).not.toThrow()
    expect(() => sendNavigate({} as never, '/qc/emr-quality', 'http://127.0.0.1:8080')).not.toThrow()
  })

  it('sendNavigate_非站内path_应拒绝发送', () => {
    const sent: unknown[] = []
    const win = { postMessage: (message: unknown) => sent.push(message) }
    sendNavigate(win, 'javascript:alert(1)', 'http://127.0.0.1:8080')
    sendNavigate(win, 'https://evil.com/x', 'http://127.0.0.1:8080')
    sendNavigate(win, '//evil.com/x', 'http://127.0.0.1:8080')
    sendNavigate(win, '', 'http://127.0.0.1:8080')
    expect(sent.length).toBe(0)
  })

  it('resolveTargetOrigin_应按hostname推导8080', () => {
    expect(resolveTargetOrigin('127.0.0.1')).toBe('http://127.0.0.1:8080')
    expect(resolveTargetOrigin('100.66.1.3')).toBe('http://100.66.1.3:8080')
  })

  it('isInternalPath_应只接受站内路径', () => {
    expect(isInternalPath('/qc/emr-quality')).toBe(true)
    expect(isInternalPath('/patients')).toBe(true)
    expect(isInternalPath('javascript:alert(1)')).toBe(false)
    expect(isInternalPath('//evil.com')).toBe(false)
    expect(isInternalPath('https://evil.com')).toBe(false)
    expect(isInternalPath('')).toBe(false)
  })

  it('navigate协议类型_应为navigate', () => {
    expect(NAVIGATE_TYPE).toBe('navigate')
  })
})
