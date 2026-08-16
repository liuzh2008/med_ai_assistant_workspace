import { describe, it, expect } from 'vitest'

import { sectionOf, buildReportSection, type ReportSection } from './sections.js'

describe('sectionOf', () => {
  it('后端板块枚举映射到渲染分派', () => {
    expect(sectionOf('PATIENT_LIST')).toBe('patient-list')
    expect(sectionOf('LAB_RESULT')).toBe('lab-report')
    expect(sectionOf('EXAM_RESULT')).toBe('exam-report')
    expect(sectionOf('MEDICAL_RECORD')).toBe('record-timeline')
    expect(sectionOf('DIAGNOSIS')).toBe('diagnosis-list')
    expect(sectionOf('ORDER')).toBe('order-groups')
    expect(sectionOf('PATIENT_BASIC')).toBe('patient-list')
  })

  it('未知板块（护理/麻醉等未来板块）兜底为generic', () => {
    expect(sectionOf('NURSING_RECORD')).toBe('generic')
    expect(sectionOf(undefined)).toBe('generic')
    expect(sectionOf('')).toBe('generic')
  })
})

describe('buildReportSection: LAB_RESULT 报告单', () => {
  const section = buildReportSection('LAB_RESULT', {
    labName: '血常规',
    labResult: '12.3',
    referenceRange: '(4-10)',
    unit: '×10⁹/L',
    abnormalIndicator: '↑',
    labReportTime: '2026-08-16 08:12',
  })
  it('生成报告单行结构', () => {
    expect(section.kind).toBe('lab-report')
    expect(section.title).toBe('血常规')
    const rows = Object.fromEntries(section.rows.map((r) => [r.label, r.value]))
    expect(rows['结果']).toBe('12.3 ×10⁹/L')
    expect(rows['参考范围']).toBe('(4-10)')
    expect(rows['时间']).toBe('2026-08-16 08:12')
  })
  it('异常标记带abnormal标识', () => {
    const abnormalRow = section.rows.find((r) => r.label === '结果')
    expect(abnormalRow?.abnormal).toBe(true)
  })
  it('正常值无abnormal标识', () => {
    const normal = buildReportSection('LAB_RESULT', { labName: 'X', labResult: '5', abnormalIndicator: '' })
    const row = normal.rows.find((r) => r.label === '结果')
    expect(row?.abnormal).toBe(false)
  })
})

describe('buildReportSection: 病历时间线 / 诊断 / 医嘱', () => {
  it('MEDICAL_RECORD 时间线', () => {
    const s = buildReportSection('MEDICAL_RECORD', { recordDate: '2026-08-15', docTypeName: '病程记录', content: '病情平稳…' })
    expect(s.kind).toBe('record-timeline')
    expect(s.rows[0].label).toBe('2026-08-15 病程记录')
    expect(s.rows[0].value).toContain('病情平稳')
  })

  it('DIAGNOSIS ICD 列表', () => {
    const s = buildReportSection('DIAGNOSIS', { icd10Code: 'I50.900', diagnosisText: '心力衰竭', isPrimary: '1' })
    expect(s.kind).toBe('diagnosis-list')
    expect(s.rows[0].label).toBe('I50.900')
    expect(s.rows[0].value).toBe('心力衰竭')
  })

  it('ORDER 医嘱分组', () => {
    const s = buildReportSection('ORDER', { orderName: '阿司匹林肠溶片', dosage: '100mg', frequency: 'qd', route: '口服' })
    expect(s.kind).toBe('order-groups')
    expect(s.rows[0].label).toBe('阿司匹林肠溶片')
    expect(s.rows[0].value).toContain('100mg')
  })

  it('未知板块 generic 显示全部字段（安全兜底）', () => {
    const s = buildReportSection('NURSING_RECORD', { fieldA: 'v1', fieldB: 'v2' }) as ReportSection
    expect(s.kind).toBe('generic')
    expect(s.rows.length).toBeGreaterThanOrEqual(2)
  })
})
