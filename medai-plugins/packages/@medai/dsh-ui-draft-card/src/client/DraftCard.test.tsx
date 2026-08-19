/**
 * @medai/dsh-ui-draft-card 组件测试（T2.5 draftCard.test.tsx，jsdom 环境）。
 *
 * 覆盖（任务验收）：
 *   ① keyed slot 注册：apply 注册两个 key（本地工具名 + MCP 前缀兜底）；
 *   ② 成功：按 promptId fetch F2e 渲染明文 + "以上为 AI 草稿，请审核" 标注，
 *      URL/Authorization 头正确；
 *   ③ 401 → "无权限查看草稿"；
 *   ④ 无 promptId（TIMEOUT 降级）→ 渲染脱敏摘要文本，不取明文；
 *   ⑤ 明文不出现在任何传给 agent 的消息：组件只负责渲染——渲染期间除
 *      draft GET 外零网络调用/零发送通道，明文只存在于卡片 DOM。
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { act } from 'react-dom/test-utils'

import { apply } from './index.js'
import { DraftBody, DraftCard, summaryOf } from './DraftCard.js'
import type { ToolBlockLike } from './draftResult.js'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

/** 已结算工具块（content 文本为同步生成工具契约 JSON）。 */
function settledBlock(contract: Record<string, unknown>): ToolBlockLike {
  return { content: [{ type: 'text', text: JSON.stringify(contract) }] }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

let roots: Root[] = []
let containers: HTMLElement[] = []

async function renderCard(props: Parameters<typeof createElement>[1] & Record<string, unknown>): Promise<HTMLElement> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  containers.push(container)
  const root = createRoot(container)
  roots.push(root)
  await act(async () => {
    root.render(createElement(DraftCard, props as never))
    await new Promise((r) => setTimeout(r, 0))
  })
  return container
}

afterEach(() => {
  for (const root of roots) root.unmount()
  roots = []
  for (const c of containers) c.remove()
  containers = []
  vi.restoreAllMocks()
})

describe('keyed slot 注册（tool.call.toolview）', () => {
  it('① apply 为同步生成工具注册 keyed renderer（双 key）', () => {
    const register = vi.fn()
    const inject = vi.fn(() => register)
    const ctx = { slots: { inject, register } }

    apply(ctx as never)

    expect(inject).toHaveBeenCalledWith('tool.call.toolview', expect.any(Function))
    // inject 回调在注册时被调用两次（每 key 一次）
    const providers = inject.mock.calls.map((c) => c[1]) as Array<() => unknown>
    for (const provider of providers) provider()
    expect(register).toHaveBeenCalledTimes(2)
    const keys = register.mock.calls.map((c) => (c[0] as { key: string }).key)
    expect(keys).toContain('medai_record_generate_sync')
    expect(keys).toContain('mcp__medai__medai_record_generate_sync')
  })
})

describe('DraftBody 纯渲染（renderToString 可测路径）', () => {
  it('② ok 态渲染明文 + "以上为 AI 草稿，请审核"', () => {
    const el = createElement(DraftBody, {
      view: { status: 'COMPLETED', promptId: 'p-1' },
      draftState: 'ok',
      draftText: '患者因胸痛入院，心电图示…',
    })
    const out = renderToString(el)
    expect(out).toContain('患者因胸痛入院')
    expect(out).toContain('以上为 AI 草稿，请审核')
  })

  it('③ unauthorized 态显示"无权限查看草稿"', () => {
    const out = renderToString(createElement(DraftBody, {
      view: { status: 'COMPLETED', promptId: 'p-1' },
      draftState: 'unauthorized',
    }))
    expect(out).toContain('无权限查看草稿')
  })

  it('④ 无 promptId（TIMEOUT 降级）→ 渲染脱敏摘要文本，不渲染明文区', () => {
    const out = renderToString(createElement(DraftBody, {
      view: { status: 'TIMEOUT', message: '仍在生成中，可稍后用 medai_record_status 查询' },
      draftState: 'idle',
    }))
    expect(out).toContain('仍在生成中')
    expect(out).not.toContain('以上为 AI 草稿')
  })
})

describe('summaryOf（折叠行摘要）', () => {
  it('promptId 存在 → "草稿已生成"；TIMEOUT → 降级文案；错误块 → 错误文本', () => {
    expect(summaryOf({ status: 'COMPLETED', promptId: 'p-1' }, null)).toBe('草稿已生成，点击展开查看')
    expect(summaryOf({ status: 'TIMEOUT', message: '仍在生成中' }, null)).toBe('仍在生成中')
    expect(summaryOf({ status: 'COMPLETED', summary: '病情稳定' }, null)).toBe('病情稳定')
    expect(summaryOf(null, '生成服务暂不可用')).toBe('生成服务暂不可用')
  })
})

describe('DraftCard 集成（jsdom + fetch mock）', () => {
  it('② 成功：按 promptId 直连 F2e 渲染明文，URL/Authorization 头正确', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ content: '主诉：胸痛3天。现病史：…（明文草稿）' }))
    const container = await renderCard({
      toolName: 'medai_record_generate_sync',
      block: settledBlock({ status: 'COMPLETED', promptId: 'p-abc', summary: '已生成' }),
      defaultExpanded: true,
      draftOptions: { jwt: 'test-jwt', fetchImpl },
    })

    expect(container.textContent).toContain('主诉：胸痛3天')
    expect(container.textContent).toContain('以上为 AI 草稿，请审核')

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(String(url)).toContain('/api/mcp/draft/p-abc')
    expect(init.method).toBe('GET')
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer test-jwt')
  })

  it('③ 401 → 显示"无权限查看草稿"，明文不渲染', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('Unauthorized', { status: 401 }))
    const container = await renderCard({
      toolName: 'medai_record_generate_sync',
      block: settledBlock({ status: 'COMPLETED', promptId: 'p-401' }),
      defaultExpanded: true,
      draftOptions: { jwt: 'bad-jwt', fetchImpl },
    })

    expect(container.textContent).toContain('无权限查看草稿')
    expect(container.textContent).not.toContain('以上为 AI 草稿')
  })

  it('④ 无 promptId（TIMEOUT）→ 渲染摘要文本且不调用明文端点', async () => {
    const fetchImpl = vi.fn()
    const container = await renderCard({
      toolName: 'medai_record_generate_sync',
      block: settledBlock({ status: 'TIMEOUT', message: '仍在生成中，可稍后用 medai_record_status 查询' }),
      defaultExpanded: true,
      draftOptions: { jwt: 'test-jwt', fetchImpl },
    })

    expect(container.textContent).toContain('仍在生成中')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('⑤ 明文不出现在任何传给 agent 的消息：组件只负责渲染，零发送通道', async () => {
    const PLAIN = '患者张三，住院号110101199001011234，既往高血压病史…'
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ content: PLAIN }))
    const container = await renderCard({
      toolName: 'medai_record_generate_sync',
      block: settledBlock({ status: 'COMPLETED', promptId: 'p-5' }),
      defaultExpanded: true,
      draftOptions: { jwt: 'test-jwt', fetchImpl },
    })

    // 明文出现在卡片 DOM（渲染即呈现），但：
    // 1) fetch 仅一次 GET draft——没有向任何地址发送明文（无 POST/无其他通道）；
    // 2) 所有网络调用的请求体/URL 均不含明文；
    // 3) 组件未挂载任何可向 agent 传递文本的回调（props 无发送通道——由设计保证）。
    expect(container.textContent).toContain(PLAIN)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    for (const call of fetchImpl.mock.calls) {
      const [url, init] = call as [string, RequestInit]
      expect(String(url)).not.toContain(PLAIN)
      expect(String(init?.body ?? '')).not.toContain(PLAIN)
      expect(String(JSON.stringify(init?.headers ?? {}))).not.toContain(PLAIN)
    }
  })
})
