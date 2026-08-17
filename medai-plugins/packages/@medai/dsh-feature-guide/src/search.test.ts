/**
 * G1-C2 红阶段：确定性检索测试（TDD：先写失败测试）。
 *
 * 检索语义（契约 ① FeatureCatalog.search）：
 * - 名称子串命中权重最高，别名次之，description 关键词兜底；
 * - 排序稳定（同输入同输出）；
 * - 未命中/空 query 返回空数组，不抛异常。
 *
 * @module @medai/dsh-feature-guide/search.test
 */

import { describe, expect, it } from 'vitest'
import { FEATURE_ENTRIES, searchFeatures, type FeatureEntry } from './catalog.js'

/** 排序权重测试夹具：query 同时命中 A 名称与 B 别名时，A（名称命中）应在前。 */
function fixtureCatalog(): FeatureEntry[] {
  const base = (id: string, name: string, aliases: string[], route: string): FeatureEntry => ({
    id, name, aliases, summary: '', description: '', route,
  })
  return [
    base('a', '报告管理', [], '/a'),
    base('b', '其他功能', ['报告'], '/b'),
  ]
}

describe('G1 确定性检索 searchFeatures', () => {
  it('search_名称命中_应返回对应条目', () => {
    const result = searchFeatures(FEATURE_ENTRIES, '病人列表')
    expect(result.length).toBeGreaterThanOrEqual(1)
    expect(result[0].id).toBe('patients')
  })

  it('search_别名命中_应命中EMR病历质控', () => {
    const result = searchFeatures(FEATURE_ENTRIES, '病历质控')
    expect(result.some((e) => e.id === 'qc-emr-quality')).toBe(true)
  })

  it('search_名称命中_应优先于别名命中', () => {
    const result = searchFeatures(fixtureCatalog(), '报告')
    expect(result.map((e) => e.id)).toEqual(['a', 'b'])
  })

  it('search_多候选_应排序稳定', () => {
    const first = searchFeatures(FEATURE_ENTRIES, '质控')
    const second = searchFeatures(FEATURE_ENTRIES, '质控')
    expect(first.map((e) => e.id)).toEqual(second.map((e) => e.id))
    expect(first.length).toBeGreaterThanOrEqual(2)
  })

  it('search_未命中_应返回空数组不抛异常', () => {
    expect(searchFeatures(FEATURE_ENTRIES, '不存在的功能XYZ')).toEqual([])
  })

  it('search_空query_应返回空数组', () => {
    expect(searchFeatures(FEATURE_ENTRIES, '')).toEqual([])
  })
})
