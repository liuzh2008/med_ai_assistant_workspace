/**
 * @medai/dsh-feature-guide host 半（G2 意图检测与核对编排，node 插件）。
 *
 * 职责（SoC 铁律：装配层零业务、无 UI、无跳转、不持有会话状态）：
 *   - `agent/pre-step` 索要意图双命中检测（intent.ts）→ 命中注入核对指令（去重）；
 *   - 注册本地工具 `medai_feature_guide`（tool.ts，契约 ②）；
 *   - 检测/目录异常一律透传原决策（降级铁律：不阻塞对话）。
 *
 * client 半（src/client/index.ts）承担说明卡片渲染与 navigate 发送（G3）。
 * 注意：禁止 export default（对齐官方 tsdown 产物与既有包踩坑：仅命名导出）。
 *
 * @module @medai/dsh-feature-guide
 */

import { randomUUID } from 'node:crypto'
import { FEATURE_CATALOG, type FeatureCatalog, type FeatureEntry } from './catalog.js'
import { detectFeatureIntent } from './intent.js'
import { createToolDefinition, TOOL_NAME, type ToolDef } from './tool.js'

export const name = '@medai/dsh-feature-guide'

/** 服务依赖声明（Cordis 严格代理：未声明 inject 访问 ctx.tools 直接抛错——2026-08-17 装载崩溃根因）。 */
export const inject = ['tools']

/** 插件选项（cordis 配置缺省为空；测试注入目录）。 */
export interface GuideOptions {
  /** 功能目录（默认内置静态目录；v2 后端目录替换）。 */
  catalog?: FeatureCatalog
}

/** pre-step 载荷最小视图（DSH agent/pre-step payload 鸭子类型）。 */
export interface PreStepPayloadLike {
  messages?: Array<{ role?: string; content?: unknown }>
}

/** pre-step 决策最小视图（enter/reject 两态）。 */
export interface PreStepDecisionLike {
  kind?: string
  messages?: Array<{ role?: string; content?: unknown }>
  reason?: string
}

/** host 插件上下文最小视图（自声明，DSH 运行时验证）。 */
export interface PluginContextLike {
  on(
    event: string,
    listener: (payload: PreStepPayloadLike, next: () => Promise<PreStepDecisionLike>) => Promise<PreStepDecisionLike>,
  ): unknown
  tools?: {
    register(def: ToolDef): unknown
  }
}

/** 核对指令文案（唯一事实源；去重键）。 */
export function buildGuidePrompt(hits: readonly FeatureEntry[]): string {
  const names = hits.map((h) => h.name).join('、')
  return (
    `【系统提示】用户疑似索要/要求跳转系统中已有功能（疑似命中：${names}）。` +
    `必须先调用 ${TOOL_NAME} 工具核对，再依据返回结果向用户说明功能；` +
    '用户要求跳转时，引导其点击「跳转到该页面」按钮（工作站当前页跳转），' +
    '禁止用浏览器工具直接访问系统内网页面（http://127.0.0.1:3080 是 DSH 自身而非业务前端）；' +
    '核对前禁止声称系统没有该功能。'
  )
}

/** 注入消息的消息体形状（DSH 消息契约，与 dsh-session-sync patientContextInject 对齐）。 */
export interface GuideMessageLike {
  role: string
  id: string
  content: Array<{ type: string; text: string }>
  source: { kind: string; plugin: string }
}

/**
 * 构造注入消息（必须满足 DSH 消息契约——2026-08-17 实测踩坑：
 * {role:'system', content:字符串} 导致序列化 content.some is not a function → LLM 全 TRANSPORT）：
 * role='user'、非空 id、content 为 ContentBlock 数组、带 source（kind='plugin'）。
 */
export function guideMessageOf(prompt: string): GuideMessageLike {
  return {
    role: 'user',
    id: randomUUID(),
    content: [{ type: 'text', text: prompt }],
    source: { kind: 'plugin', plugin: '@medai/dsh-feature-guide' },
  }
}

/** 消息文本提取（兼容字符串与 ContentBlock 数组；去重键）。 */
function messageTextOf(m: { content?: unknown }): string {
  if (typeof m?.content === 'string') return m.content
  if (Array.isArray(m?.content)) {
    return m.content
      .filter((c) => typeof c === 'object' && c !== null)
      .map((c) => (typeof (c as { text?: unknown }).text === 'string' ? (c as { text: string }).text : ''))
      .join('')
  }
  return ''
}

/** 去重注入提示：已有同 content 文本的消息则原样返回。 */
export function ensureGuidePrompt(
  messages: Array<{ role?: string; content?: unknown }>,
  prompt: string,
): Array<{ role?: string; content?: unknown }> {
  if (messages.some((m) => messageTextOf(m) === prompt)) {
    return messages
  }
  return [...messages, guideMessageOf(prompt)]
}

/**
 * 提取 user 消息文本（兼容字符串与 ContentBlock 数组——3080 实测 enter 时
 * user content 为 [{type:'text',text}] 数组；字符串与空均安全返回）。
 */
function extractUserText(messages: Array<{ role?: string; content?: unknown }>): string {
  return messages
    .filter((m) => m?.role === 'user')
    .map((m) => {
      if (typeof m.content === 'string') return m.content
      if (Array.isArray(m.content)) {
        return m.content
          .filter((c): c is { type?: string; text?: string } => typeof c === 'object' && c !== null)
          .map((c) => (typeof c.text === 'string' ? c.text : ''))
          .join('')
      }
      return ''
    })
    .join('\n')
}

/**
 * 插件装配（host）：pre-step 接线（先 next 后改写 enter，pii-guard 同构）+ 工具注册。
 * @param ctx - cordis 事件/工具上下文
 * @param options - 可选配置（目录注入）
 */
export function apply(ctx: PluginContextLike, options: GuideOptions = {}): void {
  const catalog: FeatureCatalog = options.catalog ?? FEATURE_CATALOG

  // ① 索要意图检测 + 核对指令注入（enter 时；reject/异常原样透传）
  ctx.on('agent/pre-step', async ({ messages }, next): Promise<PreStepDecisionLike> => {
    const decision = await next()
    if (decision?.kind !== 'enter' || !Array.isArray(decision.messages)) {
      return decision
    }
    try {
      const hits = detectFeatureIntent(extractUserText(decision.messages), catalog)
      if (hits.length > 0) {
        return { ...decision, messages: ensureGuidePrompt(decision.messages, buildGuidePrompt(hits)) }
      }
    } catch {
      // 检测异常透传原决策（降级铁律：不阻塞对话）
    }
    return decision
  })

  // ② 本地工具注册（契约 ②；注册是 effect 化——DSH 随 fiber 卸载自动回收）
  ctx.tools?.register(createToolDefinition(catalog))
}
