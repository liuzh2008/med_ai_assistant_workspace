/**
 * @medai/dsh-flow-panel 客户端样式（G4 呈现面）。
 *
 * 统一注入一份 <style data-plugin="@medai/dsh-flow-panel">，覆盖三路 UI：
 *   ① 流程看板 Tab（conversation.view，.medai-board-*）；
 *   ② 常驻概要角标（shell.overlay，.medai-flow-badge-*）；
 *   ③ 流程任务 toolview 卡片（tool.call.toolview，.medai-flow-panel / .medai-flow-task-*）。
 *
 * 颜色一律使用 DSH 主题变量（--dsw-alias-* / --dsw-static-*），亮/暗主题自动适配，
 * 不写死色值。组件不感知样式：类名由 TSX 输出，本文件只负责外观。
 *
 * @module @medai/dsh-flow-panel/client/styles
 */

/** 注入用的 <style data-plugin> 值（与包名一致，纳入 DSH client-modules 样式认领）。 */
export const STYLE_TAG_ID = '@medai/dsh-flow-panel'

/** 完整 CSS 文本（单次注入；幂等由 index.ts 保证）。 */
export const MEDAI_FLOW_STYLES = `
/* ============ ① 流程看板 Tab（conversation.view） ============ */
.medai-board {
  box-sizing: border-box;
  height: 100%;
  overflow-y: auto;
  padding: 16px 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  line-height: 1.5;
}
.medai-board *,
.medai-board *::before,
.medai-board *::after {
  box-sizing: border-box;
}

/* ---- 统计卡（四类计数） ---- */
.medai-board-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  flex: none;
}
.medai-board-stat {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px 14px 11px;
  background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 10px;
  overflow: hidden;
}
.medai-board-stat::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
}
.medai-board-stat.stat-active::before { background: var(--dsw-alias-state-business-primary); }
.medai-board-stat.stat-done::before   { background: var(--dsw-alias-state-success-primary); }
.medai-board-stat.stat-failed::before { background: var(--dsw-alias-state-error-primary); }
.medai-board-stat.stat-cancelled::before { background: var(--dsw-alias-label-tertiary); }
.medai-board-stat-value {
  font-size: 22px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}
.medai-board-stat-label {
  font-size: 12px;
  color: var(--dsw-alias-label-secondary);
}

/* ---- 工具栏（刷新 + 提示） ---- */
.medai-board-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: none;
  min-height: 28px;
}
.medai-board-refresh {
  appearance: none;
  border: 1px solid var(--dsw-alias-border-l3);
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary);
  border-radius: 6px;
  padding: 4px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}
.medai-board-refresh:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
  border-color: var(--dsw-alias-border-l4);
}
.medai-board-notice {
  font-size: 12px;
  color: var(--dsw-alias-state-warn-label);
}

/* ---- 病人卡片列表 ---- */
.medai-board-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1 1 auto;
}
.medai-board-patient {
  background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 10px;
  overflow: hidden;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.medai-board-patient:hover {
  border-color: var(--dsw-alias-border-l4);
}
.medai-board-patient-failed {
  border-color: var(--dsw-alias-state-error-secondary);
  background: var(--dsw-alias-interactive-bg-hover-danger);
}
.medai-board-patient-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 14px;
  cursor: pointer;
  user-select: none;
}
.medai-board-patient-head:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}
.medai-board-bed {
  flex: none;
  min-width: 46px;
  text-align: center;
  padding: 2px 8px;
  border-radius: 6px;
  background: var(--dsw-alias-state-business-tertiary);
  color: var(--dsw-alias-state-business-primary);
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.medai-board-patient-failed .medai-board-bed {
  background: var(--dsw-alias-state-error-secondary);
  color: var(--dsw-alias-state-error-primary);
}
.medai-board-name {
  flex: none;
  font-size: 14px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary);
}
.medai-board-summary {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 12px;
  color: var(--dsw-alias-label-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.medai-board-toggle {
  flex: none;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
}

/* ---- 展开明细 ---- */
.medai-board-detail {
  padding: 0 14px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.medai-board-flow {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  padding: 10px 12px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1);
}
.medai-board-flow-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary);
}
.medai-board-flow-status {
  flex: none;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 12px;
  line-height: 1.6;
  font-weight: 500;
}
.medai-board-flow-active .medai-board-flow-status {
  background: var(--dsw-alias-state-business-tertiary);
  color: var(--dsw-alias-state-business-primary);
}
.medai-board-flow-done .medai-board-flow-status {
  background: var(--dsw-alias-state-success-tertiary);
  color: var(--dsw-alias-state-success-primary);
}
.medai-board-flow-failed .medai-board-flow-status {
  background: var(--dsw-alias-state-error-secondary);
  color: var(--dsw-alias-state-error-primary);
}
.medai-board-flow-cancelled .medai-board-flow-status {
  background: var(--dsw-alias-bg-module-platform);
  color: var(--dsw-alias-label-tertiary);
}
.medai-board-flow-step {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 12px;
  color: var(--dsw-alias-label-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.medai-board-flow-time {
  flex: none;
  font-size: 12px;
  color: var(--dsw-alias-label-tertiary);
  font-variant-numeric: tabular-nums;
}
.medai-board-flow-reason {
  flex-basis: 100%;
  font-size: 12px;
  color: var(--dsw-alias-state-error-primary);
  background: var(--dsw-alias-interactive-bg-hover-danger);
  border-radius: 6px;
  padding: 6px 10px;
  word-break: break-all;
}
.medai-board-cancel {
  flex: none;
  appearance: none;
  border: 1px solid var(--dsw-alias-state-error-secondary);
  background: transparent;
  color: var(--dsw-alias-state-error-primary);
  border-radius: 6px;
  padding: 3px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}
.medai-board-cancel:hover:not(:disabled) {
  background: var(--dsw-alias-state-error-primary);
  color: var(--dsw-alias-label-primary-inverted);
}
.medai-board-cancel:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

/* ---- 空态 ---- */
.medai-board-empty {
  padding: 40px 16px;
  text-align: center;
  color: var(--dsw-alias-label-tertiary);
  font-size: 13px;
  border: 1px dashed var(--dsw-alias-border-l3);
  border-radius: 10px;
}

/* ============ ② 常驻概要角标（shell.overlay） ============ */
.medai-flow-badge {
  position: fixed;
  right: 16px;
  bottom: 72px;
  z-index: 21;
  max-width: 320px;
  padding: 7px 14px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  color: var(--dsw-alias-label-primary-foreground);
  background: var(--dsw-alias-button-contrast-fill);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.24);
  cursor: default;
  user-select: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.medai-flow-badge-alert {
  background: var(--dsw-alias-state-error-primary);
  animation: medai-badge-pulse 2s ease-in-out infinite;
}
@keyframes medai-badge-pulse {
  0%, 100% { box-shadow: 0 4px 16px rgba(0, 0, 0, 0.24); }
  50% { box-shadow: 0 4px 20px var(--dsw-alias-state-error-secondary); }
}
.medai-flow-badge-hidden {
  display: none;
}

/* ============ ③ 流程任务 toolview 卡片 ============ */
.medai-flow-panel {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 2px 0;
  font-size: 12px;
  color: var(--dsw-alias-label-primary);
}
.medai-flow-task-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  padding: 8px 10px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-2);
}
.medai-flow-task-flow {
  font-weight: 600;
  color: var(--dsw-alias-label-primary);
}
.medai-flow-task-step {
  flex: 1 1 auto;
  min-width: 0;
  color: var(--dsw-alias-label-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.medai-flow-task-status {
  flex: none;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 11px;
  line-height: 1.7;
  font-weight: 500;
}
.medai-flow-task-status-active {
  background: var(--dsw-alias-state-business-tertiary);
  color: var(--dsw-alias-state-business-primary);
}
.medai-flow-task-status-done {
  background: var(--dsw-alias-state-success-tertiary);
  color: var(--dsw-alias-state-success-primary);
}
.medai-flow-task-status-failed {
  background: var(--dsw-alias-state-error-secondary);
  color: var(--dsw-alias-state-error-primary);
}
.medai-flow-task-status-cancelled {
  background: var(--dsw-alias-bg-module-platform);
  color: var(--dsw-alias-label-tertiary);
}
.medai-flow-task-reason {
  flex-basis: 100%;
  color: var(--dsw-alias-state-error-primary);
  word-break: break-all;
}
.medai-flow-task-time {
  flex-basis: 100%;
  color: var(--dsw-alias-label-tertiary);
  font-variant-numeric: tabular-nums;
}
`
