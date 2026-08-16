/**
 * @medai/dsh-ui-report-card host 入口（P6-C13）。
 *
 * 浏览器渲染逻辑在 `src/client/`（client bundle，`exports["./client"]`），
 * 服务端激活（node half）无需任何行为：host 进程无 slots 服务，
 * 且 Cordis 严格代理下访问未 inject 的属性直接抛错（cannot get property without inject），
 * 故此处必须为 no-op（对齐官方 client 插件 `ui-tool`/`ui-file-browser` 的 host 半）。
 */

export const name = '@medai/dsh-ui-report-card'

/** Provides no host-side behavior. */
export function apply(): void {}
