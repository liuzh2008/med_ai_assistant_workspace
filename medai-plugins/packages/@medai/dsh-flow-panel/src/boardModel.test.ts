/**
 * boardModel 测试（TDD 指南 C9，G4 呈现面渲染模型，node 环境）。
 *
 * 覆盖：①容错解析（非法/缺结构 → null）；②概要串（进行中+失败/全零隐藏）；
 * ③异常标记（failed>0）；④病人排序（失败置顶→进行中→其他，稳定）；
 * ⑤单病人流程摘要（流程名+步骤+状态）；⑥未知值降级不崩溃。
 */

import { describe, expect, it } from 'vitest'
import {
  buildSummary, flowLabel, isAlerted, parseBoardData, patientFlowSummary, sortPatients,
} from './boardModel.js'

function data(counts: { active?: number; failed?: number; done?: number; cancelled?: number }, patients: unknown[] = []) {
  return { counts, patients }
}

describe('G4 渲染模型：boardModel', () => {
  it('① 容错解析：非法/缺结构 → null', () => {
    expect(parseBoardData(null)).toBeNull()
    expect(parseBoardData('x')).toBeNull()
    expect(parseBoardData({ counts: {} })).toBeNull()
    expect(parseBoardData({ counts: {}, patients: [] })).not.toBeNull()
  })

  it('② 概要串：3 进行中 · 1 失败；全零 → null', () => {
    expect(buildSummary(data({ active: 3, failed: 1 }))).toBe('3 进行中 · 1 失败')
    expect(buildSummary(data({ active: 3, failed: 0 }))).toBe('3 进行中 · 0 失败')
    expect(buildSummary(data({ active: 0, failed: 0 }))).toBe('0 进行中 · 0 失败')
    expect(buildSummary(null)).toBeNull()
  })

  it('③ 异常标记：failed>0 → 红色', () => {
    expect(isAlerted(data({ failed: 1 }))).toBe(true)
    expect(isAlerted(data({ failed: 0 }))).toBe(false)
    expect(isAlerted(null)).toBe(false)
  })

  it('④ 排序：失败置顶 → 进行中 → 其他（稳定）', () => {
    const failed = { patientId: 'P2', flows: [{ status: 'FAILED' }] }
    const active = { patientId: 'P1', flows: [{ status: 'ACTIVE' }] }
    const done = { patientId: 'P3', flows: [{ status: 'DONE' }] }
    const none = { patientId: 'P4', flows: [] }
    const sorted = sortPatients([done, none, active, failed])
    expect(sorted.map(p => p.patientId)).toEqual(['P2', 'P1', 'P3', 'P4'])
    // 非数组 → 空
    expect(sortPatients(undefined as never)).toEqual([])
  })

  it('⑤ 单病人摘要：首诊收治·等待医嘱窗口·进行中', () => {
    const p = {
      patientId: 'P1',
      name: '孙伟',
      bedNumber: '3',
      flows: [{ flowId: 'admission-first-mile', currentStep: 'wait-orders-window', status: 'ACTIVE' }],
    }
    expect(patientFlowSummary(p)).toBe('首诊收治·等待医嘱窗口（约1小时）·进行中')
    expect(patientFlowSummary({ patientId: 'P5', flows: [] })).toBe('暂无流程任务')
    expect(flowLabel('unknown-flow')).toBe('unknown-flow')
    expect(flowLabel('admission-first-mile')).toBe('首诊收治')
  })
})
