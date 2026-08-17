/**
 * 报告单卡片渲染层（client bundle：`tool.call.toolview` keyed slot）。
 *
 * P6-C27 契约适配：tool.call.toolview 渲染器是**整行组件**（折叠摘要行 + 展开卡片），
 * 早期实现只渲染展开卡片 → keyed 命中后折叠态空白（联调发现）。对齐
 * ui-tool 内置 Row 模式：useState 折叠/展开，折叠显示"工具名 · 摘要"，
 * 展开显示报告单卡片（信封解析 → DataSection 分派）。
 *
 * 组件保持薄映射，全部可测逻辑在纯函数模块（envelope/result/sections/toolNames）。
 *
 * @module @medai/dsh-ui-report-card/ReportCard
 */

import { createElement, Fragment, useState } from 'react'

import { truncationText, ERROR_MESSAGES, type McpResultEnvelope } from './envelope.js'
import { buildReportSection, type ReportRow, type SectionKind } from './sections.js'
import { sectionKeyOf, displayNameOf } from './toolNames.js'
import {
  parseToolResult, blockErrorView, argsSummary, isSettled, errorTextOf,
  type ToolResultLike,
} from './result.js'

/** keyed slot 渲染器 props（ToolCallOwnerProps 最小视图）。 */
export interface ReportCardProps {
  toolName: string
  block: ToolResultLike
}

/** 行内联样式（bundle 无独立 CSS，内联保证可见；后续可迁移样式表）。 */
const rowStyle: Record<string, string | number> = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '6px 10px',
  cursor: 'pointer',
  userSelect: 'none',
  fontSize: '13px',
  lineHeight: '20px',
  color: 'var(--dsw-alias-label-primary, #222)',
  borderRadius: '6px',
}
const rowHoverStyle: Record<string, string | number> = {
  ...rowStyle,
  background: 'rgba(0,0,0,0.04)',
}
const titleStyle: Record<string, string | number> = {
  fontWeight: 600,
  whiteSpace: 'nowrap',
}
const summaryStyle: Record<string, string | number> = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  opacity: 0.7,
}
const cardStyle: Record<string, string | number> = {
  borderTop: '1px solid rgba(0,0,0,0.08)',
  padding: '8px 10px',
  fontSize: '13px',
}

function rowsView(kind: SectionKind, rows: ReportRow[]) {
  if (kind === 'lab-report') {
    return createElement(
      'table',
      { style: { borderCollapse: 'collapse', width: '100%' } },
      createElement(
        'tbody',
        null,
        rows.map((row, i) =>
          createElement(
            'tr',
            { key: i, style: row.abnormal ? { background: 'rgba(255,200,0,0.12)' } : undefined },
            createElement('td', { style: { padding: '2px 8px 2px 0', opacity: 0.7 } }, row.label),
            createElement('td', { style: { padding: '2px 8px' } }, row.value),
          ),
        ),
      ),
    )
  }
  return createElement(
    'dl',
    { style: { margin: 0 } },
    rows.map((row, i) =>
      createElement(
        Fragment,
        { key: i },
        createElement('dt', { style: { fontWeight: 600, marginTop: 4 } }, row.label),
        createElement('dd', { style: { margin: '0 0 2px 12px' } }, row.value),
      ),
    ),
  )
}

function cardBody(toolName: string, env: McpResultEnvelope) {
  const sectionKey = sectionKeyOf(toolName)
  const truncated = truncationText(env)
  const items = Array.isArray(env.items) ? env.items : []
  const sourceRefs = Array.isArray(env.sourceRefs) ? env.sourceRefs : []
  return createElement(
    'div',
    { style: cardStyle },
    env.patientLabel
      ? createElement('div', { style: { fontWeight: 600, marginBottom: 6 } }, env.patientLabel)
      : null,
    items.map((item, i) => {
      const section = buildReportSection(sectionKey, (item ?? {}) as Record<string, unknown>)
      return createElement(
        'div',
        { key: i, style: { marginBottom: 8 } },
        createElement('h5', { style: { margin: '8px 0 4px', fontSize: 13 } }, section.title),
        rowsView(section.kind, section.rows),
      )
    }),
    truncated ? createElement('div', { style: { opacity: 0.6, marginTop: 4 } }, truncated) : null,
    sourceRefs.length > 0
      ? createElement(
          'div',
          { style: { opacity: 0.5, marginTop: 4, wordBreak: 'break-all' } },
          '溯源：',
          sourceRefs.map((ref, i) => createElement('span', { key: i }, `${ref} `)),
        )
      : null,
  )
}

export function ReportCard({ toolName, block }: ReportCardProps) {
  const [expanded, setExpanded] = useState(false)
  const errorKind = blockErrorView(block)
  const env = parseToolResult(block)

  // 折叠摘要：运行中 → 工具名 + 参数摘要；完成 → patientLabel/截断文案/错误首行
  const displayName = displayNameOf(toolName)
  let summary: string
  if (!isSettled(block)) {
    summary = argsSummary(block) ?? '运行中…'
  } else if (errorKind) {
    summary = errorTextOf(block) ?? '调用失败'
  } else if (env) {
    summary = env.patientLabel
      ?? (Array.isArray(env.items) ? `已返回 ${env.items.length} 条结果` : '查询完成')
      ?? truncationText(env)
  } else {
    summary = '结果不可解析'
  }

  const expandable = env !== null || errorKind !== null
  const toggle = () => { if (expandable) setExpanded(v => !v) }
  const chevron = expandable ? (expanded ? '▾' : '▸') : '·'

  return createElement(
    'div',
    { className: 'medai-tool-row', 'data-tool': toolName },
    createElement(
      'div',
      {
        className: 'medai-tool-row-head',
        style: expanded ? rowHoverStyle : rowStyle,
        role: expandable ? 'button' : undefined,
        tabIndex: expandable ? 0 : undefined,
        'aria-expanded': expandable ? expanded : undefined,
        onClick: toggle,
        onKeyDown: (e: KeyboardEvent) => {
          if (expandable && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            toggle()
          }
        },
      },
      createElement('span', { style: { width: 14, textAlign: 'center' } }, chevron),
      createElement('span', { style: titleStyle }, displayName),
      createElement('span', { style: summaryStyle }, summary),
    ),
    expanded && errorKind
      ? createElement('div', { style: cardStyle }, ERROR_MESSAGES[errorKind])
      : null,
    expanded && env ? cardBody(toolName, env) : null,
  )
}

export default ReportCard
