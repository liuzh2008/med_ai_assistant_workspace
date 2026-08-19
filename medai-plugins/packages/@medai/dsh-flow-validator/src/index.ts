/**
 * @medai/dsh-flow-validator（F1 流程知识面校验器，US-1.1/1.2）。
 *
 * - validateSkillManifest：SKILL.md frontmatter schema 校验 + medai_* 工具白名单；
 * - coverageMatrix / validateCoverage：35 步 ↔ 10 剧本覆盖矩阵声明与完整性校验。
 *
 * @module @medai/dsh-flow-validator
 */

export {
  validateSkillManifest,
  parseFrontmatter,
  extractToolRefs,
  type ValidationResult,
  type ManifestValidateOptions,
  type ParsedFrontmatter,
} from './manifest.js'
export {
  ALLOWED_TOOLS,
  STEP_NAMES,
  STEP_FLAGS,
  NO_AI_STEPS,
  SCRIPT_STEPS,
  coverageMatrix,
  validateCoverage,
  type CoverageMatrix,
  type CoverageValidation,
  type FlowStep,
} from './coverage.js'
