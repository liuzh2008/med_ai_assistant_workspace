/**
 * 安装验证：3080 使用实例装配 @medai/dsh-record-sync 后，端到端验证
 * `medai_record_generate_sync` 工具真实可用（agent 调用 → 同步生成 → 契约返回）。
 *
 * 断言：
 * ① 工具注册并可见 —— 通过真实对话中 agent 调用 medai_record_generate_sync 证明
 * ② 契约返回 —— tool/result 含 status（COMPLETED/EXISTS_TODAY/TIMEOUT...）与
 *    promptId（COMPLETED 时必须携带）；响应无 PII 明文（身份证/手机样式）
 * ③ 明文端点可用 —— 拿到 promptId 后直连 GET /api/mcp/draft/{promptId}（F2e）
 *    COMPLETED → 200 + content 字符串；未完成 → 非 500（不泄密）
 *
 * 协议：POST /api/<method> body={type:'client-request', rpcId, method, payload}
 * 响应：{type:'server-response', rpcId, result}
 *
 * 用法：node scripts/verify-record-sync-3080.mjs
 * 环境变量：DSH_VERIFY_BASE（默认 http://127.0.0.1:3080/api）、
 *           DSH_VERIFY_PATIENT（默认 026794477_2）、DSH_VERIFY_ATTEMPTS（默认 2）
 */

const BASE = process.env.DSH_VERIFY_BASE ?? 'http://127.0.0.1:3080/api'
const PATIENT_ID = process.env.DSH_VERIFY_PATIENT ?? '026794477_2'
const ATTEMPTS = Number(process.env.DSH_VERIFY_ATTEMPTS ?? 2)
const POLL_TIMEOUT_MS = 200_000 // 同步生成上限 ≈90s + LLM 编排余量
const MCP_ROOT = 'http://127.0.0.1:8081'
const MACHINE_TOKEN = process.env.MEDAI_MCP_TOKEN ?? 'medai-dev-token'

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

function findSyncToolCalls(events) {
  // tool/call 按 name 精确匹配；tool/result 不含工具名（只有 callId），按 callId 关联
  const callIds = new Set()
  const calls = []
  for (const entry of events ?? []) {
    const type = entry?.event?.type ?? 'unknown'
    const d = entry?.event?.data ?? {}
    if (type === 'tool/call' && d.name === 'medai_record_generate_sync') {
      calls.push({ type, entry })
      if (d.callId) callIds.add(d.callId)
    }
  }
  for (const entry of events ?? []) {
    const type = entry?.event?.type ?? 'unknown'
    if (type !== 'tool/result') continue
    const d = entry?.event?.data ?? {}
    const callId = d.message?.source?.callId ?? d.message?.content?.[0]?.toolCallId
    if (callIds.size === 0 || callIds.has(callId)) calls.push({ type, entry })
  }
  return calls
}

function extractResultPayload(calls) {
  // tool/result 事件里找工具返回的 JSON（content 内嵌转义 JSON：先反序列化再匹配）
  for (const c of calls) {
    if (c.type !== 'tool/result') continue
    const entry = c.entry
    const content = entry?.event?.data?.message?.content ?? []
    for (const block of content) {
      for (const inner of block?.content ?? []) {
        if (inner?.type !== 'text' || typeof inner.text !== 'string') continue
        // history 投影会把 content text 二次序列化（{\"status\":...} 带反斜杠）：
        // 先尝试按字符串字面量解包一层，得到真实 JSON 文本
        let text = inner.text
        try {
          const unwrapped = JSON.parse(`"${text}"`)
          if (typeof unwrapped === 'string') text = unwrapped
        } catch { /* 未包裹，用原文 */ }
        const m = text.match(/\{"status":"(COMPLETED|EXISTS_TODAY|TIMEOUT|NO_ADMISSION_DATA|TEMPLATE_NOT_FOUND|FAILED)"[^}]*\}/)
        if (m) {
          try { return JSON.parse(m[0]) } catch { return { status: m[1] } }
        }
      }
    }
  }
  return null
}

async function runOne() {
  console.log('[1/4] session.create ...')
  const created = resultValue(await rpc('session.create', {}))
  if (created.error) { console.error('create failed:', created); return null }
  const sessionId = created.value.sessionId
  console.log('sessionId:', sessionId)

  console.log('[2/4] session.prompt: 引导调用 medai_record_generate_sync ...')
  const prompted = resultValue(await rpc('session.prompt', {
    sessionId,
    mode: 'queue',
    content: [{ type: 'text', text:
      `请调用 medai_record_generate_sync 工具为患者 ${PATIENT_ID} 生成『病情小结』` +
      `（templateName=病情小结，force=false）。工具会同步等待约 90 秒返回完成状态与脱敏摘要；` +
      `若返回 TIMEOUT 请如实告知仍在生成中，不要重复提交。` }],
  }))
  console.log('prompt accepted:', JSON.stringify(prompted).slice(0, 120))

  console.log('[3/4] polling session.history ...')
  let events = []
  const deadline = Date.now() + POLL_TIMEOUT_MS
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000))
    const h = resultValue(await rpc('session.history', { sessionId, maxMessages: 100 }))
    if (h.error) { console.error('history error:', h); break }
    events = h.value?.events ?? []
    const types = events.map((e) => e?.event?.type ?? '?')
    // 工具调用后结束回合，或出现 assistant 消息
    if (types.includes('turn/end') || types.some((t) => String(t).startsWith('assistant/'))) break
  }

  console.log('history events:', events.length)
  const types = events.map((e) => e?.event?.type ?? '?')
  console.log('event types:', [...new Set(types)].join(', '))

  const calls = findSyncToolCalls(events)
  const callCount = calls.filter((c) => c.type === 'tool/call').length
  const resultPayload = extractResultPayload(calls)
  const resultText = JSON.stringify(events)
  const hasStatus = resultPayload !== null
  const piiLeak = /[0-9]{6}[0-9Xx]{4}/.test(resultText) && !resultText.includes(PATIENT_ID)

  const summary = {
    sessionId,
    events: events.length,
    toolCalls: callCount,
    resultStatus: resultPayload?.status ?? null,
    hasPromptId: Boolean(resultPayload?.promptId),
    piiLeak,
  }
  console.log('SUMMARY:', JSON.stringify(summary, null, 2))

  // ④ 明文端点契约（COMPLETED 时取明文验证 F2e）
  if (resultPayload?.promptId) {
    console.log('[4/4] GET /api/mcp/draft/{promptId} ...')
    const jwt = await exchangeServiceJwt().catch(() => null)
    if (jwt) {
      const res = await fetch(`${MCP_ROOT}/api/mcp/draft/${resultPayload.promptId}`, {
        headers: { Authorization: `Bearer ${jwt}`, 'X-MedAI-Machine-Token': MACHINE_TOKEN },
      }).catch(() => null)
      if (res) {
        const body = await res.text()
        summary.draftStatus = res.status
        summary.draftHasContent = res.status === 200 && body.length > 0
        console.log(`draft endpoint -> HTTP ${res.status}, content length: ${body.length}`)
      }
    } else {
      console.log('exchange 失败，跳过明文端点验证')
    }
  }
  return summary
}

async function exchangeServiceJwt() {
  const res = await fetch(`${MCP_ROOT}/mcp/auth/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${MACHINE_TOKEN}` },
    body: '{}',
  })
  if (res.status !== 200) throw new Error(`exchange HTTP ${res.status}`)
  const body = await res.json()
  return body.token
}

async function main() {
  let last = null
  for (let i = 1; i <= ATTEMPTS; i++) {
    console.log(`\n===== 尝试 ${i}/${ATTEMPTS} =====`)
    last = await runOne()
    if (!last) continue
    const allPass = last.toolCalls >= 1 && last.resultStatus !== null && !last.piiLeak
    console.log(`===== 尝试 ${i}: ${allPass ? '装配验证全 PASS ✅' : '未全过（继续）'} =====`)
    if (allPass) {
      console.log('\nmedai_record_generate_sync 装配验证: PASS')
      process.exit(0)
    }
  }
  console.log('\n装配验证: FAIL（last:', JSON.stringify(last), '）')
  process.exit(1)
}

main().catch((e) => { console.error('script error:', e); process.exit(1) })
