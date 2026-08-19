/**
 * F2e 明文草稿取数（纯函数，T2.5 卡片数据通道）。
 *
 * 卡片按 promptId 直连后端明文端点 `GET /api/mcp/draft/{promptId}`，
 * 带 JWT（Authorization: Bearer）。明文只进卡片渲染，不进模型上下文/
 * 会话日志——本模块只返回取数结果给渲染层，无任何消息发送通道。
 *
 * JWT 来源：本包内建模块级注入点（setCredentials），联调时由宿主接线到
 * dsh-session-sync identity 通道（与 MCP 通道同源单凭据）；
 * 401 → 渲染"无权限查看草稿"（权限裁决唯一归属 F2 网关）。
 *
 * 铁律：本模块禁止 console.log 明文内容；禁止把明文写入任何日志/存储。
 *
 * @module @medai/dsh-ui-draft-card/client/draftApi
 */

/** 明文端点（主服务器；可经 options.baseUrl 覆盖）。 */
export const DRAFT_ENDPOINT_BASE = 'http://127.0.0.1:8081/api/mcp/draft'

/** 取数结果（kind 驱动卡片渲染分支）。 */
export type DraftFetchResult =
  | { kind: 'ok'; text: string }
  | { kind: 'unauthorized'; status: number }
  | { kind: 'error'; status?: number }

/** 取数选项（测试注入 jwt/fetch/端点）。 */
export interface DraftFetchOptions {
  /** JWT（缺省走包内注入点 getCredentials）。 */
  jwt?: string
  /** 测试注入 fetch。 */
  fetchImpl?: typeof fetch
  /** 明文端点（默认 DRAFT_ENDPOINT_BASE）。 */
  baseUrl?: string
}

/** 模块级 JWT provider（浏览器内存持有；联调宿主接线）。 */
let jwtProvider: (() => string | null) | null = null

/** 设置 JWT provider（联调宿主接线；传 null 清除）。 */
export function setCredentials(provider: (() => string | null) | null): void {
  jwtProvider = provider
}

/** 当前 JWT（无 provider 返回 null）。 */
export function getCredentials(): string | null {
  return jwtProvider ? jwtProvider() : null
}

/**
 * 按 promptId 取明文草稿。
 * - 2xx → { kind: 'ok', text }；
 * - 401/403 → { kind: 'unauthorized', status }；
 * - 其他非 2xx / 网络失败 → { kind: 'error' }（不抛异常，卡片降级文案）。
 */
export async function fetchDraft(promptId: string, options: DraftFetchOptions = {}): Promise<DraftFetchResult> {
  const base = options.baseUrl ?? DRAFT_ENDPOINT_BASE
  const jwt = options.jwt ?? getCredentials()
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  const url = `${base}/${encodeURIComponent(promptId)}`

  let response: Response
  try {
    response = await fetchImpl(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      },
    })
  } catch {
    return { kind: 'error' }
  }

  if (response.status === 401 || response.status === 403) {
    return { kind: 'unauthorized', status: response.status }
  }
  if (!response.ok) {
    return { kind: 'error', status: response.status }
  }

  // 明文端点返回体：{ content: '明文草稿...' }（JSON）；解析失败按错误处理
  try {
    const payload = (await response.json()) as { content?: unknown }
    if (typeof payload.content === 'string' && payload.content !== '') {
      return { kind: 'ok', text: payload.content }
    }
    return { kind: 'error', status: response.status }
  } catch {
    return { kind: 'error', status: response.status }
  }
}
