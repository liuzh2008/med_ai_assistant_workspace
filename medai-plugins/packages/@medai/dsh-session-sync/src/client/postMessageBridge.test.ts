import { describe, expect, it, vi } from 'vitest'
import {
  createPostMessageBridge,
  isAllowedOrigin,
  MESSAGE_TYPES,
  parseInbound,
  type BridgeHandlers,
  type MessageEventLike,
  type WindowLike,
} from './postMessageBridge'

const WS_ORIGIN = 'http://127.0.0.1:8080'

interface FakeWindow extends WindowLike {
  postMessage(msg: unknown, origin: string): void
  __listeners: Array<(e: MessageEventLike) => void>
  __sent: Array<{ msg: unknown; origin: string }>
}

function fakeWindow(): FakeWindow {
  const listeners: Array<(e: MessageEventLike) => void> = []
  const sent: Array<{ msg: unknown; origin: string }> = []
  const win = {
    addEventListener: (_type: string, listener: (e: MessageEventLike) => void) => { listeners.push(listener) },
    removeEventListener: (_type: string, listener: (e: MessageEventLike) => void) => {
      const i = listeners.indexOf(listener)
      if (i >= 0) listeners.splice(i, 1)
    },
    postMessage: (msg: unknown, origin: string) => { sent.push({ msg, origin }) },
  }
  return Object.assign(win, { __listeners: listeners, __sent: sent }) as FakeWindow
}

function noopHandlers(): BridgeHandlers {
  return {
    onIdentity: vi.fn(),
    onPatientSelect: vi.fn(),
    onPreLogout: vi.fn(),
    onPing: vi.fn(),
  }
}

describe('parseInbound 消息解析', () => {
  it('合法 {type,payload} 按类型白名单解析', () => {
    expect(parseInbound({ type: MESSAGE_TYPES.PING })).toEqual({ type: 'ping', payload: undefined })
    expect(parseInbound({ type: MESSAGE_TYPES.PATIENT_SELECT, payload: { patientId: 'P1' } }))
      .toEqual({ type: 'patient-select', payload: { patientId: 'P1' } })
  })

  it('非法输入返回 null（非对象 / 缺 type / 未知 type）', () => {
    expect(parseInbound(null)).toBeNull()
    expect(parseInbound('ping')).toBeNull()
    expect(parseInbound({})).toBeNull()
    expect(parseInbound({ type: 'evil-type' })).toBeNull()
  })
})

describe('isAllowedOrigin origin 白名单', () => {
  it('白名单内放行，白名单外拒绝', () => {
    expect(isAllowedOrigin(WS_ORIGIN, [WS_ORIGIN])).toBe(true)
    expect(isAllowedOrigin('http://evil.example.com', [WS_ORIGIN])).toBe(false)
  })
})

describe('createPostMessageBridge 分发', () => {
  it('白名单来源 + 合法类型 → 分发给对应 handler', () => {
    const win = fakeWindow()
    const handlers = noopHandlers()
    const bridge = createPostMessageBridge({
      allowedOrigins: [WS_ORIGIN],
      targetOrigin: WS_ORIGIN,
      targetWindow: () => win as never,
      handlers,
      windowLike: win,
    })

    win.__listeners[0]({ origin: WS_ORIGIN, data: { type: MESSAGE_TYPES.IDENTITY, payload: { jwt: 'j' } } })
    win.__listeners[0]({ origin: WS_ORIGIN, data: { type: MESSAGE_TYPES.PING } })

    expect(handlers.onIdentity).toHaveBeenCalledWith({ jwt: 'j' })
    expect(handlers.onPing).toHaveBeenCalled()
    expect(handlers.onPreLogout).not.toHaveBeenCalled()
    bridge.dispose()
  })

  it('未知来源消息静默丢弃（handler 不被调用）', () => {
    const win = fakeWindow()
    const handlers = noopHandlers()
    createPostMessageBridge({
      allowedOrigins: [WS_ORIGIN],
      targetOrigin: WS_ORIGIN,
      targetWindow: () => win as never,
      handlers,
      windowLike: win,
    })

    win.__listeners[0]({ origin: 'http://evil.example.com', data: { type: MESSAGE_TYPES.PING } })

    expect(handlers.onPing).not.toHaveBeenCalled()
  })

  it('handler 异常不中断桥（降级铁律）', () => {
    const win = fakeWindow()
    const handlers = noopHandlers()
    ;(handlers.onIdentity as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'))
    const bridge = createPostMessageBridge({
      allowedOrigins: [WS_ORIGIN],
      targetOrigin: WS_ORIGIN,
      targetWindow: () => win as never,
      handlers,
      windowLike: win,
    })

    win.__listeners[0]({ origin: WS_ORIGIN, data: { type: MESSAGE_TYPES.IDENTITY, payload: { jwt: 'j' } } })
    win.__listeners[0]({ origin: WS_ORIGIN, data: { type: MESSAGE_TYPES.PING } })

    expect(handlers.onPing).toHaveBeenCalled()
    bridge.dispose()
  })

  it('send 向工作站发送类型化消息（含 targetOrigin）', () => {
    const win = fakeWindow()
    const bridge = createPostMessageBridge({
      allowedOrigins: [WS_ORIGIN],
      targetOrigin: WS_ORIGIN,
      targetWindow: () => win as never,
      handlers: noopHandlers(),
      windowLike: win,
    })

    bridge.send(MESSAGE_TYPES.PONG, { ok: true })

    expect(win.__sent).toHaveLength(1)
    expect(win.__sent[0]).toEqual({ msg: { type: 'pong', payload: { ok: true } }, origin: WS_ORIGIN })
    bridge.dispose()
  })

  it('send 未知类型抛错；目标不可用时静默跳过', () => {
    const win = fakeWindow()
    const bridge = createPostMessageBridge({
      allowedOrigins: [WS_ORIGIN],
      targetOrigin: WS_ORIGIN,
      targetWindow: () => null as never, // 目标不可用
      handlers: noopHandlers(),
      windowLike: win,
    })

    expect(() => bridge.send('nope')).toThrow('unknown message type')
    expect(() => bridge.send(MESSAGE_TYPES.PONG)).not.toThrow()
    bridge.dispose()
  })
})
