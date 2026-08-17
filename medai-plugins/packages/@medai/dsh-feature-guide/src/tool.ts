/**
 * G2-C3 medai_feature_guide 工具定义与执行（纯函数，可测）。
 *
 * 契约 ②（G2↔G3）：{ matched, features:[{id,name,summary,description,route,permission?}], hint? }
 * - 执行体只调 G1 目录接口（FeatureCatalog.search），不感知 UI/跳转（SoC 铁律）；
 * - 目录异常/非法入参 → matched=false + 明示文案，不抛断（降级铁律）；
 * - 自声明 ToolDef 形状对齐 DSH ToolDefinition 运行时最小集（workspace 无法 import
 *   `@deepseek-ai/*`，DSH 环境运行时验证——GI-C1）。
 *
 * @module @medai/dsh-feature-guide/tool
 */

import type { FeatureCatalog, FeatureEntry } from './catalog.js'

/** 工具名（G3 toolview keyed slot 同名注册）。 */
export const TOOL_NAME = 'medai_feature_guide'

/** 工具 description（模型可见：明确触发时机——LLM 语义兜底靠它）。 */
export const TOOL_DESCRIPTION =
  '查询系统中是否已有某功能，返回功能说明与页面路由。当用户描述需求、索要功能、询问系统是否支持某能力、' +
  '或要求跳转/打开/进入某功能页面（如"跳转到 EMR病历质控 页面"）时调用；' +
  '返回的 route 用于渲染「跳转到该页面」按钮（用户点击后工作站当前页跳转）；' +
  '不要用浏览器工具直接访问系统内网页面（地址 http://127.0.0.1:3080 是 DSH 自身，非业务前端）。'

/** 未命中引导文案（需求反馈流程）。 */
export const NO_MATCH_HINT = '系统暂未收录该功能，可将需求反馈给信息科'

/** 目录异常明示文案。 */
export const CATALOG_ERROR_HINT = '功能目录暂不可用，请稍后重试'

/** 契约 ② 字段常量（G2 导出、G3 渲染解析共用口径，漂移即红）。 */
export const GUIDE_RESULT_KEYS = {
  matched: 'matched',
  features: 'features',
  id: 'id',
  name: 'name',
  summary: 'summary',
  description: 'description',
  route: 'route',
  permission: 'permission',
  hint: 'hint',
} as const

/** 契约 ② 单条功能（toolview 卡片渲染输入）。 */
export interface GuideFeature {
  id: string
  name: string
  summary: string
  description: string
  route: string
  permission?: string
}

/** 契约 ② 工具结果。 */
export interface GuideResult {
  matched: boolean
  features: GuideFeature[]
  hint?: string
}

/** 工具入参（parameters 声明 query 必填）。 */
export interface GuideArgs {
  query?: unknown
}

/** 条目 → 契约 ② feature（permission 仅标注透传）。 */
export function toGuideFeature(entry: FeatureEntry): GuideFeature {
  const feature: GuideFeature = {
    id: entry.id,
    name: entry.name,
    summary: entry.summary,
    description: entry.description,
    route: entry.route,
  }
  if (entry.permission !== undefined) feature.permission = entry.permission
  return feature
}

/** 命中结果组装（纯函数）。 */
export function buildGuideResult(hits: readonly FeatureEntry[]): GuideResult {
  if (hits.length === 0) {
    return { matched: false, features: [], hint: NO_MATCH_HINT }
  }
  return { matched: true, features: hits.map(toGuideFeature) }
}

/**
 * 工具执行（纯函数）：入参校验 → 目录检索 → 契约 ② 组装。
 * 目录异常/非法入参 → matched=false + 明示文案，不抛断。
 */
export function executeGuide(catalog: FeatureCatalog, args: unknown): GuideResult {
  const query = (args as GuideArgs | null | undefined)?.query
  if (typeof query !== 'string' || query.trim() === '') {
    return { matched: false, features: [], hint: NO_MATCH_HINT }
  }
  try {
    return buildGuideResult(catalog.search(query))
  } catch {
    return { matched: false, features: [], hint: CATALOG_ERROR_HINT }
  }
}

/** 自声明 ToolDef（DSH ToolDefinition 运行时最小形状）。 */
export interface ToolDef {
  name: string
  description: string
  parameters: Record<string, unknown>
  output: {
    schema: Record<string, unknown>
    render: (args: unknown, value: unknown) => Array<{ type: string; text: string }>
  }
  execute: (args: unknown, exec: unknown) => Promise<unknown>
}

/**
 * 构建工具定义：execute 返回 canonical value（契约 ②），render 投影为
 * 模型可见 JSON 文本（G3 卡片从 content text 解析同一契约）。
 *
 * 注意：parameters 必须是**完整 JSON Schema**（object 根）——DSH register 直接按
 * JSON Schema 校验（defineTool 的 DSL 形状只在 defineTool 内部转换；自声明路线
 * 直接给 JSON Schema）。2026-08-17 实测：DSL 形状导致
 * "Invalid schema for function ...: schema must be a JSON Schema of 'type: \"object\"'"。
 */
export function createToolDefinition(catalog: FeatureCatalog): ToolDef {
  return {
    name: TOOL_NAME,
    description: TOOL_DESCRIPTION,
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '用户的需求描述或功能名称' },
      },
      required: ['query'],
      additionalProperties: false,
    },
    output: {
      // canonical value 宽松对象声明（不约束字段，避免 schema 漂移风险）
      schema: { type: 'object', additionalProperties: true },
      render(_args: unknown, value: unknown) {
        return [{ type: 'text', text: JSON.stringify(value) }]
      },
    },
    async execute(args: unknown, _exec: unknown) {
      return executeGuide(catalog, args)
    },
  }
}
