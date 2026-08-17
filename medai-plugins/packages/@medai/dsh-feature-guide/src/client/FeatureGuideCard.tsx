/**
 * G3-C2 说明卡片（client bundle：`tool.call.toolview` keyed slot，对齐 ui-report-card 整行组件模式）。
 *
 * P6-C27 既有踩坑对齐：keyed slot 渲染器是**整行组件**（折叠摘要行 + 展开卡片），
 * 只渲染展开卡片会导致折叠态空白。故：
 * - FeatureGuideCard = 折叠行（功能指引 · 摘要） + 展开体（FeatureGuideBody）；
 * - FeatureGuideBody 为纯渲染（可独立 renderToString 测试）；
 * - 全部可测逻辑在纯函数模块（result/navigateBridge）。
 *
 * 交互语义：agent 文本负责"说明 + 询问是否跳转"，按钮点击 = 用户确认跳转（一步到位）。
 *
 * @module @medai/dsh-feature-guide/client/FeatureGuideCard
 */

import { createElement, Fragment, useState } from 'react'
import { parseBlockResult, type GuideResultView, type ToolBlockLike } from './result.js'
import { isInternalPath, sendNavigateFromBrowser } from './navigateBridge.js'

/** keyed slot 渲染器 props（ToolCallOwnerProps 最小视图，对齐 ReportCardProps）。 */
export interface FeatureGuideCardProps {
  toolName: string
  block: ToolBlockLike
  /** 测试注入跳转回调；缺省走浏览器 postMessage（navigateBridge）。 */
  onNavigate?: (route: string) => void
}

/** 展开体 props（纯渲染）。 */
export interface FeatureGuideBodyProps {
  result: GuideResultView | null
  onNavigate: (route: string) => void
}

const nameStyle: Record<string, string | number> = {
  fontWeight: 600,
  marginBottom: 4,
  fontSize: 13,
}
const summaryStyle: Record<string, string | number> = {
  opacity: 0.85,
  marginBottom: 4,
  fontSize: 13,
}
const descStyle: Record<string, string | number> = {
  opacity: 0.7,
  marginBottom: 6,
  fontSize: 12,
  lineHeight: '18px',
}
const permStyle: Record<string, string | number> = {
  opacity: 0.6,
  fontSize: 12,
  marginBottom: 6,
}
const buttonStyle: Record<string, string | number> = {
  padding: '4px 12px',
  fontSize: 12,
  borderRadius: 6,
  border: '1px solid #409eff',
  background: '#409eff',
  color: '#fff',
  cursor: 'pointer',
  marginBottom: 8,
}
const bodyStyle: Record<string, string | number> = {
  borderTop: '1px solid rgba(0,0,0,0.08)',
  padding: '8px 10px',
  fontSize: 13,
}
const rowStyle: Record<string, string | number> = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '6px 10px',
  cursor: 'pointer',
  userSelect: 'none',
  fontSize: 13,
  lineHeight: '20px',
  color: 'var(--dsw-alias-label-primary, #222)',
  borderRadius: '6px',
}
const rowHoverStyle: Record<string, string | number> = {
  ...rowStyle,
  background: 'rgba(0,0,0,0.04)',
}

/** 展开体纯渲染：命中逐项功能（说明 + 跳转按钮）/ 未命中引导 / 降级占位。 */
export function FeatureGuideBody({ result, onNavigate }: FeatureGuideBodyProps) {
  if (result === null) {
    return createElement('div', { style: bodyStyle }, '结果不可解析')
  }
  if (!result.matched) {
    return createElement(
      'div',
      { style: bodyStyle },
      createElement('div', { style: { fontWeight: 600, marginBottom: 4 } }, '未找到对应功能'),
      createElement('div', { style: descStyle }, result.hint ?? '系统暂未收录该功能，可将需求反馈给信息科'),
    )
  }
  return createElement(
    'div',
    { style: bodyStyle },
    result.features.map((feature) => createElement(
      'div',
      { key: feature.id, style: { marginBottom: 8 } },
      createElement('div', { style: nameStyle }, feature.name),
      createElement('div', { style: summaryStyle }, feature.summary),
      createElement('div', { style: descStyle }, feature.description),
      feature.permission
        ? createElement('div', { style: permStyle }, `需 ${feature.permission} 权限`)
        : null,
      createElement(
        'button',
        {
          type: 'button',
          style: buttonStyle,
          onClick: () => {
            if (isInternalPath(feature.route)) onNavigate(feature.route)
          },
        },
        '跳转到该页面',
      ),
    )),
  )
}

/** 折叠行摘要（对齐 ReportCard 折叠态）。 */
function summaryOf(result: GuideResultView | null): string {
  if (result === null) return '结果不可解析'
  if (!result.matched) return '未找到对应功能'
  return `发现 ${result.features.length} 个已有功能`
}

/** 整行组件（keyed slot 渲染器）：折叠摘要行 + 展开卡片。 */
export function FeatureGuideCard({ toolName, block, onNavigate }: FeatureGuideCardProps) {
  const [expanded, setExpanded] = useState(false)
  const result = parseBlockResult(block)
  const summary = summaryOf(result)
  const handleNavigate = onNavigate ?? sendNavigateFromBrowser
  const toggle = () => setExpanded((v) => !v)

  return createElement(
    'div',
    { className: 'medai-tool-row', 'data-tool': toolName },
    createElement(
      'div',
      {
        className: 'medai-tool-row-head',
        style: expanded ? rowHoverStyle : rowStyle,
        role: 'button',
        tabIndex: 0,
        'aria-expanded': expanded,
        onClick: toggle,
        onKeyDown: (e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            toggle()
          }
        },
      },
      createElement('span', { style: { width: 14, textAlign: 'center' } }, expanded ? '▾' : '▸'),
      createElement('span', { style: { fontWeight: 600, whiteSpace: 'nowrap' } }, '功能指引'),
      createElement(
        'span',
        { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.7 } },
        summary,
      ),
    ),
    expanded
      ? createElement(
          Fragment,
          null,
          createElement(FeatureGuideBody, { result, onNavigate: handleNavigate }),
        )
      : null,
  )
}

export default FeatureGuideCard
