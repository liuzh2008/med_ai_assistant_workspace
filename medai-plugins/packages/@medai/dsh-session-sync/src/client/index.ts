/**
 * @medai/dsh-session-sync client 半（P6-C5 占位，browser bundle）。
 *
 * 职责（按实现方案 §4.1，P6-C6+ 逐项落地）：
 *   - postMessage 上下文接收（identity / patient-select / pre-logout）
 *   - 会话分治 sessionMap / 患者上下文注入 patientContextInject
 *   - 事件同步 syncEngine（掩码 → 缓冲 → 推送 → watermark）
 *   - 三层清理 cleaner（登出 flush / 出院·转科 / 定时兜底）
 * P6-C5 先交付纯逻辑 `identity.ts`（身份内存持有，US-N2-01），
 * 消息接线在 postMessageBridge 落地后挂入 apply。
 */

export const name = '@medai/dsh-session-sync'

/** 占位：消息/事件接线在 P6-C6+ 挂载。 */
export function apply(): void {}

// 注意：禁止 export default。vendor/loader 的 unwrapExports 优先取
// `exports.default ?? exports`，default 存在时会拿到裸 apply 函数，
// 导致 Cordis 激活失败（对齐官方 tsdown 产物：仅命名导出）。
