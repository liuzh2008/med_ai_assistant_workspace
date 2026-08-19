/**
 * @medai/dsh-flow-validator 单测（T1.1 SkillManifestValidatorTest / T1.2 CoverageMatrixTest 对齐）。
 *
 * 覆盖：
 *   - validateSkillManifest 各失败分支（缺文件/无 frontmatter/缺字段/白名单外工具）+ 合法通过；
 *   - coverageMatrix 完整性：35 步全量、需介入全覆盖、不介入组不被引用（含破坏性用例）；
 *   - 真实 .dsh/skills 目录校验（目录存在时跑；全部剧本宽松合法 + 10 个新剧本严格合法）。
 */

import { afterAll, describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  SCRIPT_STEPS,
  STEP_NAMES,
  STEP_FLAGS,
  NO_AI_STEPS,
  coverageMatrix,
  validateCoverage,
  validateSkillManifest,
  type CoverageMatrix,
} from './index.js'

// ---------- 临时剧本目录工具 ----------

let tempDirs: string[] = []

function makeSkillDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'flow-validator-'))
  tempDirs.push(dir)
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content, 'utf8')
  }
  return dir
}

const VALID_SKILL = `---
name: admission-record
description: 入院接诊剧本：问诊清单→查体→诊断→医嘱→入院记录→首程
whenToUse: 患者新入院需要完成接诊与入院文书时
---

# 入院接诊

1. 调用 medai_patient_basic_info 获取患者信息
2. 调用 medai_record_generate 生成入院记录
`

afterAll(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true })
})

// ---------- validateSkillManifest ----------

describe('validateSkillManifest（T1.1 schema 校验）', () => {
  it('合法剧本 → ok，无错误', () => {
    const dir = makeSkillDir({ 'SKILL.md': VALID_SKILL })
    const result = validateSkillManifest(dir)
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.toolRefs).toContain('medai_patient_basic_info')
  })

  it('目录不存在 → ok=false + 可读错误', () => {
    const result = validateSkillManifest(join(tmpdir(), 'no-such-dir-xyz'))
    expect(result.ok).toBe(false)
    expect(result.errors.join('')).toContain('无法读取')
  })

  it('SKILL.md 无 frontmatter → ok=false', () => {
    const dir = makeSkillDir({ 'SKILL.md': '# 只有标题\n没有 frontmatter\n' })
    const result = validateSkillManifest(dir)
    expect(result.ok).toBe(false)
    expect(result.errors.join('')).toContain('frontmatter')
  })

  it('缺 name/description/whenToUse → 逐字段报错', () => {
    const dir = makeSkillDir({
      'SKILL.md': '---\nname: ward-round\n---\n正文',
    })
    const result = validateSkillManifest(dir)
    expect(result.ok).toBe(false)
    expect(result.errors).toContain('frontmatter 缺少必填字段 description')
    expect(result.errors).toContain('frontmatter 缺少必填字段 whenToUse')
  })

  it('whenToUse 可宽松（历史 skill 无该字段）', () => {
    const dir = makeSkillDir({ 'SKILL.md': '---\nname: legacy-skill\ndescription: 历史技能\n---\n正文' })
    // 默认严格模式：缺 whenToUse → 不通过
    expect(validateSkillManifest(dir).ok).toBe(false)
    // 宽松模式：只要求 name/description
    expect(validateSkillManifest(dir, { requireWhenToUse: false }).ok).toBe(true)
    // 显式严格模式：不通过
    expect(validateSkillManifest(dir, { requireWhenToUse: true }).ok).toBe(false)
  })

  it('引用白名单外工具 → ok=false + 指明工具名', () => {
    const dir = makeSkillDir({
      'SKILL.md': `---
name: bad-skill
description: 引用不存在工具
whenToUse: 测试
---
调用 medai_not_exist_tool 会怎样`,
    })
    const result = validateSkillManifest(dir)
    expect(result.ok).toBe(false)
    expect(result.errors.join('')).toContain('medai_not_exist_tool')
  })

  it('非法 name 形状 → ok=false', () => {
    const dir = makeSkillDir({
      'SKILL.md': '---\nname: Bad Name!\ndescription: x\nwhenToUse: y\n---\n正文',
    })
    const result = validateSkillManifest(dir)
    expect(result.ok).toBe(false)
    expect(result.errors.join('')).toContain('name 非法')
  })
})

// ---------- coverageMatrix / validateCoverage ----------

describe('coverageMatrix / validateCoverage（T1.2 覆盖矩阵）', () => {
  it('矩阵声明完整：35 步全量、id 连续、名称/评级非空', () => {
    const mx = coverageMatrix()
    expect(mx.steps).toHaveLength(35)
    expect(mx.steps.map((s) => s.id)).toEqual(Array.from({ length: 35 }, (_, i) => i + 1))
    for (const step of mx.steps) {
      expect(step.name).not.toBe('')
      expect(['✅', '🟡', '⚪']).toContain(step.flag)
    }
    expect(Object.keys(mx.scripts)).toHaveLength(10)
  })

  it('10 个剧本的步骤引用均在 1-35 内', () => {
    const mx = coverageMatrix()
    for (const [script, ids] of Object.entries(mx.scripts)) {
      expect(script).toMatch(/^[a-z0-9-]+$/)
      for (const id of ids) {
        expect(STEP_NAMES[id], `${script} 引用越界步骤 #${id}`).toBeTruthy()
      }
    }
  })

  it('需 AI 介入（✅/🟡）步骤至少被一个剧本引用；不介入组（⚪：#8/#21/#35）不被引用', () => {
    const result = validateCoverage()
    expect(result.ok).toBe(true)
    expect(result.uncovered).toEqual([])
    expect(result.wronglyCovered).toEqual([])
    expect(result.totalSteps).toBe(35)
    expect(result.coveredSteps).toBe(35)
  })

  it('破坏性用例：需介入步骤无剧本 / 不介入步骤被引用 → ok=false 且缺口清单正确', () => {
    const broken: CoverageMatrix = {
      ...coverageMatrix(),
      scripts: {
        ...coverageMatrix().scripts,
        'admission-record': [1, 2, 3, 4, 5, 6, 7, 8], // 错误引用 ⚪#8
      },
    }
    // 移除 #12 的覆盖（ward-round 去掉 12）
    broken.scripts = {
      ...broken.scripts,
      'ward-round': [10, 11, 13],
      'medical-record-save': [6, 7, 19, 20, 23, 24, 28, 31], // 去掉 12
    }
    const result = validateCoverage(broken)
    expect(result.ok).toBe(false)
    expect(result.uncovered).toContain(12)
    expect(result.wronglyCovered).toContain(8)
  })

  it('NO_AI_STEPS 与评级表一致（#8/#21/#35 为 ⚪）', () => {
    expect([...NO_AI_STEPS].sort((a, b) => a - b)).toEqual([8, 21, 35])
    for (const id of NO_AI_STEPS) {
      expect(STEP_FLAGS[id]).toBe('⚪')
      expect(STEP_FLAGS[id]).toBe('⚪')
    }
  })
})

// ---------- 真实 .dsh/skills 目录校验（存在则跑） ----------

const SKILLS_ROOT = 'D:\\MedAiAssistant 1.0 BS\\.dsh\\skills'
/** 本轮新增的 10 个流程剧本（严格模式：要求 whenToUse + 工具白名单）。 */
const NEW_SCRIPTS = [
  'admission-record',
  'ward-round',
  'preop-discussion',
  'discharge-summary',
  'handover',
  'critical-value',
  'consultation',
  'discussion-material',
  'time-limit-monitor',
  'medical-record-save',
]

const skillsExist = existsSync(SKILLS_ROOT)

describe('真实 .dsh/skills 目录校验', () => {
  const run = skillsExist ? it : it.skip

  run('全部剧本 SKILL.md frontmatter 宽松合法（name/description 非空 + 无白名单外 medai 引用）', () => {
    const dirs = readdirSync(SKILLS_ROOT, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => join(SKILLS_ROOT, d.name))
    expect(dirs.length).toBeGreaterThanOrEqual(21)

    const failures: string[] = []
    for (const dir of dirs) {
      if (!existsSync(join(dir, 'SKILL.md'))) {
        failures.push(`${dir}: 缺 SKILL.md`)
        continue
      }
      const result = validateSkillManifest(dir, { requireWhenToUse: false })
      if (!result.ok) failures.push(`${dir}: ${result.errors.join('; ')}`)
    }
    expect(failures).toEqual([])
  })

  run('本轮 10 个新剧本严格模式全部合法（含 whenToUse）且被矩阵登记', () => {
    const failures: string[] = []
    for (const name of NEW_SCRIPTS) {
      const dir = join(SKILLS_ROOT, name)
      if (!existsSync(dir)) {
        failures.push(`${name}: 剧本目录不存在`)
        continue
      }
      const result = validateSkillManifest(dir) // 严格模式
      if (!result.ok) failures.push(`${name}: ${result.errors.join('; ')}`)
      expect(SCRIPT_STEPS[name], `${name} 未登记到覆盖矩阵`).toBeTruthy()
    }
    expect(failures).toEqual([])
  })

  run('剧本目录名与矩阵 SCRIPT_STEPS 键一一对应', () => {
    const matrixScripts = new Set(Object.keys(SCRIPT_STEPS))
    for (const name of NEW_SCRIPTS) expect(matrixScripts.has(name)).toBe(true)
    expect(matrixScripts.size).toBe(NEW_SCRIPTS.length)
  })
})
