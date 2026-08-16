/**
 * patientContextInject 测试（P6-C7，US-N2-03 患者上下文提示注入）。
 *
 * 验收标准：
 *   1. 已选患者 → pre-step 注入提示含
 *      "当前患者：心血管一病区 3床 张*（patientId=P000123），涉及该患者的问题使用此 patientId 调工具"；
 *   2. 未选定患者 → 注入"当前未选定患者；患者级问题须先反问确认，科室级问题可直接回答"；
 *   3. 工具调用发生 → 不拦截、不改写工具调用参数（patientId 由 agent 依提示自行填写）。
 *
 * 设计语义（对齐实现方案 §4.3 patientContextInject 节 + pii-guard pre-step 模式）：
 *   - 与 pii-guard 同构：先 await next() 再改写 enter 消息，reject 透传；
 *   - 只 append system 消息（内容去重，对齐 ensureDegradedPrompt），
 *     不触碰任何既有消息（含 tool_calls 消息）——保持工具契约纯净；
 *   - 患者上下文经 getPatient() 每轮现取（N1 联动/出院状态实时生效）。
 */

import { describe, expect, it, vi } from 'vitest'
import { apply, buildPatientPrompt, injectPatientContext, PATIENT_PROMPT, NO_PATIENT_PROMPT } from './patientContextInject'
import type { PatientContext, PreStepDecision } from './patientContextInject'

const PATIENT: PatientContext = {
  patientId: 'P000123',
  patientLabel: '心血管一病区 3床 张*',
}

describe('patientContextInject（US-N2-03 患者上下文提示注入）', () => {
  it('buildPatientPrompt：已选患者 → 含 patientId 与 patientLabel 的完整提示', () => {
    expect(buildPatientPrompt(PATIENT)).toBe(
      '当前患者：心血管一病区 3床 张*（patientId=P000123），涉及该患者的问题使用此 patientId 调工具',
    )
    expect(buildPatientPrompt(PATIENT)).toContain('P000123')
  })

  it('buildPatientPrompt：未选定患者 → 反问确认提示', () => {
    expect(buildPatientPrompt(null)).toBe(
      '当前未选定患者；患者级问题须先反问确认，科室级问题可直接回答',
    )
  })

  it('pre-step：已选患者 → enter 消息末尾注入系统提示', async () => {
    const ctx = { on: vi.fn() }
    apply(ctx as never, () => PATIENT)
    const listener = (ctx.on as ReturnType<typeof vi.fn>).mock.calls[0][1]

    const decision = await listener(
      { agent: {}, messages: [{ role: 'user', content: '3床患者今天情况怎么样？' }], turn: 1, step: 1, signal: new AbortController().signal },
      async () => ({ kind: 'enter', messages: [{ role: 'user', content: '3床患者今天情况怎么样？' }] }),
    )

    expect(decision.kind).toBe('enter')
    const injected = (decision as PreStepDecision).messages?.at(-1)
    // 注入的是 buildPatientPrompt 填充产物（非模板常量原文）
    expect(injected).toEqual({ role: 'system', content: buildPatientPrompt(PATIENT) })
    // 既有消息不被改写
    expect((decision as PreStepDecision).messages?.[0]).toEqual({ role: 'user', content: '3床患者今天情况怎么样？' })
  })

  it('pre-step：未选患者 → 注入反问提示', async () => {
    const ctx = { on: vi.fn() }
    apply(ctx as never, () => null)
    const listener = (ctx.on as ReturnType<typeof vi.fn>).mock.calls[0][1]

    const decision = await listener(
      { agent: {}, messages: [{ role: 'user', content: '帮我看看检验结果' }], turn: 1, step: 1, signal: new AbortController().signal },
      async () => ({ kind: 'enter', messages: [{ role: 'user', content: '帮我看看检验结果' }] }),
    )

    expect((decision as PreStepDecision).messages?.at(-1)).toEqual({ role: 'system', content: NO_PATIENT_PROMPT })
  })

  it('不拦截工具调用：含 tool_calls 的消息原样透传，注入仅 append', async () => {
    const toolMsg = {
      role: 'assistant',
      content: '',
      tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'mcp__medai__medai_patient_query', arguments: '{"patientId":"X"}' } }],
    }
    const ctx = { on: vi.fn() }
    apply(ctx as never, () => PATIENT)
    const listener = (ctx.on as ReturnType<typeof vi.fn>).mock.calls[0][1]

    const decision = await listener(
      { agent: {}, messages: [toolMsg], turn: 1, step: 1, signal: new AbortController().signal },
      async () => ({ kind: 'enter', messages: [toolMsg] }),
    )

    // 工具调用参数不被改写（patientId 保持原文，即使与当前患者不符）
    const msgs = (decision as PreStepDecision).messages!
    expect(msgs[0]).toBe(toolMsg)
    const toolCalls = msgs[0].tool_calls as Array<{ function: { arguments: string } }>
    expect(toolCalls[0].function.arguments).toBe('{"patientId":"X"}')
    expect(msgs).toHaveLength(2) // 原消息 + 一条 system
  })

  it('去重：enter 消息已含相同提示 → 不重复注入', async () => {
    const ctx = { on: vi.fn() }
    apply(ctx as never, () => PATIENT)
    const listener = (ctx.on as ReturnType<typeof vi.fn>).mock.calls[0][1]
    const existing = { role: 'system', content: buildPatientPrompt(PATIENT) }

    const decision = await listener(
      { agent: {}, messages: [{ role: 'user', content: 'hi' }], turn: 2, step: 1, signal: new AbortController().signal },
      async () => ({ kind: 'enter', messages: [existing, { role: 'user', content: 'hi' }] }),
    )

    expect((decision as PreStepDecision).messages).toHaveLength(2)
  })

  it('reject 透传：下游拒绝时不做任何注入', async () => {
    const ctx = { on: vi.fn() }
    apply(ctx as never, () => PATIENT)
    const listener = (ctx.on as ReturnType<typeof vi.fn>).mock.calls[0][1]

    const decision = await listener(
      { agent: {}, messages: [], turn: 1, step: 1, signal: new AbortController().signal },
      async () => ({ kind: 'reject', reason: 'blocked' }),
    )

    expect(decision).toEqual({ kind: 'reject', reason: 'blocked' })
  })

  it('injectPatientContext：同 content 去重，无 content 匹配不注入', () => {
    const base = [{ role: 'user', content: 'hi' }]
    const once = injectPatientContext(base, PATIENT_PROMPT)
    expect(once).toHaveLength(2)
    expect(injectPatientContext(once, PATIENT_PROMPT)).toHaveLength(2) // 重复注入被去重
  })
})
