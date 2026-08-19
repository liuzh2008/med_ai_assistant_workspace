/**
 * G2-C3 红阶段：medai_feature_guide 工具测试（TDD：先写失败测试）。
 *
 * 契约 ②（G2↔G3）：{ matched, features:[{id,name,summary,description,route,permission?}], hint? }
 * 执行语义：本地确定性检索；目录异常/非法入参返回 matched=false + 明示文案，不抛断（降级铁律）。
 *
 * @module @medai/dsh-feature-guide/tool.test
 */

import { describe, expect, it } from 'vitest'
import {
  CATALOG_ERROR_HINT,
  createToolDefinition,
  executeGuide,
  GUIDE_RESULT_KEYS,
  NO_MATCH_HINT,
  TOOL_DESCRIPTION,
  TOOL_NAME,
} from './tool.js'
import { FEATURE_CATALOG, type FeatureCatalog } from './catalog.js'

describe('G2 medai_feature_guide 工具执行 executeGuide', () => {
  it('tool_execute_命中_应返回契约②字段完整', () => {
    const result = executeGuide(FEATURE_CATALOG, { query: '病历质控' })
    expect(result.matched).toBe(true)
    expect(result.features.length).toBeGreaterThanOrEqual(1)
    const feature = result.features.find((f) => f.id === 'qc-emr-quality')
    expect(feature).toBeDefined()
    for (const key of ['id', 'name', 'summary', 'description', 'route'] as const) {
      expect(typeof feature![key]).toBe('string')
      expect(feature![key].length).toBeGreaterThan(0)
    }
  })

  it('tool_execute_未命中_应返回matched=false加引导文案', () => {
    const result = executeGuide(FEATURE_CATALOG, { query: '会议排班系统' })
    expect(result.matched).toBe(false)
    expect(result.features).toEqual([])
    expect(result.hint).toBe(NO_MATCH_HINT)
  })

  it('tool_execute_空query_应返回matched=false', () => {
    const result = executeGuide(FEATURE_CATALOG, { query: '' })
    expect(result.matched).toBe(false)
    expect(result.features).toEqual([])
  })

  it('tool_execute_目录异常_应返回matched=false加明示不抛断', () => {
    const broken: FeatureCatalog = {
      search() {
        throw new Error('boom')
      },
    }
    const result = executeGuide(broken, { query: '病历质控' })
    expect(result.matched).toBe(false)
    expect(result.hint).toBe(CATALOG_ERROR_HINT)
  })

  it('tool_execute_非对象入参_应返回matched=false', () => {
    const result = executeGuide(FEATURE_CATALOG, null)
    expect(result.matched).toBe(false)
  })
})

describe('G2 工具定义 createToolDefinition', () => {
  it('tool_定义_应含触发时机description与参数schema', () => {
    const def = createToolDefinition(FEATURE_CATALOG)
    expect(def.name).toBe(TOOL_NAME)
    expect(def.description).toBe(TOOL_DESCRIPTION)
    expect(TOOL_DESCRIPTION.includes('索要')).toBe(true)
    expect(TOOL_DESCRIPTION.includes('是否支持')).toBe(true)
    // parameters 必须是完整 JSON Schema（object 根）——DSH register 直接按 JSON Schema 校验
    // （defineTool 的 DSL 形状只在 defineTool 内部转换；自声明路线必须给 JSON Schema）
    expect(def.parameters).toEqual({
      type: 'object',
      properties: {
        query: { type: 'string', description: expect.any(String) },
      },
      required: ['query'],
      additionalProperties: false,
    })
  })

  it('tool_定义_渲染投影_应输出契约②JSON文本', () => {
    const def = createToolDefinition(FEATURE_CATALOG)
    const value = { matched: true, features: [{ id: 'x', name: 'n', summary: 's', description: 'd', route: '/x' }] }
    const blocks = def.output.render({}, value)
    expect(blocks.length).toBe(1)
    expect(blocks[0].type).toBe('text')
    const parsed = JSON.parse(blocks[0].text)
    expect(parsed.matched).toBe(true)
    expect(parsed.features[0].route).toBe('/x')
  })

  it('tool_定义_execute_应透传目录检索', async () => {
    const def = createToolDefinition(FEATURE_CATALOG)
    const value = (await def.execute({ query: '病历质控' }, {})) as { matched: boolean }
    expect(value.matched).toBe(true)
  })

  it('tool_契约字段常量_应覆盖渲染解析所需字段', () => {
    for (const key of ['matched', 'features', 'id', 'name', 'summary', 'description', 'route'] as const) {
      expect(GUIDE_RESULT_KEYS[key]).toBe(key)
    }
  })
})
