/**
 * preview.tsx —— 流程看板显示预览的渲染逻辑（开发辅助，被 scripts/preview-board.mjs 打包调用）。
 * 样例数据渲染三路 UI + 注入样式，输出可独立打开的 HTML（含亮/暗主题切换按钮）。
 */
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { BoardView } from './BoardTab.js'
import { BadgeView } from './BoardBadge.js'
import { FlowPanel } from './FlowPanel.js'
import { MEDAI_FLOW_STYLES } from './styles.js'

const SAMPLE = {
  counts: { active: 2, done: 1, failed: 1, cancelled: 0 },
  patients: [
    { patientId: 'P1', name: '孙伟', bedNumber: '3', flows: [{ flowId: 'admission-first-mile', currentStep: 'wait-orders-window', status: 'ACTIVE', updatedAt: '2026-08-21 09:12:00' }] },
    { patientId: 'P2', name: '李敏', bedNumber: '5', flows: [{ flowId: 'admission-first-mile', currentStep: 'gen-admission-record', status: 'FAILED', failureReason: '生成超时（>90s）', updatedAt: '2026-08-21 10:00:00' }] },
    { patientId: 'P3', name: '张华', bedNumber: '7', flows: [{ flowId: 'admission-first-mile', currentStep: 'gen-followups', status: 'ACTIVE', updatedAt: '2026-08-21 08:40:00' }, { flowId: 'admission-first-mile', currentStep: '', status: 'DONE', updatedAt: '2026-08-20 16:20:00' }] },
    { patientId: 'P4', name: '王芳', bedNumber: '9', flows: [] },
  ],
}

const TASKS = {
  items: [
    { flowId: 'admission-first-mile', currentStep: 'wait-orders-window', status: 'ACTIVE', updatedAt: '2026-08-21 09:12:00' },
    { flowId: 'admission-first-mile', currentStep: 'gen-admission-record', status: 'FAILED', failureReason: '生成超时', updatedAt: '2026-08-21 10:00:00' },
    { flowId: 'admission-first-mile', currentStep: '', status: 'DONE', updatedAt: '2026-08-20 16:20:00' },
  ],
}

function section(title: string, body: string): string {
  return `<section style="margin: 18px 0 6px; font-size: 15px; font-weight: 700;">${title}</section>${body}`
}

export function renderPreviewHTML(): string {
  const board = renderToString(createElement(BoardView, {
    board: SAMPLE as never, expanded: 'P2', busy: null, notice: null,
    onToggle: () => {}, onCancel: () => {}, onRefresh: () => {},
  }))
  const badgeNormal = renderToString(createElement(BadgeView, { summary: '2 进行中 · 1 失败', alerted: true }))
  const panel = renderToString(createElement(FlowPanel, { env: TASKS }))
  const page = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>流程看板 显示预览</title>
<style>${MEDAI_FLOW_STYLES}</style>
<style>
  body { margin: 0; background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary); font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
  .stage { max-width: 980px; margin: 0 auto; padding: 24px 20px 80px; }
  .theme-switch { position: fixed; right: 20px; top: 20px; z-index: 50; padding: 6px 14px; border-radius: 8px; border: 1px solid var(--dsw-alias-border-l3); background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); cursor: pointer; }
  .board-wrap { height: 560px; overflow: hidden; border: 1px solid var(--dsw-alias-border-l3); border-radius: 12px; background: var(--dsw-alias-bg-base); }
  .mini { max-width: 420px; }
  .note { color: var(--dsw-alias-label-tertiary); font-size: 12px; }
</style>
</head>
<body data-ds-dark-theme>
  <button class="theme-switch" onclick="document.body.toggleAttribute('data-ds-dark-theme')">切换 亮/暗</button>
  <div class="stage">
    <h2 style="margin:0 0 4px;">流程看板（conversation.view）</h2>
    <div class="note">统计卡 · 失败置顶 · 展开明细 · 状态徽章 · 取消按钮（样例数据，P2 已展开）</div>
    <div class="board-wrap">${board}</div>
    ${section('常驻概要角标（shell.overlay，失败告警态）', `<div class="mini">${badgeNormal}</div>`)}
    ${section('流程任务 toolview 卡片', `<div class="mini">${panel}</div>`)}
  </div>
</body>
</html>`
  return page
}
