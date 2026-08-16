/**
 * @medai/dsh-session-sync host 入口（P6-C5）。
 *
 * 浏览器逻辑在 `src/client/`（client bundle，`exports["./client"]`），
 * 服务端激活（node half）无需任何行为：host 进程无消息/事件服务，
 * 且 Cordis 严格代理下访问未 inject 的属性直接抛错（cannot get property without inject），
 * 故此处必须为 no-op（对齐官方 client 插件与 @medai/dsh-ui-report-card 的 host 半）。
 */

export const name = '@medai/dsh-session-sync'

/** Provides no host-side behavior. */
export function apply(): void {}
