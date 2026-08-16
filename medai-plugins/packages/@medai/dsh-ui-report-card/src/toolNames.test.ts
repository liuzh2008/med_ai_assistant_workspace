import { describe, it, expect } from 'vitest'

import { REPORT_TOOLS, sectionKeyOf, TOOL_SECTION_KEYS } from './toolNames.js'

describe('REPORT_TOOLS', () => {
  it('覆盖全部 7 个一期工具', () => {
    const expected = [
      'mcp__medai__medai_patient_list_by_department',
      'mcp__medai__medai_patient_basic_info',
      'mcp__medai__medai_patient_diagnoses',
      'mcp__medai__medai_patient_orders',
      'mcp__medai__medai_medical_records',
      'mcp__medai__medai_lab_results',
      'mcp__medai__medai_exam_results',
    ]
    expect(Object.keys(REPORT_TOOLS).sort()).toEqual(expected.sort())
  })

  it('sectionKeyOf 命中已知工具', () => {
    expect(sectionKeyOf('mcp__medai__medai_lab_results')).toBe('LAB_RESULT')
  })

  it('未知工具返回undefined（不注册/不渲染卡片）', () => {
    expect(sectionKeyOf('mcp__medai__medai_future_tool')).toBeUndefined()
    expect(sectionKeyOf('bash')).toBeUndefined()
  })

  it('TOOL_SECTION_KEYS 与工具数一致', () => {
    expect(TOOL_SECTION_KEYS.length).toBe(Object.keys(REPORT_TOOLS).length)
  })
})
