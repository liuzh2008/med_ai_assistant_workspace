/**
 * 报告单卡片渲染层（client bundle：`tool.call.toolview` keyed slot）。
 *
 * 通用渲染器：信封解析（envelope/result）→ 按 DataSection 分派（sections）→ JSX。
 * 组件保持薄映射，全部可测逻辑在纯函数模块；渲染细节由 DSH 加载联调（E2E）验证。
 *
 * @module @medai/dsh-ui-report-card/ReportCard
 */

import { createElement, Fragment } from 'react'

import { truncationText, ERROR_MESSAGES, type McpResultEnvelope } from './envelope.js'
import { buildReportSection, type ReportRow, type SectionKind } from './sections.js'
import { sectionKeyOf } from './toolNames.js'
import { parseToolResult, blockErrorView, type ToolResultLike } from './result.js'

/** keyed slot 渲染器 props（ToolCallOwnerProps 最小视图）。 */
export interface ReportCardProps {
  toolName: string
  block: ToolResultLike
}

function rowsView(kind: SectionKind, rows: ReportRow[]) {
  if (kind === 'lab-report') {
    return createElement(
      'table',
      { className: 'medai-card-table' },
      createElement(
        'tbody',
        null,
        rows.map((row, i) =>
          createElement(
            'tr',
            { key: i, className: row.abnormal ? 'medai-row-abnormal' : undefined },
            createElement('td', { className: 'medai-cell-label' }, row.label),
            createElement('td', null, row.value),
          ),
        ),
      ),
    )
  }
  return createElement(
    'dl',
    { className: 'medai-card-rows' },
    rows.map((row, i) =>
      createElement(
        Fragment,
        { key: i },
        createElement('dt', null, row.label),
        createElement('dd', null, row.value),
      ),
    ),
  )
}

export function ReportCard({ toolName, block }: ReportCardProps) {
  const errorKind = blockErrorView(block)
  if (errorKind) {
    return createElement('div', { className: 'medai-card medai-card-error' }, ERROR_MESSAGES[errorKind])
  }

  const env: McpResultEnvelope | null = parseToolResult(block)
  if (!env) {
    // 非信封（如系统提示/无结果）不渲染卡片——交给通用工具行
    return null
  }

  const sectionKey = sectionKeyOf(toolName)
  const truncated = truncationText(env)
  const items = Array.isArray(env.items) ? env.items : []
  const sourceRefs = Array.isArray(env.sourceRefs) ? env.sourceRefs : []

  return createElement(
    'div',
    { className: 'medai-card' },
    env.patientLabel
      ? createElement('div', { className: 'medai-card-head' }, env.patientLabel)
      : null,
    createElement(
      'div',
      { className: 'medai-card-body' },
      items.map((item, i) =>
        createElement(
          'div',
          { key: i, className: 'medai-card-section' },
          createElement(
            'h5',
            null,
            buildReportSection(sectionKey, (item ?? {}) as Record<string, unknown>).title,
          ),
          rowsView(
            buildReportSection(sectionKey, (item ?? {}) as Record<string, unknown>).kind,
            buildReportSection(sectionKey, (item ?? {}) as Record<string, unknown>).rows,
          ),
        ),
      ),
    ),
    truncated
      ? createElement('div', { className: 'medai-card-truncated' }, truncated)
      : null,
    sourceRefs.length > 0
      ? createElement(
          'div',
          { className: 'medai-card-refs' },
          '溯源：',
          sourceRefs.map((ref, i) => createElement('span', { key: i, className: 'medai-card-ref' }, ref)),
        )
      : null,
  )
}

export default ReportCard
