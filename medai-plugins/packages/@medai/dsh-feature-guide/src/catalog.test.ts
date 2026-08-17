/**
 * G1-C1 红阶段：功能元数据清单测试（TDD：先写失败测试）。
 *
 * 清单单一事实源断言：
 * ① 覆盖前端 router/index.js 全部业务路由（2026-08-17 提取；剔除 /、/login、/main、/test）；
 * ② 无重复 id、route 非空；
 * ③ 字段完整（id/name/route 非空、aliases ≥1、summary/description 非空）；
 * ④ 文案无 PII（样值 + 正则口径对齐 @medai/dsh-pii-guard patterns）；
 * ⑤ permission 仅标注（string | undefined，不参与任何拦截逻辑——G1 零权限决策）。
 *
 * @module @medai/dsh-feature-guide/catalog.test
 */

import { describe, expect, it } from 'vitest'
import { FEATURE_ENTRIES } from './catalog.js'

/** 前端业务路由全集（router/index.js，2026-08-17 提取；共享夹具——路由变更时此测试即漂移告警）。 */
const EXPECTED_ROUTES: readonly string[] = [
  '/patients',
  '/patient-search',
  '/medical-records',
  '/examination-reports',
  '/ai-assistant',
  '/data-import',
  '/ai-settings',
  '/patient-profile/:patientId',
  '/user-settings',
  '/admin/rbac',
  '/admin/deploy-config',
  '/help',
  '/server-maintenance',
  '/surgical-dictionary',
  '/update',
  '/qc/repeat-operation',
  '/qc/indicator-statistics',
  '/qc/emr-quality',
  '/department-statistics',
  '/tr-demo',
]

/** PII 样本值（清单文案不得出现）。 */
const PII_SAMPLES = ['110101199001011234', '13800138000', 'ZY20260814001', '张伟', '李娜']

/** PII 正则口径（对齐 @medai/dsh-pii-guard patterns 的数字型兜底）。 */
const PII_PATTERNS = [
  /\b\d{17}[\dXx]\b/, // 身份证
  /\b1[3-9]\d{9}\b/, // 手机号
]

describe('G1 功能元数据清单', () => {
  it('catalog_清单_应覆盖前端全部业务路由', () => {
    const catalogRoutes = new Set(FEATURE_ENTRIES.map((e) => e.route))
    expect(catalogRoutes.size).toBe(EXPECTED_ROUTES.length)
    for (const route of EXPECTED_ROUTES) {
      expect(catalogRoutes.has(route)).toBe(true)
    }
  })

  it('catalog_清单_应无重复id且route非空', () => {
    const ids = FEATURE_ENTRIES.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const e of FEATURE_ENTRIES) {
      expect(e.route.length).toBeGreaterThan(0)
    }
  })

  it('catalog_清单_字段应完整', () => {
    for (const e of FEATURE_ENTRIES) {
      expect(e.id.length).toBeGreaterThan(0)
      expect(e.name.length).toBeGreaterThan(0)
      expect(e.aliases.length).toBeGreaterThanOrEqual(1)
      expect(e.summary.length).toBeGreaterThan(0)
      expect(e.description.length).toBeGreaterThan(0)
    }
  })

  it('catalog_清单_不应含PII', () => {
    const allText = FEATURE_ENTRIES
      .flatMap((e) => [e.name, e.summary, e.description, ...e.aliases])
      .join(' ')
    for (const sample of PII_SAMPLES) {
      expect(allText.includes(sample)).toBe(false)
    }
    for (const pattern of PII_PATTERNS) {
      expect(pattern.test(allText)).toBe(false)
    }
  })

  it('catalog_清单_permission仅标注不拦截', () => {
    for (const e of FEATURE_ENTRIES) {
      if (e.permission !== undefined) {
        expect(typeof e.permission).toBe('string')
        expect(e.permission.length).toBeGreaterThan(0)
      }
    }
  })
})
