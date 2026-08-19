/**
 * SKILL.md frontmatter schema 校验器（F1，US-1.1；T1.1）。
 *
 * 校验项：
 *   1. skillDir 下存在 SKILL.md；
 *   2. frontmatter 合法（YAML 简化解析：`---` 包裹、`key: value` 行）；
 *   3. name/description/whenToUse 非空（requireWhenToUse 可关——历史 skill
 *      无 whenToUse 字段，真实目录整体校验用宽松模式）；
 *   4. name 形状合法（小写字母数字连字符）；
 *   5. 文档中引用的 `medai_[a-z_]+` 工具名在 {@link ALLOWED_TOOLS} 白名单内。
 *
 * 零崩溃：任何异常 → 结构化错误清单返回。
 *
 * @module @medai/dsh-flow-validator/manifest
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ALLOWED_TOOLS } from './coverage.js'

/** 校验选项。 */
export interface ManifestValidateOptions {
  /** 是否要求 whenToUse 非空（新剧本规范默认 true；历史 skill 宽松校验传 false）。 */
  requireWhenToUse?: boolean
}

/** 校验结果（ok=false 时 errors 为结构化错误清单）。 */
export interface ValidationResult {
  ok: boolean
  errors: string[]
  /** 剧本目录名（诊断友好）。 */
  skillDir?: string
  /** 引用的工具清单（诊断友好）。 */
  toolRefs?: string[]
}

/** frontmatter 解析结果。 */
export interface ParsedFrontmatter {
  frontmatter: Record<string, string>
  body: string
}

/** 解析 YAML frontmatter（简化：`---` 包裹 + `key: value` 行；去首尾引号）。 */
export function parseFrontmatter(text: string): ParsedFrontmatter | null {
  const m = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text)
  if (!m) return null
  const frontmatter: Record<string, string> = {}
  for (const line of m[1].split(/\r?\n/)) {
    const idx = line.indexOf(':')
    if (idx <= 0) continue
    const key = line.slice(0, idx).trim()
    let value = line.slice(idx + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (key !== '') frontmatter[key] = value
  }
  return { frontmatter, body: text.slice(m[0].length) }
}

/** 提取文档中的 medai_* 工具引用（去重，保持出现顺序）。 */
export function extractToolRefs(text: string): string[] {
  return [...new Set(text.match(/medai_[a-z_]+/g) ?? [])]
}

/**
 * 校验一个剧本目录（SKILL.md frontmatter + 工具白名单）。
 * @param skillDir 剧本目录（含 SKILL.md）
 * @param options requireWhenToUse 默认 true（新剧本标准）
 */
export function validateSkillManifest(skillDir: string, options: ManifestValidateOptions = {}): ValidationResult {
  const requireWhenToUse = options.requireWhenToUse ?? true
  const errors: string[] = []

  let text: string
  try {
    text = readFileSync(join(skillDir, 'SKILL.md'), 'utf8')
  } catch {
    return { ok: false, errors: [`无法读取 ${join(skillDir, 'SKILL.md')}（文件不存在或不可读）`], skillDir }
  }

  const parsed = parseFrontmatter(text)
  if (parsed === null) {
    return { ok: false, errors: ['SKILL.md 缺少 YAML frontmatter（文件必须以 --- 开头且含闭包）'], skillDir }
  }
  const fm = parsed.frontmatter

  const requiredKeys = requireWhenToUse
    ? (['name', 'description', 'whenToUse'] as const)
    : (['name', 'description'] as const)
  for (const key of requiredKeys) {
    if (typeof fm[key] !== 'string' || fm[key].trim() === '') {
      errors.push(`frontmatter 缺少必填字段 ${key}`)
    }
  }

  const name = fm.name?.trim() ?? ''
  if (name !== '' && !/^[a-z0-9][a-z0-9-]*$/.test(name)) {
    errors.push(`name 非法：${name}（须为小写字母/数字/连字符）`)
  }

  // 工具引用白名单校验（全文，含 frontmatter 与正文）
  const toolRefs = extractToolRefs(text)
  for (const ref of toolRefs) {
    if (!ALLOWED_TOOLS.has(ref)) {
      errors.push(`引用非白名单工具：${ref}（允许集见 coverage.ALLOWED_TOOLS）`)
    }
  }

  return { ok: errors.length === 0, errors, skillDir, toolRefs }
}
