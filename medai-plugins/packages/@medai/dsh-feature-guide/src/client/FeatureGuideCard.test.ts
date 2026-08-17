/**
 * G3-C2 红阶段：FeatureGuideCard 渲染测试（TDD：先写失败测试）。
 *
 * 渲染语义（卡片四态）：
 * - 命中：功能名 + summary + 可展开 description + 「跳转到该页面」按钮（每项功能）；
 * - 未命中：引导文案（hint），无跳转按钮；
 * - 降级态（解析失败）：占位文案，落通用工具行语义；
 * - permission 标注：展示"需 XX 权限"文案，按钮仍在（G3 不判权限）。
 *
 * 测试方式：react-dom/server renderToStaticMarkup（workspace 无 jsdom/testing-library，
 * node 环境即可渲染字符串断言；整行折叠逻辑薄映射——展开体 FeatureGuideBody 独立纯渲染）。
 *
 * @module @medai/dsh-feature-guide/client/FeatureGuideCard.test
 */

import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { FeatureGuideBody } from './FeatureGuideCard.js'
import type { GuideResultView } from './result.js'

function renderBody(result: GuideResultView): string {
  return renderToStaticMarkup(createElement(FeatureGuideBody, { result, onNavigate: () => {} }))
}

function matchedResult(): GuideResultView {
  return {
    matched: true,
    features: [
      {
        id: 'qc-emr-quality',
        name: 'EMR病历质控',
        summary: '对病历文书进行内涵质控与评分。',
        description: '按质控标准对电子病历文书进行内涵质控检查与评分，列出缺陷项与整改建议。',
        route: '/qc/emr-quality',
      },
    ],
  }
}

describe('G3 FeatureGuideCard 渲染', () => {
  it('card_命中_应渲染名称summary描述与跳转按钮', () => {
    const html = renderBody(matchedResult())
    expect(html).toContain('EMR病历质控')
    expect(html).toContain('对病历文书进行内涵质控与评分')
    expect(html).toContain('跳转到该页面')
  })

  it('card_未命中_应渲染引导文案', () => {
    const html = renderBody({ matched: false, features: [], hint: '系统暂未收录该功能，可将需求反馈给信息科' })
    expect(html).toContain('未找到对应功能')
    expect(html).toContain('系统暂未收录该功能')
    expect(html).not.toContain('跳转到该页面')
  })

  it('card_降级态_应渲染占位文案', () => {
    const html = renderToStaticMarkup(
      createElement(FeatureGuideBody, { result: null, onNavigate: () => {} }),
    )
    expect(html).toContain('结果不可解析')
    expect(html).not.toContain('跳转到该页面')
  })

  it('card_permission_应展示标注不拦截', () => {
    const result = matchedResult()
    result.features[0].permission = 'CONFIG_MANAGE'
    const html = renderBody(result)
    expect(html).toContain('需 CONFIG_MANAGE 权限')
    expect(html).toContain('跳转到该页面') // 标注不拦截：按钮仍在（拦截在 G4 守卫）
  })

  it('card_多命中_应逐项渲染', () => {
    const result = matchedResult()
    result.features.push({
      id: 'qc-indicator-statistics',
      name: '科室质控指标统计',
      summary: '科室质控指标统计报表。',
      description: '按科室统计质控指标。',
      route: '/qc/indicator-statistics',
    })
    const html = renderBody(result)
    expect(html).toContain('EMR病历质控')
    expect(html).toContain('科室质控指标统计')
    expect(html.match(/跳转到该页面/g)?.length).toBe(2)
  })
})
