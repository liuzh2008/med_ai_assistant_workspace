/**
 * dynamicHeaders（A2 fork）——每请求动态 JWT 头（零外部依赖，纯函数可单测）。
 *
 * MCP SDK 的 StreamableHTTPClientTransport 每请求执行 normalizeHeaders
 * （{...headers} 展开），读取可枚举 getter → **每请求求值**（spike S2 确认），
 * 实现"工作站登录人 JWT 每请求动态注入"；STATELESS 网关无会话表，
 * 换人仅 JWT 头变化，无需重建连接。
 *
 * @module @medai/dsh-mcp-client/dynamicHeaders
 */

/** 每请求动态头选项。 */
export interface DynamicHeadersOptions {
  /** 静态头（配置：X-MedAI-Machine-Token 等）。 */
  staticHeaders: Record<string, string>
  /** 每请求 JWT 提供者（null/undefined → 回退静态 Authorization，兼容过渡）。 */
  getJwt?: () => string | null
}

/**
 * 动态头对象：静态头 + 可枚举 Authorization getter。
 * JWT 为空时回退静态 Authorization（旧每机 token 过渡形态）。
 */
export function buildDynamicHeaders(opts: DynamicHeadersOptions): Record<string, string> {
  const headers: Record<string, string> = { ...opts.staticHeaders }
  if (opts.getJwt) {
    Object.defineProperty(headers, 'Authorization', {
      enumerable: true,
      configurable: true,
      get(): string {
        const jwt = opts.getJwt?.()
        if (jwt) return `Bearer ${jwt}`
        return opts.staticHeaders.Authorization ?? ''
      },
    })
  }
  return headers
}
