/**
 * GI-C1 验证脚本：对 3080（使用实例，开发测试用途）执行三项断言。
 *
 * 断言：
 * ① medai_feature_guide 出现在工具注册表 —— 通过真实对话中 agent 调用该工具证明
 * ② pre-step 注入可见 —— 发送"我需要一个病历质控的功能"，检查会话历史中
 *    pre-step 注入的核对指令 system 提示（疑似命中：EMR病历质控）
 * ③ 工具调用契约 —— 检查 tool/call + tool/result 中 medai_feature_guide 的
 *    契约②结构化结果（matched=true, features[].route=/qc/emr-quality）
 *
 * 协议：POST /api/<method> body={type:'client-request', rpcId, method, payload}
 * 响应：{type:'server-response', rpcId, result}
 *
 * 用法：node scripts/verify-feature-guide-3080.mjs
 */

const BASE = process.env.DSH_VERIFY_BASE ?? 'http://127.0.0.1:3080/api'
const TIMEOUT_MS = 180_000

async function rpc(method, payload) {
  const rpcId = crypto.randomUUID()
  const res = await fetch(`${BASE}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'client-request', rpcId, method, payload }),
  })
  const text = await res.text()
  let body = null
  try { body = JSON.parse(text) } catch { /* non-JSON */ }
  return { status: res.status, body, text }
}

function resultValue(resp) {
  if (!resp || typeof resp !== 'object') return null
  if (resp.status !== 200) return { error: `HTTP ${resp.status}: ${resp.text?.slice(0, 200)}` }
  const r = resp.body?.result
  if (!r) return { error: 'no result field', raw: resp.body }
  if (r.error) return { error: JSON.stringify(r.error).slice(0, 500) }
  return { value: r.value }
}

function findInjectedGuidePrompt(events) {
  // pre-step 注入的核对指令（疑似索要 + medai_feature_guide 同现）
  for (const entry of events ?? []) {
    const text = JSON.stringify(entry ?? {})
    if (text.includes('疑似索要系统中已有功能') && text.includes('medai_feature_guide')) {
      return { found: true, entry, text }
    }
  }
  return { found: false }
}

function findToolCalls(events) {
  const refs = []
  for (const entry of events ?? []) {
    const text = JSON.stringify(entry ?? {})
    if (text.includes('medai_feature_guide')) {
      refs.push({ type: entry?.event?.type ?? 'unknown', entry })
    }
  }
  return refs
}

async function runOne() {
  console.log('[1/4] session.create ...')
  const created = resultValue(await rpc('session.create', {}))
  if (created.error) { console.error('create failed:', created); return null }
  const sessionId = created.value.sessionId
  console.log('sessionId:', sessionId)

  console.log('[2/4] session.prompt: "我需要一个病历质控的功能" ...')
  const prompted = resultValue(await rpc('session.prompt', {
    sessionId,
    mode: 'queue',
    content: [{ type: 'text', text: '我需要一个病历质控的功能' }],
  }))
  console.log('prompt accepted:', JSON.stringify(prompted).slice(0, 120))

  console.log('[3/4] polling session.history ...')
  let events = []
  const deadline = Date.now() + TIMEOUT_MS
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000))
    const h = resultValue(await rpc('session.history', { sessionId, maxMessages: 80 }))
    if (h.error) { console.error('history error:', h); break }
    events = h.value?.events ?? []
    const types = events.map((e) => e?.event?.type ?? '?')
    // 回合结束信号：turn/end 或 assistant 消息出现
    if (types.includes('turn/end') || types.some((t) => String(t).startsWith('assistant/'))) {
      break
    }
  }

  console.log('history events:', events.length)
  const types = events.map((e) => e?.event?.type ?? '?')
  console.log('event types:', [...new Set(types)].join(', '))

  const injected = findInjectedGuidePrompt(events)
  const toolRefs = findToolCalls(events)
  const callRefs = toolRefs.filter((r) => r.type === 'tool/call')
  const resultText = JSON.stringify(events)
  // tool/result 的 content 文本（含契约② JSON）在 events 序列化后为转义形式 `\"matched\":true`
  const hasMatched = /["\\]+matched["\\]+\s*:\s*true/.test(resultText)
  const hasRoute = resultText.includes('/qc/emr-quality')

  const summary = {
    sessionId,
    events: events.length,
    injected: injected.found,
    toolCalls: callRefs.length,
    matchedTrue: hasMatched,
    hasEmrRoute: hasRoute,
  }
  console.log('SUMMARY:', JSON.stringify(summary, null, 2))
  return summary
}

async function main() {
  const attempts = Number(process.env.DSH_VERIFY_ATTEMPTS ?? 3)
  let last = null
  for (let i = 1; i <= attempts; i++) {
    console.log(`\n===== 尝试 ${i}/${attempts} =====`)
    last = await runOne()
    if (!last) continue
    const allPass = last.injected && last.toolCalls >= 1 && last.matchedTrue && last.hasEmrRoute
    console.log(`===== 尝试 ${i}: ${allPass ? '三项断言全 PASS ✅' : '未全过（继续）'} =====`)
    if (allPass) {
      console.log('\nGI-C1 验证结果: PASS')
      process.exit(0)
    }
  }
  console.log('\nGI-C1 验证结果: FAIL（多次尝试未全过；last:', JSON.stringify(last), '）')
  process.exit(1)
}

main().catch((e) => { console.error('script error:', e); process.exit(1) })
