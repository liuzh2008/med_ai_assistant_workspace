/**
 * serviceJwt（N4 接线，2026-08-17）——每机 token → /mcp/auth/exchange → 服务 JWT 的动态 provider。
 *
 * DSH 独立 GUI（无工作站登录态）接入后端 N4 双因子：Authorization 需携带**服务 JWT**
 * （后端独立密钥签发，见 McpAuthExchangeController），而非每机 token。本模块在连接生命周期内：
 *   1. 创建即用每机 token 调 exchange 换取服务 JWT；
 *   2. 缓存并提供 {@link getJwt}（transport 每请求动态头调用）；
 *   3. 在 expiresAt 前 {@link ttlBufferMs} 提前刷新（失败保留旧 JWT、退避重试，不阻断主链路）。
 *
 * 纯逻辑可单测：fetch 与定时器均可注入。
 *
 * @module @medai/dsh-mcp-client/serviceJwt
 */

/** 服务 JWT provider 选项。 */
export interface ServiceJwtOptions {
  /** exchange 端点（如 http://127.0.0.1:8081/mcp/auth/exchange）。 */
  exchangeUrl: string
  /** 每机 token（Bearer 携带，换取服务 JWT）。 */
  token: string
  /** 过期前提前刷新缓冲（默认 60s）。 */
  ttlBufferMs?: number
  /** fetch 实现（测试注入）。 */
  fetchImpl?: typeof fetch
  /** 定时器实现（测试注入）。 */
  setTimeoutImpl?: (fn: () => void, ms: number) => NodeJS.Timeout
  /** 清除定时器实现（测试注入）。 */
  clearTimeoutImpl?: (id: NodeJS.Timeout) => void
}

/** 服务 JWT provider 句柄。 */
export interface ServiceJwtProvider {
  /** 当前服务 JWT（未换取成功返回 null，transport 回退静态头）。 */
  getJwt(): string | null
  /** 停止刷新并释放定时器。 */
  dispose(): void
}

/** exchange 失败后的重试退避（固定 30s；不阻塞连接主链路）。 */
const REFRESH_RETRY_MS = 30_000

/**
 * 创建服务 JWT provider：启动即 exchange，到期前自动刷新。
 *
 * @param opts 选项（fetch 与定时器可注入，便于单测）
 */
export function createServiceJwtProvider(opts: ServiceJwtOptions): ServiceJwtProvider {
  const bufferMs = opts.ttlBufferMs ?? 60_000
  const fetchImpl = opts.fetchImpl ?? fetch
  const scheduleTimer = opts.setTimeoutImpl ?? ((fn: () => void, ms: number) => setTimeout(fn, ms))
  const clearTimer = opts.clearTimeoutImpl ?? ((id: NodeJS.Timeout) => clearTimeout(id))

  let jwt: string | null = null
  let expiresAtMs = 0
  let refreshTimer: NodeJS.Timeout | undefined
  let disposed = false
  let inflight: Promise<void> | null = null

  function scheduleRefresh(delayMs?: number): void {
    if (disposed) return
    const ms = delayMs ?? Math.max(expiresAtMs - Date.now() - bufferMs, 5_000)
    refreshTimer = scheduleTimer(() => void refresh(), ms)
    if (refreshTimer?.unref !== undefined) refreshTimer.unref()
  }

  async function refresh(): Promise<void> {
    if (disposed || inflight !== null) return
    inflight = (async () => {
      const res = await fetchImpl(opts.exchangeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opts.token}` },
      })
      if (!res.ok) throw new Error(`service JWT exchange failed: HTTP ${res.status}`)
      const body = (await res.json()) as { token?: string; expiresAt?: string }
      if (!body.token) throw new Error('service JWT exchange response missing token')
      jwt = body.token
      const ttlMs = body.expiresAt ? Date.parse(body.expiresAt) - Date.now() : 24 * 3600_000
      expiresAtMs = Date.now() + Math.max(ttlMs, 0)
      scheduleRefresh()
    })().catch(() => {
      // 换取失败：保留旧 JWT（若存在），退避重试，不阻断 MCP 连接主链路
      if (!disposed) scheduleRefresh(REFRESH_RETRY_MS)
    }).finally(() => {
      inflight = null
    })
    await inflight
  }

  void refresh()

  return {
    getJwt: () => jwt,
    dispose: () => {
      disposed = true
      if (refreshTimer !== undefined) {
        clearTimer(refreshTimer)
        refreshTimer = undefined
      }
    },
  }
}
