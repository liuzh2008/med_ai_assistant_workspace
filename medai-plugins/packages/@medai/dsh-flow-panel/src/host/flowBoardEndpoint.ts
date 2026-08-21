/**
 * flowBoardEndpoint（G3 通道面，TDD 指南 C8）——DSH host HTTP 端点。
 *
 * 职责：client 面板同源取数/取消的中转站（纯中转）：
 *   GET  /medai/flow-board        → 后端 GET  /api/mcp/flow-board（契约①，带凭据）→ 透传 JSON
 *   POST /medai/flow-board/cancel → 后端 POST /api/mcp/flow-board/cancel（契约②）→ 透传 JSON
 *
 * 边界铁律：不渲染、不判业务（能否取消由后端 G2 裁决）、不缓存业务决策；
 * 后端凭据唯一归属本面（getJwt + X-MedAI-Machine-Token 设备头），client 不持有。
 * 失败降级：后端不可达 → 502 结构化错误（无内部细节、无 PII），不抛给 webserver。
 *
 * @module @medai/dsh-flow-panel/host/flowBoardEndpoint
 */

import type { IncomingMessage, ServerResponse } from 'node:http'

/** client 同源端点路径（DSH GUI 3080）。 */
export const FLOW_BOARD_PATH = '/medai/flow-board'
export const FLOW_BOARD_CANCEL_PATH = '/medai/flow-board/cancel'

/** 后端主服务器基址（开发默认 8081；联调可经 options.backendBase 覆盖，对齐 dsh-record-sync）。 */
export const DEFAULT_BACKEND_BASE = 'http://127.0.0.1:8081'

/** X-MedAI-Machine-Token 设备准入静态头（占位；正式值由部署配置下发，对齐 dsh-record-sync）。 */
export const DEFAULT_MACHINE_TOKEN = '<机器token>'

export interface FlowBoardEndpointOptions {
  /** 后端主服务器基址（默认 http://127.0.0.1:8081）。 */
  backendBase?: string
  /** JWT provider（默认包内 credentials.getCredentials；null 不带 Authorization → 网关 401）。 */
  getJwt?: () => string | null
  /** 设备准入静态头值。 */
  machineToken?: string
  /** 测试注入 fetch。 */
  fetchImpl?: typeof fetch
  /**
   * 服务 JWT exchange 配置（cordis config 注入，对齐 mcp-client N4 接线）：
   * 优先于 getJwt（工作站 JWT 未接线时的生产通道）；结果缓存 30 分钟，
   * 收到 401 时清除缓存（下次请求重换）。
   */
  exchange?: { url: string; token: string }
}

/** host 注入面：webServer 路由注册（dsh-session-sync 同构）。 */
export interface FlowBoardEndpointDeps {
  webServer?: {
    register(route: {
      kind: 'exact'
      path: string
      handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
    }): () => void
  }
  logger?: { warn?(message: unknown): void }
}

/** 读取请求体（POST body 透传）。 */
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

/**
 * 创建端点（注册/注销 + 转发逻辑；转发纯函数可测）。
 */
export function createFlowBoardEndpoint(
  deps: FlowBoardEndpointDeps,
  options: FlowBoardEndpointOptions = {},
): { register: () => (() => void) | undefined; forward: (req: IncomingMessage, res: ServerResponse, path: string, method: string, body?: string) => Promise<void> } {
  const backendBase = options.backendBase ?? DEFAULT_BACKEND_BASE
  const getJwt = options.getJwt ?? (() => null)
  const machineToken = options.machineToken ?? DEFAULT_MACHINE_TOKEN
  const fetchImpl = options.fetchImpl ?? globalThis.fetch

  // 服务 JWT 缓存（exchange 通道；TTL 30 分钟；401 时清除重换）
  const JWT_TTL_MS = 30 * 60_000
  let cachedJwt: { value: string; at: number } | null = null

  /** 取 JWT：getJwt() 优先；未提供则走 exchange 换服务 JWT（缓存 TTL）。 */
  async function ensureJwt(): Promise<string | null> {
    const direct = getJwt()
    if (direct) return direct
    if (!options.exchange) return null
    if (cachedJwt && Date.now() - cachedJwt.at < JWT_TTL_MS) return cachedJwt.value
    try {
      const resp = await fetchImpl(options.exchange.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${options.exchange.token}`,
        },
        body: '{}',
      })
      const payload = (await resp.json().catch(() => null)) as { token?: unknown } | null
      if (typeof payload?.token === 'string' && payload.token !== '') {
        cachedJwt = { value: payload.token, at: Date.now() }
        return payload.token
      }
    } catch {
      // exchange 失败 → 降级无凭据（后端 401 透传）
    }
    return null
  }

  /**
   * 转发到后端（带凭据），响应体原样透传；非 2xx 透传状态码；
   * 网络失败/异常 → 502 结构化错误（不泄内部细节）。
   */
  async function forward(
    req: IncomingMessage,
    res: ServerResponse,
    path: string,
    method: string,
    body?: string,
  ): Promise<void> {
    const jwt = await ensureJwt()
    // 设备头值必须为 ASCII（node fetch ByteString 校验；占位/中文值不携带——
    // 服务 JWT 通道对设备准入豁免，实测可过）
    const deviceHeader = /^[\x20-\x7E]*$/.test(machineToken)
      ? { 'X-MedAI-Machine-Token': machineToken }
      : {}
    let response: Response
    try {
      response = await fetchImpl(`${backendBase}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
          ...deviceHeader,
        },
        ...(body !== undefined ? { body } : {}),
      })
    } catch {
      json(res, 502, { code: 'UPSTREAM_UNAVAILABLE', message: '后端服务暂不可用' })
      return
    }
    // 401 且走了 exchange 缓存 → 清缓存（下次请求重换）
    if (response.status === 401 && options.exchange) {
      cachedJwt = null
    }
    let text = ''
    try {
      text = await response.text()
    } catch {
      json(res, 502, { code: 'UPSTREAM_UNREADABLE', message: '后端响应不可读' })
      return
    }
    res.writeHead(response.status, { 'Content-Type': 'application/json' })
    res.end(text)
  }

  /**
   * 注册两端点；返回注销函数（无 webServer 时返回 undefined，插件不崩）。
   */
  function register(): (() => void) | undefined {
    if (!deps.webServer) return undefined
    const disposers: Array<() => void> = []
    try {
      disposers.push(deps.webServer.register({
        kind: 'exact',
        path: FLOW_BOARD_PATH,
        handler: (req, res) => {
          if (req.method !== 'GET') {
            json(res, 405, { code: 'METHOD_NOT_ALLOWED', message: '仅支持 GET' })
            return
          }
          return forward(req, res, '/api/mcp/flow-board', 'GET')
        },
      }))
      disposers.push(deps.webServer.register({
        kind: 'exact',
        path: FLOW_BOARD_CANCEL_PATH,
        handler: async (req, res) => {
          if (req.method !== 'POST') {
            json(res, 405, { code: 'METHOD_NOT_ALLOWED', message: '仅支持 POST' })
            return
          }
          let body = ''
          try {
            body = await readBody(req)
          } catch {
            json(res, 400, { code: 'BODY_UNREADABLE', message: '请求体不可读' })
            return
          }
          return forward(req, res, '/api/mcp/flow-board/cancel', 'POST', body)
        },
      }))
    } catch (error) {
      deps.logger?.warn?.(`dsh-flow-panel: 注册看板端点失败: ${String(error)}`)
    }
    return () => {
      for (const dispose of disposers) dispose()
    }
  }

  return { register, forward }
}
