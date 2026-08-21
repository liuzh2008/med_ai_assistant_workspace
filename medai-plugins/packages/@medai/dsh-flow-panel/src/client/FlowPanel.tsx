/**
 * 流程任务面板组件（React 渲染薄壳，TDD 指南 T4.3）。
 *
 * 视图模型由 `../model.js` 纯函数构建；组件只渲染（进度/状态/失败原因/更新时间），
 * 明文与业务判断不进组件。折叠行摘要：进行中显示步骤，失败显示原因。
 *
 * @module @medai/dsh-flow-panel/client/FlowPanel
 */

import { createElement, type ReactElement } from 'react'
import { buildPanelModel, type FlowTaskView } from '../model.js'

export function summaryOf(env: unknown): string {
  const model = buildPanelModel(env)
  if (model.empty) return '暂无流程任务'
  const first = model.tasks[0]
  if (first.failureReason) return `${first.flowId}：${first.statusLabel}（${first.failureReason}）`
  return `${first.flowId}：${first.stepLabel}`
}

export function TaskRow({ task }: { task: FlowTaskView }): ReactElement {
  return createElement(
    'div',
    { className: 'medai-flow-task-row' },
    createElement('span', { className: 'medai-flow-task-flow' }, task.flowId),
    createElement('span', { className: 'medai-flow-task-step' }, task.stepLabel),
    createElement('span', { className: `medai-flow-task-status medai-flow-task-status-${task.status.toLowerCase()}` }, task.statusLabel),
    task.failureReason ? createElement('div', { className: 'medai-flow-task-reason' }, `原因：${task.failureReason}`) : null,
    task.updatedAt ? createElement('div', { className: 'medai-flow-task-time' }, task.updatedAt) : null,
  )
}

export function FlowPanel({ env }: { env: unknown }): ReactElement {
  const model = buildPanelModel(env)
  if (model.empty) {
    return createElement('div', { className: 'medai-flow-panel' }, '暂无流程任务')
  }
  return createElement(
    'div',
    { className: 'medai-flow-panel' },
    model.tasks.map((task, idx) => createElement(TaskRow, { key: idx, task })),
  )
}
