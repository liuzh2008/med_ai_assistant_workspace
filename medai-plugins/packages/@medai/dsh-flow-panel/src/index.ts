/**
 * @medai/dsh-flow-panel host 半（G3 通道面，TDD 指南 C8）。
 *
 * 服务端（node）激活：经 `ctx.webServer.register` 注册两个**同源** HTTP 端点
 * （DSH GUI 3080）——GET/POST /medai/flow-board，转发后端 `/api/mcp/flow-board`
 * （契约①/②），附加凭据。纯中转：不渲染、不判业务、不缓存业务决策。
 *
 * 凭据（对齐 mcp-client N4 接线）：
 *   - cordis config 注入 `exchangeToken`（每机 token）→ host 经 /mcp/auth/exchange
 *     换服务 JWT（缓存 30 分钟，401 清缓存重换）——生产通道；
 *   - 未配置 exchangeToken → 包内 credentials.getCredentials()（工作站 JWT 联调接线）；
 *   - 两者皆无 → 不带 Authorization（后端 401 透传，不泄内部细节）。
 *
 * 无 webServer（headless 等）时注册跳过，插件不崩。
 */

import { createFlowBoardEndpoint } from './host/flowBoardEndpoint.js'
import { getCredentials } from './credentials.js'

export const name = '@medai/dsh-flow-panel'

/** host 插件服务依赖：webServer（DSH HTTP 路由注册；headless 等无 web 场景跳过）。 */
export const inject = ['webServer']

/** host 插件上下文（webServer 路由 + logger）。 */
export interface HostContext {
  webServer?: {
    register(route: {
      kind: 'exact' | 'prefix'
      path: string
      handler: (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => void | Promise<void>
    }): () => void
  }
  logger?: { warn?(message: unknown): void }
}

/** cordis config（cordis.patch.yml 注入，对齐 mcp-medai 的 exchangeToken 接线）。 */
export interface FlowPanelHostOptions {
  /** 后端主服务器基址（默认 http://127.0.0.1:8081）。 */
  backendBase?: string
  /** 每机 token（经 exchange 换服务 JWT；生产通道，未配置时回退 getCredentials）。 */
  exchangeToken?: string
  /** exchange 端点（默认 {backendBase}/mcp/auth/exchange）。 */
  exchangeUrl?: string
  /** 设备准入静态头值（默认占位不携带，服务 JWT 通道豁免设备准入）。 */
  machineToken?: string
}

/** 服务端激活：注册看板同源端点（凭据=exchange 服务 JWT 或包内 credentials）。 */
export function apply(ctx: HostContext, options: FlowPanelHostOptions = {}): void {
  const exchange = options.exchangeToken
    ? {
      url: options.exchangeUrl ?? `${options.backendBase ?? 'http://127.0.0.1:8081'}/mcp/auth/exchange`,
      token: options.exchangeToken,
    }
    : undefined
  const endpoint = createFlowBoardEndpoint(ctx, {
    backendBase: options.backendBase,
    exchange,
    getJwt: () => getCredentials(),
    machineToken: options.machineToken,
  })
  const dispose = endpoint.register()
  ;(apply as unknown as { __dispose?: () => void }).__dispose = () => {
    if (dispose) dispose()
  }
}
