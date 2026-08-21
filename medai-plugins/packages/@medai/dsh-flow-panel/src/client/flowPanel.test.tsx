/**
 * @medai/dsh-flow-panel 组件/模型测试（T4.3 flowPanel.test.tsx，node 环境）。
 *
 * 覆盖（任务验收）：
 *   ① keyed slot 注册：apply 注册双 key（本地工具名 + MCP 前缀兜底）；
 *   ② 空信封 → "暂无流程任务"；
 *   ③ ACTIVE 实例 → 步骤标签"入院记录生成中"、状态"进行中"；
 *   ④ FAILED 实例 → 失败原因"生成超时"透出；
 *   ⑤ 多实例渲染：逐行列出（renderToString 可测路径）。
 */

import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'

import { apply } from './index.js'
import { FlowPanel, summaryOf } from './FlowPanel.js'
import { buildPanelModel, flowStatusLabel, flowStepLabel } from '../model.js'

/** 已结算工具块（content 文本为 MCP 信封 JSON）。 */
function settledBlock(envelope: Record<string, unknown>): { content: Array<{ type: string; text: string }> } {
  return { content: [{ type: 'text', text: JSON.stringify(envelope) }] }
}

function activeEnvelope(): Record<string, unknown> {
  return {
    patientId: 'P1',
    patientLabel: '孙*',
    items: [{
      flowId: 'admission-first-mile',
      currentStep: 'gen-admission-record',
      status: 'ACTIVE',
      definitionVersion: 1,
      updatedAt: '2026-08-21 09:00:00',
    }],
  }
}

describe('keyed slot 注册（tool.call.toolview）', () => {
  it('① apply 为 medai_flow_tasks 注册 keyed renderer（双 key）', () => {
    const register = vi.fn()
    const inject = vi.fn(() => register)
    const ctx = { slots: { inject, register } }

    apply(ctx as never)

    expect(inject).toHaveBeenCalledWith('tool.call.toolview', expect.any(Function))
    const providers = inject.mock.calls.map((c) => c[1]) as Array<() => unknown>
    for (const provider of providers) provider()
    expect(register).toHaveBeenCalledTimes(2)
    const keys = register.mock.calls.map((c) => (c[0] as { key: string }).key)
    expect(keys).toContain('medai_flow_tasks')
    expect(keys).toContain('mcp__medai__medai_flow_tasks')
  })
})

describe('视图模型（纯函数）', () => {
  it('② 空信封 → empty=true', () => {
    expect(buildPanelModel(null).empty).toBe(true)
    expect(buildPanelModel({ items: [] }).empty).toBe(true)
  })

  it('③ ACTIVE 实例 → 步骤标签与状态标签', () => {
    const model = buildPanelModel(activeEnvelope())
    expect(model.empty).toBe(false)
    expect(model.tasks[0].stepLabel).toBe('入院记录生成中')
    expect(model.tasks[0].statusLabel).toBe('进行中')
    expect(flowStepLabel('wait-orders-window')).toBe('等待医嘱窗口（约1小时）')
    expect(flowStatusLabel('FAILED')).toBe('失败')
    expect(flowStatusLabel('CANCELLED')).toBe('已取消')
  })

  it('④ FAILED 实例 → 失败原因透出', () => {
    const model = buildPanelModel({
      items: [{ flowId: 'admission-first-mile', currentStep: 'gen-admission-record', status: 'FAILED', failureReason: '生成超时' }],
    })
    expect(model.tasks[0].statusLabel).toBe('失败')
    expect(model.tasks[0].failureReason).toBe('生成超时')
  })

  it('④ CANCELLED 实例 → 状态"已取消"且取消原因透出', () => {
    const model = buildPanelModel({
      items: [{ flowId: 'admission-first-mile', currentStep: 'wait-orders-window', status: 'CANCELLED', failureReason: '手动取消' }],
    })
    expect(model.tasks[0].statusLabel).toBe('已取消')
    expect(model.tasks[0].failureReason).toBe('手动取消')
  })
})

describe('summaryOf / FlowPanel 渲染（renderToString）', () => {
  it('④ 折叠行摘要：失败原因优先', () => {
    expect(summaryOf({ items: [{ flowId: 'admission-first-mile', status: 'FAILED', failureReason: '生成超时' }] }))
      .toContain('生成超时')
    expect(summaryOf({ items: [{ flowId: 'admission-first-mile', currentStep: 'wait-orders-window', status: 'ACTIVE' }] }))
      .toContain('等待医嘱窗口')
    expect(summaryOf(null)).toBe('暂无流程任务')
  })

  it('⑤ 多实例渲染逐行列出', () => {
    const envelope = {
      items: [
        { flowId: 'admission-first-mile', currentStep: 'gen-admission-record', status: 'ACTIVE' },
        { flowId: 'admission-first-mile', currentStep: 'gen-followups', status: 'DONE' },
      ],
    }
    const out = renderToString(createElement(FlowPanel, { env: envelope }))
    expect(out).toContain('入院记录生成中')
    expect(out).toContain('已完成')
    expect(out).toContain('admission-first-mile')
  })

  it('⑤ 空信封渲染"暂无流程任务"', () => {
    const out = renderToString(createElement(FlowPanel, { env: settledBlock({ items: [] }) }))
    expect(out).toContain('暂无流程任务')
  })
})
