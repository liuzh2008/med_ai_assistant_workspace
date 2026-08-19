/**
 * 35 步流程覆盖矩阵（F1，US-1.2；对齐方案《医生工作流程DSH结合实施方案》§10
 * 与《住院部医生日常工作流程》§2 的 #1-#35）。
 *
 * 数据源：
 *   - STEP_NAMES：35 步步骤名（流程文档 §2）；
 *   - STEP_FLAGS：AI 介入评级（方案文档 §10 清单表：✅ 工具已具备 / 🟡 需新增或
 *     外部依赖 / ⚪ 不介入）；不介入组 = #8 文书签名、#21 手术知情同意、#35 医保审核；
 *   - SCRIPT_STEPS：10 个剧本 ↔ 步骤覆盖（方案 §3.1 F1 剧本集 + 本包维护修正）：
 *     admission-record→#1-#7、ward-round→#10-#13、preop-discussion→#18-#25（显式
 *     排除 ⚪#21）、discharge-summary→#26-#31、handover→#9/#33、critical-value→
 *     #14/#34、consultation→#15、discussion-material→#17、time-limit-monitor→
 *     #32（+补充 #16 病情告知/知情同意待办提醒——同属 F2c 罗盘待办类，原映射遗漏
 *     导致 US-1.2 需介入全覆盖校验红）、medical-record-save→全流程保存（具体化为
 *     正式病历落库涉及的文书步骤）。
 *
 * 校验规则（US-1.2 验收）：需 AI 介入（✅/🟡）的步骤至少被一个剧本引用；
 * 不介入组（⚪：#8/#21/#35）不被任何剧本引用。
 *
 * @module @medai/dsh-flow-validator/coverage
 */

/** medai_* 工具白名单（方案 §10 工具列 + 本轮新增；剧本引用不得越界）。 */
export const ALLOWED_TOOLS: ReadonlySet<string> = new Set([
  'medai_record_generate',
  'medai_record_status',
  'medai_record_generate_sync',
  'medai_patient_list_by_department',
  'medai_patient_basic_info',
  'medai_patient_diagnoses',
  'medai_patient_orders',
  'medai_medical_records',
  'medai_lab_results',
  'medai_exam_results',
  'medai_diagnosis_analyze',
  'medai_diagnosis_review',
  'medai_diagnosis_status',
  'medai_patient_flow_status',
  'medai_due_documents',
])

/** 35 步步骤名（《住院部医生日常工作流程》§2）。 */
export const STEP_NAMES: Readonly<Record<number, string>> = {
  1: '接触病人/入院信息汇总',
  2: '问诊',
  3: '查体',
  4: '初步诊断/鉴别诊断',
  5: '开入院医嘱',
  6: '写入院记录（24h）',
  7: '写首次病程记录（8h）',
  8: '文书签名',
  9: '晨交班',
  10: '查房',
  11: '查房后调医嘱',
  12: '写查房记录/日常病程记录',
  13: '检查检验结果追踪',
  14: '危急值处理',
  15: '会诊',
  16: '病情告知/知情同意',
  17: '疑难/危重病例讨论',
  18: '术前评估',
  19: '术前讨论',
  20: '术前小结',
  21: '手术知情同意',
  22: '术前医嘱',
  23: '手术记录',
  24: '术后首次病程记录',
  25: '术后每日病程/换药拆线',
  26: '出院评估',
  27: '出院医嘱',
  28: '出院小结',
  29: '病案首页填写',
  30: '健康宣教/随访',
  31: '病历质控与归档',
  32: '文书时限监控',
  33: '值班/交接班',
  34: '危急值闭环',
  35: '医保/处方审核',
}

/** 35 步 AI 介入评级（方案文档 §10 清单表；⚪ = 不介入）。 */
export const STEP_FLAGS: Readonly<Record<number, '✅' | '🟡' | '⚪'>> = {
  1: '🟡', 2: '✅', 3: '✅', 4: '✅', 5: '🟡', 6: '✅', 7: '✅', 8: '⚪',
  9: '🟡', 10: '✅', 11: '🟡', 12: '✅', 13: '✅', 14: '🟡', 15: '✅', 16: '🟡', 17: '✅',
  18: '🟡', 19: '✅', 20: '✅', 21: '⚪', 22: '🟡', 23: '✅', 24: '✅', 25: '🟡',
  26: '🟡', 27: '🟡', 28: '✅', 29: '🟡', 30: '🟡', 31: '✅',
  32: '🟡', 33: '🟡', 34: '🟡', 35: '⚪',
}

/** 不介入组（AI 不应做/无需做；校验不得被剧本引用）。 */
export const NO_AI_STEPS: ReadonlySet<number> = new Set([8, 21, 35])

/**
 * 10 个剧本 ↔ 步骤覆盖。
 * - preop-discussion 显式排除 ⚪#21（区间 #18-#25 去掉 #21）；
 * - time-limit-monitor 补充 #16（病情告知/知情同意待办提醒，F2c 罗盘待办类，
 *   原方案映射仅列 #32；不补则 US-1.2 需介入全覆盖校验失败）；
 * - medical-record-save 具体化"全流程保存"为正式病历落库涉及的文书步骤。
 */
export const SCRIPT_STEPS: Readonly<Record<string, readonly number[]>> = {
  'admission-record': [1, 2, 3, 4, 5, 6, 7],
  'ward-round': [10, 11, 12, 13],
  'preop-discussion': [18, 19, 20, 22, 23, 24, 25],
  'discharge-summary': [26, 27, 28, 29, 30, 31],
  'handover': [9, 33],
  'critical-value': [14, 34],
  'consultation': [15],
  'discussion-material': [17],
  'time-limit-monitor': [32, 16],
  'medical-record-save': [6, 7, 12, 19, 20, 23, 24, 28, 31],
}

/** 矩阵中单步（含被哪些剧本覆盖）。 */
export interface FlowStep {
  id: number
  name: string
  flag: '✅' | '🟡' | '⚪'
  scripts: string[]
}

/** 覆盖矩阵（coverageMatrix() 返回；script=矩阵标题，steps=35 步明细，scripts=剧本映射）。 */
export interface CoverageMatrix {
  script: string
  steps: FlowStep[]
  scripts: Record<string, readonly number[]>
}

/**
 * 声明 35 步 ↔ 剧本覆盖矩阵（每步标注名称/评级/覆盖剧本）。
 */
export function coverageMatrix(): CoverageMatrix {
  const steps: FlowStep[] = []
  for (let id = 1; id <= 35; id++) {
    const name = STEP_NAMES[id]
    if (!name) throw new Error(`覆盖矩阵声明不完整：缺少步骤 #${id} 的名称`)
    const flag = STEP_FLAGS[id]
    if (!flag) throw new Error(`覆盖矩阵声明不完整：缺少步骤 #${id} 的评级`)
    steps.push({
      id,
      name,
      flag,
      scripts: Object.entries(SCRIPT_STEPS)
        .filter(([, ids]) => ids.includes(id))
        .map(([script]) => script),
    })
  }
  return { script: '住院部医生日常工作流程（入院 → 出院，35 步）', steps, scripts: SCRIPT_STEPS }
}

/** 覆盖校验结果。 */
export interface CoverageValidation {
  ok: boolean
  errors: string[]
  /** 需 AI 介入但无剧本覆盖的步骤（US-1.2 缺口清单）。 */
  uncovered: number[]
  /** 不介入（⚪）却被剧本错误引用的步骤。 */
  wronglyCovered: number[]
  totalSteps: number
  coveredSteps: number
}

/**
 * 校验覆盖完整性：需 AI 介入（✅/🟡）步骤至少被一个剧本引用；
 * 不介入组（⚪：#8/#21/#35）不被引用。
 *
 * 覆盖计算以 mx.scripts（剧本映射）为唯一事实源重算每步覆盖——不依赖
 * mx.steps 的预计算字段，保证调用方修改 scripts 后校验真实生效。
 */
export function validateCoverage(mx: CoverageMatrix = coverageMatrix()): CoverageValidation {
  const uncovered: number[] = []
  const wronglyCovered: number[] = []
  for (const step of mx.steps) {
    const coveredBy = Object.entries(mx.scripts)
      .filter(([, ids]) => ids.includes(step.id))
      .map(([script]) => script)
    if (step.flag === '⚪') {
      if (coveredBy.length > 0) wronglyCovered.push(step.id)
    } else if (coveredBy.length === 0) {
      uncovered.push(step.id)
    }
  }
  const errors: string[] = []
  if (uncovered.length > 0) {
    errors.push(`需 AI 介入但无剧本覆盖的步骤：${uncovered.map((id) => `#${id} ${STEP_NAMES[id]}`).join('、')}`)
  }
  if (wronglyCovered.length > 0) {
    errors.push(`不介入步骤被剧本错误引用：${wronglyCovered.map((id) => `#${id} ${STEP_NAMES[id]}`).join('、')}`)
  }
  return {
    ok: errors.length === 0,
    errors,
    uncovered,
    wronglyCovered,
    totalSteps: mx.steps.length,
    coveredSteps: mx.steps.length - uncovered.length,
  }
}
