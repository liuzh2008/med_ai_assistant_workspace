/**
 * BoardBadge（G4 呈现面：shell.overlay 常驻概要角标，TDD 指南 C10）。
 *
 * 全局浮层（root scope，任何界面可见）——渲染「3 进行中 · 1 失败」概要；
 * failed>0 红色高亮；全零/后端不可达 → 隐藏（零崩溃）。
 * BadgeView 为纯渲染（可测）；数据经 useBoardData（G3 通道）获取，不判业务。
 *
 * @module @medai/dsh-flow-panel/client/BoardBadge
 */

import { createElement, type ReactElement } from 'react'
import { buildSummary, isAlerted } from '../boardModel.js'
import { useBoardData } from './useBoardData.js'

/** 纯渲染视图（summary=null → 隐藏占位，不占布局）。 */
export function BadgeView({ summary, alerted }: { summary: string | null; alerted: boolean }): ReactElement {
  if (summary === null) {
    return createElement('div', { className: 'medai-flow-badge medai-flow-badge-hidden' })
  }
  return createElement(
    'div',
    {
      className: `medai-flow-badge${alerted ? ' medai-flow-badge-alert' : ''}`,
      title: '病人工作流概要（点击助手内「流程看板」查看详情）',
    },
    summary,
  )
}

export function BoardBadge(): ReactElement {
  const { data } = useBoardData(30_000)
  return createElement(BadgeView, { summary: buildSummary(data), alerted: isAlerted(data) })
}
