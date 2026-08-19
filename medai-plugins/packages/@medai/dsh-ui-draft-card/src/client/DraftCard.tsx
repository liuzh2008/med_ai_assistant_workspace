/**
 * 明文草稿卡片渲染层（client bundle：`tool.call.toolview` keyed slot，F4/T2.5）。
 *
 * P6-C27 契约适配（对齐 dsh-ui-report-card / dsh-feature-guide 经验）：
 * tool.call.toolview 渲染器是**整行组件**（折叠摘要行 + 展开卡片）——只渲染
 * 展开卡片会导致折叠态空白。故：
 *   - DraftCard = 折叠行（AI 草稿 · 摘要）+ 展开体（DraftBody）；
 *   - DraftBody 为纯渲染（可独立 renderToString 测试）；
 *   - 取数逻辑在纯函数模块（draftApi.fetchDraft）。
 *
 * PII 红线（方案 §6.2）：明文草稿只经 fetchDraft 取回并**只渲染**在卡片里，
 * 不进模型上下文、不进会话日志——组件无任何"发送给 agent"的通道，
 * 且禁止 console.log 明文内容。
 *
 * @module @medai/dsh-ui-draft-card/client/DraftCard
 */

import { createElement, Fragment, useEffect, useState } from 'react'

import { fetchDraft, type DraftFetchOptions } from './draftApi.js'
import { errorTextOf, parseBlockResult, type DraftView, type ToolBlockLike } from './draftResult.js'

/** keyed slot 渲染器 props（ToolCallOwnerProps 最小视图）。 */
export interface DraftCardProps {
  toolName: string
  block: ToolBlockLike
  /** 测试注入：初始展开（缺省折叠）。 */
  defaultExpanded?: boolean
  /** 测试注入：取数选项（jwt/fetchImpl/baseUrl）。 */
  draftOptions?: DraftFetchOptions
}

/** 展开体 props（纯渲染）。 */
export interface DraftBodyProps {
  view: DraftView | null
  draftState: 'idle' | 'loading' | 'ok' | 'unauthorized' | 'error'
  draftText?: string
}

/** 取数状态机：idle（无 promptId/未展开）→ loading → ok | unauthorized | error。 */
export type DraftState = DraftBodyProps['draftState']

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
const preStyle: Record<string, string | number> = {
  margin: 0,
  padding: '8px',
  maxHeight: 320,
  overflowY: 'auto',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  background: 'rgba(0,0,0,0.03)',
  borderRadius: 6,
  lineHeight: '20px',
  fontFamily: 'inherit',
}
const noticeStyle: Record<string, string | number> = {
  marginTop: 6,
  fontSize: 12,
  opacity: 0.7,
}
const stateStyle: Record<string, string | number> = {
  opacity: 0.7,
  padding: '4px 0',
}

/** 折叠行摘要（对齐 ReportCard 折叠态）。 */
export function summaryOf(view: DraftView | null, errorText: string | null): string {
  if (errorText) return errorText
  if (view === null) return '结果不可解析'
  if (view.promptId) return '草稿已生成，点击展开查看'
  if (view.status === 'TIMEOUT') return view.message ?? '仍在生成中，可稍后用 medai_record_status 查询'
  return view.summary ?? view.message ?? '生成完成'
}

/** 展开体纯渲染：明文草稿（可滚动）+ "以上为 AI 草稿，请审核" 标注；无 promptId 渲染摘要。 */
export function DraftBody({ view, draftState, draftText }: DraftBodyProps) {
  // 无 promptId（如 TIMEOUT 降级）→ 只渲染脱敏摘要文本，不取明文
  if (view === null) {
    return createElement('div', { style: stateStyle }, '结果不可解析')
  }
  if (!view.promptId) {
    const text = view.summary ?? view.message ?? '生成完成'
    return createElement('div', { style: stateStyle }, text)
  }
  if (draftState === 'loading' || draftState === 'idle') {
    return createElement('div', { style: stateStyle }, '正在加载草稿…')
  }
  if (draftState === 'unauthorized') {
    return createElement('div', { style: stateStyle }, '无权限查看草稿')
  }
  if (draftState === 'error') {
    return createElement('div', { style: stateStyle }, '草稿获取失败，请稍后重试')
  }
  return createElement(
    'div',
    { style: cardStyle },
    createElement('pre', { style: preStyle }, draftText ?? ''),
    createElement('div', { style: noticeStyle }, '以上为 AI 草稿，请审核'),
  )
}

/** 整行组件（keyed slot 渲染器）：折叠摘要行 + 展开卡片（异步取明文）。 */
export function DraftCard({ toolName, block, defaultExpanded, draftOptions }: DraftCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? false)
  const [draftState, setDraftState] = useState<DraftState>('idle')
  const [draftText, setDraftText] = useState('')

  const view = parseBlockResult(block)
  const errorText = errorTextOf(block)
  const summary = summaryOf(view, errorText)
  const canExpand = view !== null || errorText !== null

  // 展开且拿到 promptId → 直连 F2e 取明文（只渲染在卡片，无其他通道）
  useEffect(() => {
    if (!expanded || !view?.promptId) return
    let cancelled = false
    setDraftState('loading')
    fetchDraft(view.promptId, draftOptions).then((res) => {
      if (cancelled) return
      if (res.kind === 'ok') {
        setDraftText(res.text)
        setDraftState('ok')
      } else if (res.kind === 'unauthorized') {
        setDraftState('unauthorized')
      } else {
        setDraftState('error')
      }
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, view?.promptId])

  const toggle = () => { if (canExpand) setExpanded((v) => !v) }
  const chevron = canExpand ? (expanded ? '▾' : '▸') : '·'

  return createElement(
    'div',
    { className: 'medai-tool-row', 'data-tool': toolName },
    createElement(
      'div',
      {
        className: 'medai-tool-row-head',
        style: expanded ? rowHoverStyle : rowStyle,
        role: canExpand ? 'button' : undefined,
        tabIndex: canExpand ? 0 : undefined,
        'aria-expanded': canExpand ? expanded : undefined,
        onClick: toggle,
        onKeyDown: (e: KeyboardEvent) => {
          if (canExpand && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            toggle()
          }
        },
      },
      createElement('span', { style: { width: 14, textAlign: 'center' } }, chevron),
      createElement('span', { style: titleStyle }, 'AI 草稿'),
      createElement('span', { style: summaryStyle }, summary),
    ),
    expanded
      ? createElement(Fragment, null, createElement(DraftBody, { view, draftState, draftText }))
      : null,
  )
}

export default DraftCard
