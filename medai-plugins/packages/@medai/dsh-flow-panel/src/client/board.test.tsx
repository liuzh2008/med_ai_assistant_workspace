/**
 * G4 呈现面测试（TDD 指南 C10~C12，node 环境，jsdom-free）。
 *
 * 覆盖：①apply 三路 slot 注册（toolview/overlay/view）；②BadgeView 渲染
 * （隐藏/概要/红色）；③BoardView 渲染（统计卡/病人排序失败置顶/展开明细/
 * 取消按钮与回调/空态）；④cancelFlow 契约②（成功/拒绝/网络异常）。
 */

import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'

import { apply } from './index.js'
import { BadgeView } from './BoardBadge.js'
import { BoardView } from './BoardTab.js'
import { cancelFlow } from './useBoardData.js'

function sampleBoard() {
  return {
    counts: { active: 2, done: 1, failed: 1, cancelled: 0 },
    patients: [
      { patientId: 'P1', name: '孙伟', bedNumber: '3', flows: [{ flowId: 'admission-first-mile', currentStep: 'wait-orders-window', status: 'ACTIVE' }] },
      { patientId: 'P2', name: '李敏', bedNumber: '5', flows: [{ flowId: 'admission-first-mile', currentStep: 'gen-admission-record', status: 'FAILED', failureReason: '生成超时', updatedAt: '2026-08-21 10:00:00' }] },
      { patientId: 'P3', name: '张华', bedNumber: '7', flows: [] },
    ],
  }
}

describe('G4 注册：client/index apply', () => {
  it('① 注册 toolview + shell.overlay + conversation.view 三路', () => {
    const register = vi.fn(() => () => {})
    const inject = vi.fn(() => register)
    const ctx = { slots: { inject, register } }

    apply(ctx as never)

    expect(inject).toHaveBeenCalledTimes(4) // 2 toolview keys + overlay + view
    const injectedKeys = inject.mock.calls.map((c) => c[0])
    expect(injectedKeys).toContain('shell.overlay')
    expect(injectedKeys).toContain('conversation.view')
    for (const provider of inject.mock.calls.map((c) => c[1]) as Array<() => unknown>) provider()
    const names = register.mock.calls.map((c) => (c[0] as { name: string }).name)
    expect(names).toContain('shell.overlay')
    expect(names).toContain('conversation.view')
    // view 注册带 id 与 label（与 Chat/Trajectory 并列的 Tab 名）
    const viewReg = register.mock.calls.find((c) => (c[0] as { name: string }).name === 'conversation.view')
    expect((viewReg![0] as { id: string }).id).toBe('medai-flow-board')
    expect((viewReg![0] as { label: string }).label).toBe('流程看板')
    // overlay 注册带 id
    const overlayReg = register.mock.calls.find((c) => (c[0] as { name: string }).name === 'shell.overlay')
    expect((overlayReg![0] as { id: string }).id).toBe('medai-flow-badge')
  })
})

describe('G4 角标：BadgeView', () => {
  it('② summary=null → 隐藏占位', () => {
    const html = renderToString(createElement(BadgeView, { summary: null, alerted: false }))
    expect(html).toContain('medai-flow-badge-hidden')
    expect(html).not.toContain('进行中')
  })

  it('③ 概要渲染 + failed>0 红色标记', () => {
    const html = renderToString(createElement(BadgeView, { summary: '2 进行中 · 1 失败', alerted: true }))
    expect(html).toContain('2 进行中 · 1 失败')
    expect(html).toContain('medai-flow-badge-alert')
  })

  it('④ 无失败 → 无红色标记', () => {
    const html = renderToString(createElement(BadgeView, { summary: '2 进行中 · 0 失败', alerted: false }))
    expect(html).not.toContain('medai-flow-badge-alert')
  })
})

describe('G4 看板：BoardView', () => {
  const noop = () => { }

  it('⑤ 空数据 → 暂无流程任务', () => {
    const html = renderToString(createElement(BoardView, {
      board: null, expanded: null, busy: null, notice: null,
      onToggle: noop, onCancel: noop, onRefresh: noop,
    }))
    expect(html).toContain('暂无流程任务')
  })

  it('⑥ 统计卡四类计数', () => {
    const html = renderToString(createElement(BoardView, {
      board: sampleBoard(), expanded: null, busy: null, notice: null,
      onToggle: noop, onCancel: noop, onRefresh: noop,
    }))
    expect(html).toContain('进行中')
    expect(html).toContain('已完成')
    expect(html).toContain('失败')
    expect(html).toContain('已取消')
    // 计数文本（2/1/1/0）出现
    expect(html).toContain('>2<')
    expect(html).toContain('>1<')
  })

  it('⑦ 病人排序：失败置顶 → 进行中 → 无实例（P2 在 P1 前）', () => {
    const html = renderToString(createElement(BoardView, {
      board: sampleBoard(), expanded: null, busy: null, notice: null,
      onToggle: noop, onCancel: noop, onRefresh: noop,
    }))
    const p1 = html.indexOf('孙伟')
    const p2 = html.indexOf('李敏')
    const p3 = html.indexOf('张华')
    expect(p2).toBeGreaterThan(-1)
    expect(p1).toBeGreaterThan(p2) // 失败者 P2 在 P1 前
    expect(p3).toBeGreaterThan(p1) // 无实例 P3 最后
    // 失败卡片红色类
    expect(html).toContain('medai-board-patient-failed')
  })

  it('⑧ 展开明细：失败原因与时间透出；ACTIVE 显示取消按钮', () => {
    const html = renderToString(createElement(BoardView, {
      board: sampleBoard(), expanded: 'P1', busy: null, notice: null,
      onToggle: noop, onCancel: noop, onRefresh: noop,
    }))
    expect(html).toContain('取消')
    expect(html).toContain('medai-board-cancel')
  })

  it('⑨ 展开明细：失败原因与时间透出', () => {
    const html = renderToString(createElement(BoardView, {
      board: sampleBoard(), expanded: 'P2', busy: null, notice: null,
      onToggle: noop, onCancel: noop, onRefresh: noop,
    }))
    expect(html).toContain('原因：生成超时')
    expect(html).toContain('2026-08-21 10:00:00')
  })

  it('⑩ notice 透出 + 刷新按钮', () => {
    const html = renderToString(createElement(BoardView, {
      board: sampleBoard(), expanded: null, busy: null, notice: '流程已取消',
      onToggle: noop, onCancel: noop, onRefresh: noop,
    }))
    expect(html).toContain('流程已取消')
    expect(html).toContain('medai-board-refresh')
  })
})

describe('G4 交互：cancelFlow（契约②）', () => {
  it('⑪ 后端取消成功 → ok=true', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ cancelled: true, message: '流程已取消' }), { status: 200 })))
    const outcome = await cancelFlow('P001')
    expect(outcome.ok).toBe(true)
    expect(outcome.message).toBe('流程已取消')
    vi.unstubAllGlobals()
  })

  it('⑫ 后端拒绝（终态）→ ok=false + 原因', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ cancelled: false, message: '流程已结束或未运行，无法取消' }), { status: 200 })))
    const outcome = await cancelFlow('P001')
    expect(outcome.ok).toBe(false)
    expect(outcome.message).toContain('无法取消')
    vi.unstubAllGlobals()
  })

  it('⑬ 网络异常 → ok=false + 固定文案（无内部细节）', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED') }))
    const outcome = await cancelFlow('P001')
    expect(outcome.ok).toBe(false)
    expect(outcome.message).toContain('网络异常')
    expect(outcome.message).not.toContain('ECONNREFUSED')
    vi.unstubAllGlobals()
  })
})
