/**
 * credentials（dsh-record-sync 凭据注入点）。
 *
 * JWT 来源与 @medai/dsh-mcp-client 保持一致（方案 §12 联调校正点：
 * "TS 工具直连的 JWT 来源与 MCP 客户端一致性"）——但 dsh-mcp-client 的
 * index.ts 直接 import `@deepseek-ai/*` peer（DSH 运行时提供，非 npm 发布，
 * pnpm-workspace autoInstallPeers: false），本包无法在 workspace 测试/编译
 * 环境直接 import 其导出。故本包内建同构的最小注入函数：
 *
 *   - 联调时由宿主接线（单一来源）：把登录人 JWT 提供者注入进来，例如
 *     `setCredentials(() => getIdentity()?.jwt ?? null)`（dsh-session-sync
 *     identity 通道），或直接复用 mcp-client 侧已注入的 provider；
 *   - 未接线 → getCredentials() 返回 null → 请求不带 Authorization（网关 401
 *     由结构化错误呈现，不抛内部细节）。
 *
 * 铁律：JWT 仅存模块级内存，不落盘、不进日志/事件/审计（对齐 identity.ts）。
 *
 * @module @medai/dsh-record-sync/credentials
 */

/** 模块级 JWT provider（工作站登录人 JWT；null/登出 → 请求不带 Authorization）。 */
let jwtProvider: (() => string | null) | null = null

/**
 * 设置 JWT provider（联调宿主接线；传 null 清除）。
 * @param provider 返回当前登录人 JWT；null 表示无身份。
 */
export function setCredentials(provider: (() => string | null) | null): void {
  jwtProvider = provider
}

/** 当前 JWT（每请求 getter 调用；无 provider 返回 null）。 */
export function getCredentials(): string | null {
  return jwtProvider ? jwtProvider() : null
}
