/**
 * patientContextInject（P6-C7，US-N2-03 患者上下文提示注入）。
 *
 * 每轮 `agent/pre-step` 把"当前患者"以 system 提示注入（患者上下文经
 * getPatient() 每轮现取，N1 联动/出院状态实时生效）；未选患者时注入
 * 反问要求。**只做提示注入，不拦截/不改写工具调用参数**——工具契约
 * 纯净，patientId 由 agent 依提示自行填写（实现方案 §4.3）。
 *
 * 与 pii-guard 同构：先 await next() 再改写 enter 消息（reject 透传），
 * 注入内容去重（对齐 ensureDegradedPrompt 模式）。
 *
 * @module @medai/dsh-session-sync/patientContextInject
 */

export const PATIENT_PROMPT = '当前患者：{label}（patientId={id}），涉及该患者的问题使用此 patientId 调工具'

export const NO_PATIENT_PROMPT = '当前未选定患者；患者级问题须先反问确认，科室级问题可直接回答'

export interface PatientContext {
  patientId: string
  patientLabel: string
}

export interface PreStepPayload {
  agent: unknown
  messages: Array<{ [key: string]: unknown; content?: unknown }>
  turn: number
  step: number
  signal: AbortSignal
}

export interface PreStepDecision {
  kind: 'enter' | 'reject'
  messages?: Array<{ [key: string]: unknown; content?: unknown }>
  reason?: string
}

export interface InjectPluginContext {
  on(
    event: string,
    listener: (payload: PreStepPayload, next: () => Promise<PreStepDecision>) => Promise<PreStepDecision>,
  ): unknown
}

/** 组装当前患者提示；未选患者返回反问提示。 */
export function buildPatientPrompt(patient: PatientContext | null): string {
  if (!patient) return NO_PATIENT_PROMPT
  return PATIENT_PROMPT
    .replace('{label}', patient.patientLabel)
    .replace('{id}', patient.patientId)
}

/** 去重注入 system 提示：已含同 content 则原样返回。 */
export function injectPatientContext(
  messages: Array<{ [key: string]: unknown; content?: unknown }>,
  prompt: string,
): Array<{ [key: string]: unknown; content?: unknown }> {
  if (messages.some((m) => m?.content === prompt)) {
    return messages
  }
  return [...messages, { role: 'system', content: prompt }]
}

/**
 * 插件装配：挂载 `agent/pre-step`——enter 时注入当前患者上下文提示。
 * @param ctx - cordis 事件上下文（仅用 on）
 * @param getPatient - 每轮现取当前患者（null = 未选定）
 */
export function apply(ctx: InjectPluginContext, getPatient: () => PatientContext | null): void {
  ctx.on('agent/pre-step', async ({ messages }, next): Promise<PreStepDecision> => {
    const decision = await next()
    if (decision?.kind === 'enter' && Array.isArray(decision.messages)) {
      return { ...decision, messages: injectPatientContext(decision.messages, buildPatientPrompt(getPatient())) }
    }
    return decision
  })
}
