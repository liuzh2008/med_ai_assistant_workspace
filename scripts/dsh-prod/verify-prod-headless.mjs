#!/usr/bin/env node
/**
 * 生产 DSH headless 验证脚本（无 GUI 环境用）
 *
 * 断言：
 *  ① Web 服务存活：GET / 返回 200（或 /api 可响应）
 *  ② session.create 成功（返回 sessionId）
 *  ③ session.prompt 被接受（mode: queue）
 *  ④ 轮询 session.history 出现 assistant 消息/回合结束（证明 LLM → M3 代理 → DeepSeek 全链路通）
 *  ⑤ 可选：medai MCP 工具在位（history 中出现 mcp__medai 工具注册/调用即说明网关接线成功）
 *
 * 协议：POST /api/<method> body={type:'client-request', rpcId, method, payload}
 * 用法：
 *   node verify-prod-headless.mjs [baseUrl] [timeoutMs]
 *   DSH_VERIFY_PROMPT=环境变量可覆盖测试问题（默认"你好，请回复OK"）
 * 生产机示例：
 *   node verify-prod-headless.mjs http://127.0.0.1:3080/api 120000
 */

import crypto from 'node:crypto'

const BASE = process.argv[2] ?? process.env.DSH_VERIFY_BASE ?? 'http://127.0.0.1:3080/api'
const TIMEOUT_MS = Number(process.argv[3] ?? 120_000)
const PROMPT_TEXT = process.env.DSH_VERIFY_PROMPT ?? '你好，请回复OK'

async function rpc(method, payload) {
  const rpcId = crypto.randomUUID()
  let res
  try {
    res = await fetch(`${BASE}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'client-request', rpcId, method, payload }),
    })
  } catch (e) {
    return { status: 0, error: `fetch failed: ${e.message}` }
  }
  const text = await res.text()
  let body = null
  try { body = JSON.parse(text) } catch { /* non-JSON */ }
  return { status: res.status, body, text }
}

function resultValue(resp) {
  if (!resp || typeof resp !== 'object') return { error: 'no response' }
  if (resp.error) return { error: resp.error }
  if (resp.status !== 200) return { error: `HTTP ${resp.status}: ${(resp.text ?? '').slice(0, 200)}` }
  const r = resp.body?.result
  if (!r) return { error: `no result field: ${JSON.stringify(resp.body).slice(0, 200)}` }
  if (r.error) return { error: JSON.stringify(r.error).slice(0, 300) }
  return { value: r.value }
}

async function main() {
  console.log(`BASE=${BASE}  TIMEOUT=${TIMEOUT_MS}ms  prompt="${PROMPT_TEXT}"`)

  // ① 存活
  try {
    const alive = await fetch(BASE.replace(/\/api$/, ''))
    console.log(`[1/5] web alive: HTTP ${alive.status}`)
    if (alive.status !== 200) { console.error('FAIL: web not alive'); process.exit(1) }
  } catch (e) {
    console.error('FAIL: web not reachable:', e.message)
    process.exit(1)
  }

  // ② 建会话
  console.log('[2/5] session.create ...')
  const created = resultValue(await rpc('session.create', {}))
  if (created.error) { console.error('FAIL create:', created.error); process.exit(1) }
  const sessionId = created.value.sessionId
  console.log('  sessionId:', sessionId)

  // ③ 提问
  console.log('[3/5] session.prompt ...')
  const prompted = resultValue(await rpc('session.prompt', {
    sessionId,
    mode: 'queue',
    content: [{ type: 'text', text: PROMPT_TEXT }],
  }))
  console.log('  accepted:', JSON.stringify(prompted).slice(0, 150))
  if (prompted.error) { console.error('FAIL prompt:', prompted.error); process.exit(1) }

  // ④ 轮询历史
  console.log('[4/5] polling session.history ...')
  let events = []
  const deadline = Date.now() + TIMEOUT_MS
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000))
    const h = resultValue(await rpc('session.history', { sessionId, maxMessages: 100 }))
    if (h.error) { console.error('  history error:', h.error); break }
    events = h.value?.events ?? []
    const types = events.map((e) => e?.event?.type ?? '?')
    if (types.includes('turn/end') || types.some((t) => String(t).startsWith('assistant/'))) break
  }

  const types = [...new Set(events.map((e) => e?.event?.type ?? '?'))]
  console.log('  events:', events.length, '| types:', types.join(', '))

  // ⑤ 结论
  const hasAssistant = types.some((t) => String(t).startsWith('assistant/')) || types.includes('turn/end')
  const medaiTools = JSON.stringify(events).includes('mcp__medai') || JSON.stringify(events).includes('medai_')
  const summary = {
    sessionId,
    events: events.length,
    assistantReplied: hasAssistant,
    medaiToolsVisible: medaiTools,
  }
  console.log('SUMMARY:', JSON.stringify(summary, null, 2))
  const pass = hasAssistant
  console.log(pass ? '\nHEADLESS 验证结果: PASS ✅（LLM 链路通' + (medaiTools ? '，medai MCP 工具在位）' : '，medai 工具未见（网关未接或未调用）') : '\nHEADLESS 验证结果: FAIL ❌（无 assistant 回复，查 LLM/网关日志）')
  process.exit(pass ? 0 : 1)
}

main().catch((e) => { console.error('script error:', e); process.exit(1) })
