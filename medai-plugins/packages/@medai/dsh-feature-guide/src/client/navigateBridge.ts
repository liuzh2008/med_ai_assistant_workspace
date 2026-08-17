/**
 * G3-C3 navigate 发送（契约 ③ DSH→工作站唯一发送方，纯函数可测）。
 *
 * 安全：客户端第一道过滤（仅站内路径）；父窗口不可用静默跳过（降级铁律）。
 * G4 工作站侧二次校验（origin 白名单 + 路径白名单）——双层防御。
 *
 * @module @medai/dsh-feature-guide/client/navigateBridge
 */

/** navigate 消息类型（契约 ③；与工作站 PatientContextBridge MESSAGE_TYPES 对称）。 */
export const NAVIGATE_TYPE = 'navigate'

/** 出站消息最小窗口视图。 */
export interface PostMessageWindowLike {
  postMessage?: (message: unknown, targetOrigin: string) => void
}

/** 工作站 origin 推导（DSH GUI 嵌在 http://<hostname>:8080 工作站内）。 */
export function resolveTargetOrigin(hostname: string): string {
  return `http://${hostname}:8080`
}

/**
 * 站内路径校验：`/` 开头、非 `//`（协议相对）、不含 `://`（协议注入）。
 */
export function isInternalPath(path: unknown): path is string {
  return typeof path === 'string'
    && path.startsWith('/')
    && !path.startsWith('//')
    && !path.includes('://')
}

/**
 * 发送 navigate（契约 ③）：非法路径拒绝；目标不可用/发送异常静默跳过。
 * @param win - 父窗口（工作站页面）；null 表示未嵌入工作站
 * @param path - 目标站内路由
 * @param targetOrigin - 工作站 origin（resolveTargetOrigin 推导）
 */
export function sendNavigate(
  win: PostMessageWindowLike | null | undefined,
  path: string,
  targetOrigin: string,
): void {
  if (!isInternalPath(path)) return
  if (!win || typeof win.postMessage !== 'function') return
  try {
    win.postMessage({ type: NAVIGATE_TYPE, payload: { path } }, targetOrigin)
  } catch {
    // 静默降级（目标不可用不阻塞对话）
  }
}

/** 浏览器默认发送入口（卡片按钮 onClick 使用）。 */
export function sendNavigateFromBrowser(path: string): void {
  const parent = typeof window !== 'undefined' ? window.parent : null
  const hostname = typeof window !== 'undefined' && window.location ? window.location.hostname : '127.0.0.1'
  sendNavigate(parent as PostMessageWindowLike | null, path, resolveTargetOrigin(hostname))
}
