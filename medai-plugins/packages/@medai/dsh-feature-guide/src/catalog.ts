/**
 * G1 功能目录：系统功能/能力元数据清单 + 确定性检索（纯数据 + 纯函数，零依赖）。
 *
 * 两类条目（2026-08-18 起）：
 * - 页面功能条目：route 对应前端 router/index.js 业务路由（2026-08-17 提取，catalog.test.ts 漂移告警）；
 * - 能力条目（consultation/ward-round-records 等文书生成类）：route 复用承载页面（/medical-records 或
 *   /ai-assistant），aliases 覆盖"语义重排型"用户说法（如"请内分泌科会诊"→ 请会诊记录模板），
 *   description 指引 medai_record_generate 对应模板——新增能力模板时同步补此类条目（同类缺口排查）。
 *
 * SoC 铁律：
 * - G1 不感知对话、UI、协议——清单增删只动本文件一处；
 * - `permission` 仅展示标注，不参与任何拦截决策（权限唯一归属 G4 路由守卫）；
 * - 数据与检索算法分离：检索见 {@link searchFeatures}，v2 后端目录仅替换数据源实现。
 *
 * @module @medai/dsh-feature-guide/catalog
 */

/** 功能元数据（对齐前端 router/index.js 业务路由，2026-08-17 提取）。 */
export interface FeatureEntry {
  /** 稳定标识（如 'qc-emr-quality'）。 */
  id: string
  /** 功能名（对齐前端路由 name）。 */
  name: string
  /** 别名（用户常见说法，检索命中源）。 */
  aliases: string[]
  /** 一句话说明。 */
  summary: string
  /** 详细说明（回复给用户的主体文案）。 */
  description: string
  /** 前端路由（G4 跳转目标，站内白名单依据）。 */
  route: string
  /** 仅展示标注（"需 XX 权限"）；拦截由前端路由守卫兜底。 */
  permission?: string
}

/** 功能目录检索接口（G1↔G2 契约 ①；v2 后端实现同接口替换）。 */
export interface FeatureCatalog {
  search(query: string): FeatureEntry[]
}

/** 静态清单（单一事实源；与前端 router/index.js 逐项核对——catalog.test.ts 漂移告警）。 */
export const FEATURE_ENTRIES: FeatureEntry[] = [
  {
    id: 'patients',
    name: '病人列表',
    aliases: ['患者列表', '住院病人', '病人管理', '患者管理'],
    summary: '全院/科室在院病人一览与筛选。',
    description: '展示住院病人列表，支持按科室、床号等条件筛选，是进入病人详情、病历与检查报告的入口。',
    route: '/patients',
  },
  {
    id: 'patient-search',
    name: '病人查询',
    aliases: ['患者查询', '查找病人', '搜索病人', '查找患者'],
    summary: '按条件检索病人并定位。',
    description: '按姓名、住院号、科室等条件检索病人，快速定位目标患者并进入其详情。',
    route: '/patient-search',
  },
  {
    id: 'medical-records',
    name: '病历管理',
    aliases: ['病历', '电子病历', '病历文书', '病历记录'],
    summary: '病历文书的查看与管理。',
    description: '查看和管理病人的病历文书（入院记录、病程记录等），支持按时间线浏览与编辑。',
    route: '/medical-records',
  },
  {
    id: 'examination-reports',
    name: '检查报告',
    aliases: ['检查结果', '检查报告查询', '检验报告', '检查记录'],
    summary: '检验检查报告集中查看。',
    description: '集中查看病人的检验与检查报告，含结果明细与异常指标高亮。',
    route: '/examination-reports',
  },
  {
    id: 'ai-assistant',
    name: 'AI诊断',
    aliases: ['AI诊断辅助', '智能诊断', '诊断助手', 'AI问诊'],
    summary: 'AI 辅助诊断分析工作台。',
    description: 'AI 辅助诊断工作台：提交诊断分析任务并查看 AI 生成的诊断建议与审查结果。',
    route: '/ai-assistant',
  },
  {
    id: 'data-import',
    name: '数据导入',
    aliases: ['导入数据', '数据同步'],
    summary: '批量导入系统数据。',
    description: '批量导入外部数据（病历、字典等）到系统，含导入结果校验与进度反馈。',
    route: '/data-import',
  },
  {
    id: 'ai-settings',
    name: 'AI设置',
    aliases: ['AI配置', '模型设置'],
    summary: 'AI 模型与参数配置。',
    description: '配置 AI 模型接入、提示词与参数等运行设置。',
    route: '/ai-settings',
    permission: 'CONFIG_MANAGE',
  },
  {
    id: 'patient-profile',
    name: '病人画像',
    aliases: ['患者画像', '病人全景', '患者全景'],
    summary: '单个病人的全景信息视图。',
    description: '单个病人的全景画像：基本信息、在院状态、病历、检查、诊断与用药的聚合视图。',
    route: '/patient-profile/:patientId',
  },
  {
    id: 'user-settings',
    name: '用户设置',
    aliases: ['个人设置', '账号设置'],
    summary: '个人账号与偏好设置。',
    description: '管理个人账号信息与系统使用偏好设置。',
    route: '/user-settings',
  },
  {
    id: 'rbac-admin',
    name: '权限管理',
    aliases: ['角色权限', '用户权限管理', 'RBAC'],
    summary: '用户、角色与科室权限管理。',
    description: '管理系统用户、角色与科室权限分配（RBAC），控制各功能页面的访问权限。',
    route: '/admin/rbac',
    permission: 'USER_MANAGE / DEPARTMENT_MANAGE / ROLE_MANAGE',
  },
  {
    id: 'deploy-config',
    name: '部署配置',
    aliases: ['部署管理', '系统部署'],
    summary: '系统部署与运行配置。',
    description: '管理系统的部署与运行配置项（服务器、服务开关等）。',
    route: '/admin/deploy-config',
    permission: 'CONFIG_MANAGE',
  },
  {
    id: 'help',
    name: '帮助文档',
    aliases: ['使用帮助', '操作指南', '帮助页面', '使用说明'],
    summary: '系统操作帮助与使用指南。',
    description: '系统各功能模块的操作帮助文档与使用指南，可按关键词检索。',
    route: '/help',
  },
  {
    id: 'server-maintenance',
    name: '服务器维护',
    aliases: ['维护', '服务器管理'],
    summary: '服务器状态查看与维护。',
    description: '查看主服务器与执行服务器运行状态，执行维护操作。',
    route: '/server-maintenance',
    permission: 'CONFIG_MANAGE',
  },
  {
    id: 'surgical-dictionary',
    name: '手术字典维护',
    aliases: ['手术字典', '手术名称字典', '手术目录'],
    summary: '手术名称字典维护。',
    description: '维护手术名称字典，供病历与质控模块引用标准手术名称。',
    route: '/surgical-dictionary',
  },
  {
    id: 'system-update',
    name: '系统更新',
    aliases: ['更新', '版本更新'],
    summary: '系统版本更新管理。',
    description: '查看系统版本并执行版本更新操作。',
    route: '/update',
    permission: 'CONFIG_MANAGE',
  },
  {
    id: 'qc-repeat-operation',
    name: '非计划再次手术分析',
    aliases: ['非计划再次手术', '重返手术', '再次手术分析', '质控'],
    summary: '质控分析——非计划再次手术。',
    description: '质控分析页面：统计与分析住院期间的非计划再次手术病例，辅助手术质量改进。',
    route: '/qc/repeat-operation',
  },
  {
    id: 'qc-indicator-statistics',
    name: '科室质控指标统计',
    aliases: ['质控指标统计', '科室指标', '质控统计', '质控'],
    summary: '科室质控指标统计报表。',
    description: '按科室统计质控指标（如病历合格率、时限达标率等），支持多维度筛选与图表展示。',
    route: '/qc/indicator-statistics',
  },
  {
    id: 'qc-emr-quality',
    name: 'EMR病历质控',
    aliases: ['病历质控', '质控', '病历内涵质控', 'EMR质控'],
    summary: '对病历文书进行内涵质控与评分。',
    description: '按质控标准对电子病历文书进行内涵质控检查与评分，列出缺陷项与整改建议，支持按患者逐份核查。',
    route: '/qc/emr-quality',
  },
  {
    id: 'department-statistics',
    name: '科室统计',
    aliases: ['科室数据统计', '统计报表'],
    summary: '科室维度数据统计工具。',
    description: '按科室维度统计业务数据（病人数、工作量等），生成统计报表。',
    route: '/department-statistics',
  },
  {
    id: 'tr-demo',
    name: '教研室数据DEMO',
    aliases: ['教研室', '数据DEMO', '演示数据'],
    summary: '教研室数据演示环境。',
    description: '教研室场景的数据演示页面，用于教学展示。',
    route: '/tr-demo',
  },
  {
    id: 'consultation',
    name: '会诊申请（请会诊记录）',
    aliases: ['会诊', '请会诊', '会诊申请', '会诊记录', '请会诊记录', '专科会诊', '内分泌科会诊', '心内科会诊', '神经内科会诊', '呼吸科会诊', '邀请会诊'],
    summary: '生成《请会诊记录》文书草稿（AI 辅助）。',
    description: '支持会诊申请：经 AI 辅助生成《请会诊记录》文书。在对话中说明会诊科室与目的（如"请内分泌科会诊，评估血糖控制方案"），助手可调用 medai_record_generate（模板"请会诊记录"，附会诊目的/病情摘要，系统自动脱敏）生成文书草稿，完整结果请在工作站 AI 辅助界面查看。会诊流程本身（通知/安排/会诊意见）由科室间人工协调，AI 只生成文书。',
    route: '/ai-assistant',
  },
  {
    id: 'ward-round-records',
    name: '查房记录/病程记录生成',
    aliases: ['查房记录', '写查房记录', '查房', '病程记录', '日常病程', '上级医师查房', '主任查房', '主治查房', '病程'],
    summary: 'AI 辅助生成查房记录与日常病程记录。',
    description: '支持查房记录/病程记录生成：说明患者与查房要点（病情变化、查体、检查回报、医嘱调整依据），助手可调用 medai_record_generate（模板"上级医师查房记录"/"病程记录"）生成草稿，完整结果请在工作站 AI 辅助界面查看，审核后正式保存。',
    route: '/medical-records',
  },
  {
    id: 'preop-documents',
    name: '术前文书生成',
    aliases: ['术前讨论', '术前讨论记录', '术前小结', '术前访视', '手术记录', '写术前讨论', '手术文书', '术前评估'],
    summary: 'AI 辅助生成术前讨论/术前小结/手术记录等文书。',
    description: '支持术前文书生成：说明患者与手术信息，助手可调用 medai_record_generate（模板"术前讨论记录"/"术前小结"/"术前访视记录"/"手术记录"）按数据库 Prompt 模板约束生成草稿，完整结果请在工作站 AI 辅助界面查看，审核后正式保存。',
    route: '/ai-assistant',
  },
  {
    id: 'discharge-documents',
    name: '出院文书生成',
    aliases: ['出院小结', '出院记录', '出院证明', '出院证明书', '写出院小结'],
    summary: 'AI 辅助生成出院小结/出院证明书。',
    description: '支持出院文书生成：助手可调用 medai_record_generate（模板"出院小结"/"出院证明书"）汇总全病程生成草稿，完整结果请在工作站 AI 辅助界面查看，审核后正式保存。',
    route: '/medical-records',
  },
  {
    id: 'admission-documents',
    name: '入院文书生成',
    aliases: ['入院记录', '首次病程记录', '首程', '写首程', '入院记录总结', '现病史', '问诊记录'],
    summary: 'AI 辅助生成入院记录/首次病程记录等入院文书。',
    description: '支持入院文书生成：助手可调用 medai_record_generate（模板"入院记录"/"首次病程记录"/"入院记录总结"/"现病史"）生成草稿（首程 8h、入院记录 24h 时限），完整结果请在工作站 AI 辅助界面查看，审核后正式保存。',
    route: '/medical-records',
  },
  {
    id: 'transfer-record',
    name: '转科记录生成',
    aliases: ['转科', '转科申请', '转科记录', '办理转科', '转呼吸内科', '转呼吸科', '转心内科', '转神经内科', '转到其他科室', '转病区'],
    summary: 'AI 辅助生成《转科记录》文书草稿。',
    description: '支持转科记录生成：说明转科去向与原因（如"转呼吸内科，因肺部感染加重"），助手可调用 medai_record_generate（模板"转科记录"，附转科原因，系统自动脱敏）生成文书草稿，完整结果请在工作站 AI 辅助界面查看。',
    route: '/medical-records',
  },
  {
    id: 'discussion-documents',
    name: '病例讨论记录生成',
    aliases: ['病例讨论', '疑难病例讨论', '危重病例讨论', '多学科讨论', 'MDT', '讨论记录', '讨论材料', '病例讨论材料'],
    summary: 'AI 辅助生成多学科/疑难病例讨论记录草稿。',
    description: '支持病例讨论记录生成：助手汇总病史+检验+检查材料并调用 medai_record_generate（模板"多学科讨论记录"/"四级手术术前多学科讨论记录"）生成讨论记录草稿，完整结果请在工作站 AI 辅助界面查看，审核后正式保存。',
    route: '/ai-assistant',
  },
]

/** 检索权重：名称 > 别名 > 描述关键词。 */
const SCORE_NAME = 2
const SCORE_ALIAS = 1
const SCORE_DESCRIPTION = 0.5

/**
 * 单条目命中打分（纯函数；非命中返回 0）。
 * 双向子串匹配：短 query 命中条目词（"病历质控"）；长 query（整句消息）包含条目词
 * （"我需要一个病历质控的功能"）——两种调用方向共用同一检索语义。
 */
export function scoreFeature(entry: FeatureEntry, query: string): number {
  if (query === '') return 0
  const q = query.toLowerCase()
  const name = entry.name.toLowerCase()
  if (name.includes(q) || q.includes(name)) return SCORE_NAME
  if (entry.aliases.some((a) => {
    const alias = a.toLowerCase()
    return alias.includes(q) || q.includes(alias)
  })) return SCORE_ALIAS
  const hay = `${entry.summary} ${entry.description}`.toLowerCase()
  if (hay.includes(q) || q.includes(hay)) return SCORE_DESCRIPTION
  return 0
}

/**
 * 确定性检索（纯函数）：打分 → 去重 → 稳定排序（分数降序；同分按清单顺序）。
 * 未命中/空 query 返回空数组，不抛异常。
 */
export function searchFeatures(entries: readonly FeatureEntry[], query: string): FeatureEntry[] {
  if (typeof query !== 'string' || query.trim() === '') return []
  const q = query.trim()
  return entries
    .map((entry, index) => ({ entry, score: scoreFeature(entry, q), index }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((r) => r.entry)
}

/** 构建静态目录（契约 ① FeatureCatalog 实现；v2 后端目录同接口替换）。 */
export function createStaticCatalog(entries: readonly FeatureEntry[]): FeatureCatalog {
  return {
    search(query: string): FeatureEntry[] {
      return searchFeatures(entries, query)
    },
  }
}

/** 默认目录实例（G2 工具与意图检测共用同一检索语义）。 */
export const FEATURE_CATALOG: FeatureCatalog = createStaticCatalog(FEATURE_ENTRIES)
