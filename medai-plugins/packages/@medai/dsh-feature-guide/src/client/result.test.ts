/**
 * G3-C1 红阶段：契约 ② 结果解析测试（TDD：先写失败测试）。
 *
 * 解析语义（卡片消费方，纯函数）：
 * - 合法 JSON 且字段完整 → GuideResultView；
 * - 非法 JSON / 字段缺失 → null（降级态：卡片落通用工具行）；
 * - MCP 转义（`\"`）兜底去转义重解（对齐 ui-report-card parseToolResult 经验）。
 *
 * @module @medai/dsh-feature-guide/client/result.test
 */

import { describe, expect, it } from 'vitest'
import { parseGuideResult } from './result.js'

describe('G3 契约②结果解析 parseGuideResult', () => {
  it('parse_合法命中结果_应解析出features数组', () => {
    const text = JSON.stringify({
      matched: true,
      features: [
        { id: 'qc-emr-quality', name: 'EMR病历质控', summary: 's', description: 'd', route: '/qc/emr-quality' },
      ],
    })
    const result = parseGuideResult(text)
    expect(result).not.toBeNull()
    expect(result!.matched).toBe(true)
    expect(result!.features.length).toBe(1)
    expect(result!.features[0].route).toBe('/qc/emr-quality')
  })

  it('parse_合法未命中_应解析matched=false', () => {
    const text = JSON.stringify({ matched: false, features: [], hint: '系统暂未收录该功能，可将需求反馈给信息科' })
    const result = parseGuideResult(text)
    expect(result).not.toBeNull()
    expect(result!.matched).toBe(false)
    expect(result!.features).toEqual([])
  })

  it('parse_非法JSON_应返回null降级', () => {
    expect(parseGuideResult('not a json')).toBeNull()
    expect(parseGuideResult('')).toBeNull()
    expect(parseGuideResult(null as never)).toBeNull()
  })

  it('parse_字段缺失_应返回null降级', () => {
    expect(parseGuideResult(JSON.stringify({ matched: true }))).toBeNull()
    expect(
      parseGuideResult(JSON.stringify({ matched: true, features: [{ id: 'x' }] })),
    ).toBeNull()
    expect(
      parseGuideResult(JSON.stringify({ matched: 'yes', features: [] })),
    ).toBeNull()
  })

  it('parse_MCP转义_应去转义重解', () => {
    const escaped = '{\\"matched\\":true,\\"features\\":[{\\"id\\":\\"x\\",\\"name\\":\\"n\\",\\"summary\\":\\"s\\",\\"description\\":\\"d\\",\\"route\\":\\"/x\\"}]}'
    const result = parseGuideResult(escaped)
    expect(result).not.toBeNull()
    expect(result!.matched).toBe(true)
  })
})
