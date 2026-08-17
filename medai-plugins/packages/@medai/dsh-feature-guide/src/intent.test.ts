/**
 * G2-C1 红阶段：索要意图双命中检测测试（TDD：先写失败测试）。
 *
 * 规则层语义（保守防误报）：
 * - 双命中 = 索要动词命中 × 目录检索非空，两者缺一不可；
 * - 仅动词（"我需要休息一下"）或仅功能词（"病历质控页面难用"）不触发；
 * - 非字符串 content 返回空数组，不抛异常。
 *
 * @module @medai/dsh-feature-guide/intent.test
 */

import { describe, expect, it } from 'vitest'
import { detectFeatureIntent, WANT_VERBS } from './intent.js'
import { FEATURE_CATALOG } from './catalog.js'

describe('G2 索要意图双命中检测 detectFeatureIntent', () => {
  it('detectFeatureIntent_双命中_应返回命中条目', () => {
    const hits = detectFeatureIntent('我需要一个病历质控的功能', FEATURE_CATALOG)
    expect(hits.some((e) => e.id === 'qc-emr-quality')).toBe(true)
  })

  it('detectFeatureIntent_双命中_帮我做表达应触发', () => {
    const hits = detectFeatureIntent('帮我做一个非计划再次手术分析的页面', FEATURE_CATALOG)
    expect(hits.some((e) => e.id === 'qc-repeat-operation')).toBe(true)
  })

  it('detectFeatureIntent_导航话术_跳转到X页面应触发', () => {
    // 2026-08-17 3080 实测缺口：用户说"跳转到 EMR病历质控 页面"未触发检测，
    // agent 无引导乱用浏览器工具（还猜错地址 3080）。导航动词需纳入意图。
    const hits = detectFeatureIntent('跳转到 EMR病历质控 页面自行操作', FEATURE_CATALOG)
    expect(hits.some((e) => e.id === 'qc-emr-quality')).toBe(true)
  })

  it('detectFeatureIntent_导航话术_打开X页面应触发', () => {
    const hits = detectFeatureIntent('打开病人列表页面', FEATURE_CATALOG)
    expect(hits.some((e) => e.id === 'patients')).toBe(true)
  })

  it('detectFeatureIntent_仅动词_应返回空', () => {
    expect(detectFeatureIntent('我需要休息一下', FEATURE_CATALOG)).toEqual([])
  })

  it('detectFeatureIntent_仅功能词_应返回空', () => {
    expect(detectFeatureIntent('病历质控页面真难用', FEATURE_CATALOG)).toEqual([])
  })

  it('detectFeatureIntent_多候选_应返回全部命中', () => {
    const hits = detectFeatureIntent('我想要质控的功能', FEATURE_CATALOG)
    expect(hits.length).toBeGreaterThanOrEqual(3)
    for (const id of ['qc-emr-quality', 'qc-indicator-statistics', 'qc-repeat-operation']) {
      expect(hits.some((e) => e.id === id)).toBe(true)
    }
  })

  it('detectFeatureIntent_非字符串content_应返回空不抛异常', () => {
    expect(detectFeatureIntent(null, FEATURE_CATALOG)).toEqual([])
    expect(detectFeatureIntent({ text: '我需要病历质控' }, FEATURE_CATALOG)).toEqual([])
  })

  it('detectFeatureIntent_动词表应覆盖常见索要表达', () => {
    for (const verb of ['需要', '想要', '有没有', '能不能', '帮我做', '实现', '加一个']) {
      expect(WANT_VERBS.includes(verb)).toBe(true)
    }
  })
})
