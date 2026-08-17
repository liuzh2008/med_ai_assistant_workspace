/**
 * G2-C2 红阶段：pre-step 注入与装配测试（TDD：先写失败测试）。
 *
 * 装配语义（对齐 pii-guard 同构模式）：
 * - agent/pre-step 先 next() 后改写 enter 消息（reject 原样透传）；
 * - 双命中时注入核对指令（含疑似功能名），文本唯一去重；
 * - 检测异常透传原决策（降级铁律：检测失败不阻塞对话）；
 * - apply 装配注册 1 个 pre-step 监听器 + 1 个 medai_feature_guide 工具。
 *
 * @module @medai/dsh-feature-guide/index.test
 */

import { describe, expect, it } from 'vitest'
import * as moduleExports from './index.js'
import { apply, buildGuidePrompt, ensureGuidePrompt, type PreStepDecisionLike } from './index.js'
import { FEATURE_CATALOG, type FeatureCatalog } from './catalog.js'
import { TOOL_NAME } from './tool.js'

/** 桩 ctx：捕获事件监听与工具注册。 */
function stubCtx() {
  const onCalls: Array<{
    event: string
    fn: (payload: unknown, next: () => Promise<PreStepDecisionLike>) => Promise<PreStepDecisionLike>
  }> = []
  const registered: unknown[] = []
  return {
    onCalls,
    registered,
    on(event: string, fn: (payload: unknown, next: () => Promise<PreStepDecisionLike>) => Promise<PreStepDecisionLike>) {
      onCalls.push({ event, fn })
    },
    tools: {
      register(def: unknown) {
        registered.push(def)
        return () => {}
      },
    },
  }
}

interface MessageLike {
  role?: string
  content?: unknown
  id?: string
  source?: { kind?: string; plugin?: string }
}

interface PreStepPayloadLike {
  messages: MessageLike[]
}

function preStepPayload(messages: MessageLike[]): PreStepPayloadLike {
  return { messages }
}

describe('G2 核对指令 buildGuidePrompt / ensureGuidePrompt', () => {
  it('buildGuidePrompt_应含疑似功能名与工具名', () => {
    const prompt = buildGuidePrompt(FEATURE_CATALOG.search('病历质控'))
    expect(prompt.includes('EMR病历质控')).toBe(true)
    expect(prompt.includes(TOOL_NAME)).toBe(true)
    expect(prompt.includes('核对前禁止声称系统没有该功能')).toBe(true)
  })

  it('ensureGuidePrompt_注入消息_应满足DSH消息契约（role=user/id非空/content数组/source）', () => {
    // 2026-08-17 3080 实测踩坑：旧实现 {role:'system', content: 字符串} 导致
    // 序列化 content.some is not a function → LLM 全 TRANSPORT（注入生效即空回复）。
    // DSH 契约：role='user'、非空 id、content 为 ContentBlock 数组、带 source（kind='plugin'）。
    const prompt = buildGuidePrompt(FEATURE_CATALOG.search('病历质控'))
    const result = ensureGuidePrompt([{ role: 'user', content: 'hi' }], prompt)
    const injected = result.filter((m) => {
      const text = Array.isArray(m.content)
        ? m.content.filter((c) => c?.type === 'text').map((c) => c.text).join('')
        : typeof m.content === 'string' ? m.content : ''
      return text === prompt
    })
    expect(injected.length).toBe(1)
    const msg = injected[0] as {
      role?: string
      id?: string
      content?: Array<{ type?: string; text?: string }>
      source?: { kind?: string; plugin?: string }
    }
    expect(msg.role).toBe('user')
    expect(typeof msg.id).toBe('string')
    expect((msg.id ?? '').length).toBeGreaterThan(0)
    expect(Array.isArray(msg.content)).toBe(true)
    expect(msg.content![0]).toEqual({ type: 'text', text: prompt })
    expect(msg.source?.kind).toBe('plugin')
    expect(msg.source?.plugin).toBe('@medai/dsh-feature-guide')
  })

  it('ensureGuidePrompt_已含同文案_应去重', () => {
    const prompt = buildGuidePrompt([])
    const messages: MessageLike[] = [
      { role: 'user', content: 'hi' },
      {
        role: 'user',
        id: 'x-1',
        content: [{ type: 'text', text: prompt }],
        source: { kind: 'plugin', plugin: '@medai/dsh-feature-guide' },
      },
    ]
    const result = ensureGuidePrompt(messages, prompt)
    const texts = result.map((m) =>
      Array.isArray(m.content) ? m.content.map((c) => c.text).join('') : String(m.content))
    expect(texts.filter((t) => t === prompt).length).toBe(1)
  })
})

describe('G2 pre-step 装配 apply', () => {
  it('apply_装配_应声明tools注入（Cordis严格代理，未声明inject访问ctx.tools抛错）', () => {
    expect(moduleExports.inject).toEqual(['tools'])
  })

  it('apply_装配_应注册1个preStep监听器与1个工具', () => {
    const ctx = stubCtx()
    apply(ctx as never)
    expect(ctx.onCalls.length).toBe(1)
    expect(ctx.onCalls[0].event).toBe('agent/pre-step')
    expect(ctx.registered.length).toBe(1)
    const def = ctx.registered[0] as { name?: string }
    expect(def.name).toBe(TOOL_NAME)
  })

  it('preStep_enter且双命中_应注入核对指令且含疑似功能名', async () => {
    const ctx = stubCtx()
    apply(ctx as never)
    const fn = ctx.onCalls[0].fn
    const payload = preStepPayload([{ role: 'user', content: '我需要一个病历质控的功能' }])
    const decision = await fn(payload, async () => ({ kind: 'enter', messages: [...payload.messages] }))
    expect(decision.kind).toBe('enter')
    const messages = (decision as { messages: MessageLike[] }).messages
    const allText = JSON.stringify(messages)
    expect(allText.includes('疑似索要/要求跳转系统中已有功能')).toBe(true)
    expect(allText.includes('EMR病历质控')).toBe(true)
    expect(allText.includes(TOOL_NAME)).toBe(true)
  })

  it('preStep_user消息content为ContentBlock数组_应提取文本并注入', async () => {
    // 2026-08-17 3080 实测：enter 时 user 消息 content 是 [{type:'text',text}] 数组而非字符串，
    // 旧检测（仅字符串）漏检 → 注入未发生。此用例锁 ContentBlock 兼容。
    const ctx = stubCtx()
    apply(ctx as never)
    const fn = ctx.onCalls[0].fn
    const payload = preStepPayload([
      { role: 'user', content: [{ type: 'text', text: '我需要一个病历质控的功能' }] },
    ])
    const decision = await fn(payload, async () => ({ kind: 'enter', messages: [...payload.messages] }))
    const messages = (decision as { messages: MessageLike[] }).messages
    const text = messages.map((m) => JSON.stringify(m)).join('\n')
    expect(text.includes('疑似索要/要求跳转系统中已有功能')).toBe(true)
    expect(text.includes('EMR病历质控')).toBe(true)
  })

  it('preStep_已含同文案_应不重复注入', async () => {
    const ctx = stubCtx()
    apply(ctx as never)
    const fn = ctx.onCalls[0].fn
    const prompt = buildGuidePrompt(FEATURE_CATALOG.search('病历质控'))
    const payload = preStepPayload([
      { role: 'user', content: '我需要一个病历质控的功能' },
      { role: 'system', content: prompt },
    ])
    const decision = await fn(payload, async () => ({ kind: 'enter', messages: [...payload.messages] }))
    const messages = (decision as { messages: MessageLike[] }).messages
    expect(messages.filter((m) => m.content === prompt).length).toBe(1)
  })

  it('preStep_reject_应原样透传', async () => {
    const ctx = stubCtx()
    apply(ctx as never)
    const fn = ctx.onCalls[0].fn
    const payload = preStepPayload([{ role: 'user', content: '我需要一个病历质控的功能' }])
    const decision = await fn(payload, async () => ({ kind: 'reject', reason: 'no' }))
    expect(decision).toEqual({ kind: 'reject', reason: 'no' })
  })

  it('preStep_未命中_应不注入', async () => {
    const ctx = stubCtx()
    apply(ctx as never)
    const fn = ctx.onCalls[0].fn
    const payload = preStepPayload([{ role: 'user', content: '你好' }])
    const decision = await fn(payload, async () => ({ kind: 'enter', messages: [...payload.messages] }))
    const messages = (decision as { messages: MessageLike[] }).messages
    expect(messages).toEqual([{ role: 'user', content: '你好' }])
  })

  it('preStep_检测抛异常_应透传原决策', async () => {
    const broken: FeatureCatalog = {
      search() {
        throw new Error('boom')
      },
    }
    const ctx = stubCtx()
    apply(ctx as never, { catalog: broken })
    const fn = ctx.onCalls[0].fn
    const payload = preStepPayload([{ role: 'user', content: '我需要病历质控' }])
    const decision = await fn(payload, async () => ({ kind: 'enter', messages: [...payload.messages] }))
    expect(decision).toEqual({ kind: 'enter', messages: [{ role: 'user', content: '我需要病历质控' }] })
  })
})
