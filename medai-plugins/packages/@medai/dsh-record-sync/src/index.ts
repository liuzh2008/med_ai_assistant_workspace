/**
 * @medai/dsh-record-sync host 半（F2b 同步生成 + F3 编排接入，node 插件）。
 *
 * 职责（SoC 铁律：装配层零业务）：
 *   - 注册本地工具 `medai_record_generate_sync`（tool.ts，契约见 §4.2）：
 *     同步等待后端 F2b 端点（≈90s）→ 返回完成状态 + 脱敏摘要 + promptId；
 *     超时优雅降级（TIMEOUT 文案，不抛异常，agent 转 medai_record_status）。
 *   - JWT 来源：包内 credentials 注入点（setCredentials），联调时由宿主接线，
 *     与 @medai/dsh-mcp-client 凭据保持单一来源（方案 §12 联调校正点）。
 *
 * client 半（@medai/dsh-ui-draft-card）承担明文草稿卡片渲染（F4，按 promptId
 * 直连 F2e，明文不进模型上下文/会话日志）。
 *
 * 注意：禁止 export default（对齐官方 tsdown 产物与既有包踩坑：仅命名导出）。
 *
 * @module @medai/dsh-record-sync
 */

import { getCredentials, setCredentials } from './credentials.js'
import { createToolDefinition, type ToolDef, type ToolOptions } from './tool.js'

export const name = '@medai/dsh-record-sync'

/** 服务依赖声明（Cordis 严格代理：未声明 inject 访问 ctx.tools 直接抛错）。 */
export const inject = ['tools']

/** host 插件上下文最小视图（自声明，DSH 运行时验证）。 */
export interface PluginContextLike {
  tools?: {
    register(def: ToolDef): unknown
  }
}

/**
 * 插件装配（host）：注册同步生成工具。
 * @param ctx - cordis 工具注册上下文
 * @param options - 可选配置（端点/机器 token/JWT provider/fetch 注入）
 */
export function apply(ctx: PluginContextLike, options: ToolOptions = {}): void {
  ctx.tools?.register(
    createToolDefinition({
      ...options,
      // 默认走包内凭据注入点；options.getToken 优先（联调接线）
      getToken: options.getToken ?? (() => getCredentials()),
    }),
  )
}

// 供联调宿主接线（JWT 单一来源；与 mcp-client setCredentials 语义对齐）
export { setCredentials, getCredentials }
export { createToolDefinition, TOOL_NAME, TOOL_TIMEOUT_MS } from './tool.js'
export type { SyncGenerateArgs, SyncGenerateResult, ToolOptions } from './tool.js'
