/**
 * credentials（dsh-flow-panel 凭据注入点，G3 通道面）。
 *
 * JWT 来源与 @medai/dsh-mcp-client / @medai/dsh-record-sync 同构（模块级注入，
 * 避免在 workspace 测试/编译环境直接 import @deepseek-ai/* peer）：
 *   - 联调时由宿主接线（单一来源）：`setCredentials(() => getIdentity()?.jwt ?? null)`
 *     或复用 mcp-client 侧已注入的 provider；
 *   - 未接线 → getCredentials() 返回 null → 转发请求不带 Authorization（后端 401）。
 *
 * 铁律：JWT 仅存模块级内存，不落盘、不进日志/事件（对齐 dsh-record-sync credentials）。
 *
 * @module @medai/dsh-flow-panel/credentials
 */

/** 模块级 JWT provider（工作站登录人 JWT；null/登出 → 请求不带 Authorization）。 */
let jwtProvider: (() => string | null) | null = null

/** 设置 JWT provider（联调宿主接线；传 null 清除）。 */
export function setCredentials(provider: (() => string | null) | null): void {
  jwtProvider = provider
}

/** 当前 JWT（每请求 getter 调用；无 provider 返回 null）。 */
export function getCredentials(): string | null {
  return jwtProvider ? jwtProvider() : null
}
