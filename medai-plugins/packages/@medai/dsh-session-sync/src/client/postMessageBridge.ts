/**
 * postMessageBridge（P6-A1）——DSH 侧（client bundle）工作站 ⇄ DSH 消息桥。
 *
 * 与工作站侧 {@code PatientContextBridge}（N1，P6-C2）对称：
 * - 入站（工作站 → DSH）：identity / patient-select / pre-logout / ping
 * - 出站（DSH → 工作站）：pong / logout-ready / assistant-unavailable
 * - 消息格式 {@code {type, payload}}；origin 白名单双向校验（伪造来源静默丢弃）。
 *
 * 纯逻辑（parseInbound / isAllowedOrigin）可独立单测；浏览器接线
 * （window message 监听）经注入的 {@code windowLike} 可测。
 *
 * @module @medai/dsh-session-sync/client/postMessageBridge
 */

/** 消息类型白名单（协议唯一事实源，与 N1 MESSAGE_TYPES 对齐）。 */
export const MESSAGE_TYPES = {
  IDENTITY: 'identity',
  PATIENT_SELECT: 'patient-select',
  PRE_LOGOUT: 'pre-logout',
  PING: 'ping',
  PONG: 'pong',
  LOGOUT_READY: 'logout-ready',
  ASSISTANT_UNAVAILABLE: 'assistant-unavailable',
} as const

export type MessageType = (typeof MESSAGE_TYPES)[keyof typeof MESSAGE_TYPES]

const TYPE_SET: ReadonlySet<string> = new Set(Object.values(MESSAGE_TYPES))

/** 工作站注入的身份（N1 发送，JWT 仅内存持有）。 */
export interface IdentityPayload {
  jwt: string
  doctorName: string
  departmentName: string
}

/** 患者联动（N1 组装 contextKey 下发，医疗语义不落地 N2）。 */
export interface PatientSelectPayload {
  patientId: string
  patientLabel: string
  contextKey: string
  inHospital: boolean
}

/** 入站消息（解析后的结构化视图）。 */
export interface InboundMessage<P = unknown> {
  type: string
  payload?: P
}

/** 出站消息。 */
export interface OutboundMessage<P = unknown> {
  type: string
  payload?: P
}

/** 桥处理器（按类型分发；异常由调用方兜底，不中断其他消息）。 */
export interface BridgeHandlers {
  onIdentity(payload: IdentityPayload): void | Promise<void>
  onPatientSelect(payload: PatientSelectPayload): void | Promise<void>
  onPreLogout(payload?: unknown): void | Promise<void>
  onPing(payload?: unknown): void | Promise<void>
}

export interface WindowLike {
  addEventListener(type: 'message', listener: (event: MessageEventLike) => void): void
  removeEventListener(type: 'message', listener: (event: MessageEventLike) => void): void
}

export interface MessageEventLike {
  origin: string
  data: unknown
}

export interface PostMessageBridgeOptions {
  /** 允许的发送方 origin 白名单（工作站页面 origin）。 */
  allowedOrigins: readonly string[]
  /** 出站消息发送目标（工作站页面）；传函数时每次 send 求值（适配挂载时机）。 */
  targetWindow: WindowLike & { postMessage(message: OutboundMessage, targetOrigin: string): void } | (() => (WindowLike & { postMessage(message: OutboundMessage, targetOrigin: string): void }) | null)
  /** 出站 targetOrigin（工作站 origin）。 */
  targetOrigin: string
  handlers: BridgeHandlers
  /** 浏览器 window（注入可测）。 */
  windowLike?: WindowLike
}

export interface PostMessageBridge {
  handleMessage(event: MessageEventLike): void
  send(type: string, payload?: unknown): void
  dispose(): void
}

/**
 * 解析入站消息（纯函数）：格式校验（{type, payload}）+ 类型白名单；非法返回 null。
 */
export function parseInbound(data: unknown): InboundMessage | null {
  if (data === null || typeof data !== 'object') return null
  const msg = data as { type?: unknown; payload?: unknown }
  if (typeof msg.type !== 'string' || !TYPE_SET.has(msg.type)) return null
  return { type: msg.type, payload: msg.payload as InboundMessage['payload'] }
}

/**
 * origin 校验（纯函数）：来源在白名单内才接收。
 */
export function isAllowedOrigin(origin: string, allowedOrigins: readonly string[]): boolean {
  return allowedOrigins.includes(origin)
}

/** 出站消息类型是否合法（send 前校验，非法抛错——开发期即暴露协议漂移）。 */
export function isOutboundType(type: string): boolean {
  return TYPE_SET.has(type)
}

/**
 * 创建桥（浏览器接线）：window message 监听 → origin 校验 → 解析 → 按 type 分发；
 * send 向工作站回执（pong / logout-ready / assistant-unavailable）。
 */
export function createPostMessageBridge(opts: PostMessageBridgeOptions): PostMessageBridge {
  const origins = new Set(opts.allowedOrigins)

  function resolveTarget(): (WindowLike & { postMessage(message: OutboundMessage, targetOrigin: string): void }) | null {
    const t = typeof opts.targetWindow === 'function' ? opts.targetWindow() : opts.targetWindow
    return t ?? null
  }

  function send(type: string, payload?: unknown): void {
    if (!isOutboundType(type)) throw new Error(`unknown message type: ${type}`)
    const target = resolveTarget()
    if (!target || typeof target.postMessage !== 'function') return // 目标不可用静默跳过（对齐 N1）
    target.postMessage({ type, payload } as OutboundMessage, opts.targetOrigin)
  }

  async function handleMessage(event: MessageEventLike): Promise<void> {
    if (!event || !isAllowedOrigin(event.origin, [...origins])) return
    const message = parseInbound(event.data)
    if (message === null) return
    try {
      switch (message.type) {
        case MESSAGE_TYPES.IDENTITY:
          await opts.handlers.onIdentity(message.payload as IdentityPayload)
          break
        case MESSAGE_TYPES.PATIENT_SELECT:
          await opts.handlers.onPatientSelect(message.payload as PatientSelectPayload)
          break
        case MESSAGE_TYPES.PRE_LOGOUT:
          await opts.handlers.onPreLogout(message.payload)
          break
        case MESSAGE_TYPES.PING:
          await opts.handlers.onPing(message.payload)
          break
        default:
          break
      }
    } catch {
      // 处理器异常不中断桥（降级铁律：N3 全挂对话照常）
    }
  }

  const listener = (event: MessageEventLike): void => {
    void handleMessage(event)
  }

  opts.windowLike?.addEventListener('message', listener)

  return {
    handleMessage: (event: MessageEventLike): void => {
      void handleMessage(event)
    },
    send,
    dispose: () => {
      opts.windowLike?.removeEventListener('message', listener)
    },
  }
}
