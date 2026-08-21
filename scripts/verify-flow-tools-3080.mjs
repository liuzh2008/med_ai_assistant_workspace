/**
 * verify-flow-tools-3080.mjs —— 医疗流程通用编排 3080 链路验证（第一环：16 工具面）。
 *
 * 直连 8081 MCP 网关：exchange（每机 token → 服务 JWT）→ initialize → tools/list，
 * 断言 medai_flow_tasks / medai_flow_trigger 已注册；并探测 medai_flow_tasks 调用
 * （信封/401 语义）。用法：node scripts/verify-flow-tools-3080.mjs
 */

const BASE = process.env.MCP_BASE ?? 'http://127.0.0.1:8081'
const TOKEN = process.env.MEDAI_MCP_TOKEN ?? 'medai-dev-token'
const MCP_URL = `${BASE}/mcp`

async function rpc(method, params, auth, sessionId) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
    ...auth,
  }
  if (sessionId) headers['Mcp-Session-Id'] = sessionId
  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  const text = await res.text()
  let body = null
  try { body = JSON.parse(text) } catch { /* stream */ }
  return { status: res.status, body, text, sessionId: res.headers.get('mcp-session-id') }
}

const PASS = []
const FAIL = []

function ok(name) { PASS.push(name); console.log(`  ✓ ${name}`) }
function bad(name, detail) { FAIL.push(name); console.log(`  ✗ ${name} ${detail ?? ''}`) }

console.log(`[1/5] exchange（每机 token → 服务 JWT）...`)
const ex = await fetch(`${BASE}/mcp/auth/exchange`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
  body: '{}',
})
const exBody = await ex.json()
const jwt = exBody?.token
if (jwt) { ok('exchange 换取 JWT 成功') } else { bad('exchange 失败', JSON.stringify(exBody).slice(0, 200)) }
const auth = { Authorization: `Bearer ${jwt ?? TOKEN}`, 'X-MedAI-Machine-Token': TOKEN }

console.log(`[2/5] initialize ...`)
const init = await rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'verify-flow-tools', version: '1.0' } }, auth)
const sessionId = init.sessionId
if (init.status === 200 || init.status === 202) { ok('initialize 完成') } else { bad('initialize 失败', `HTTP ${init.status}`) }

console.log(`[3/5] tools/list（16 工具面）...`)
const list = await rpc('tools/list', {}, auth, sessionId)
const toolsText = list.text
const hasTasks = toolsText.includes('medai_flow_tasks')
const hasTrigger = toolsText.includes('medai_flow_trigger')
if (hasTasks) { ok('medai_flow_tasks 已注册') } else { bad('medai_flow_tasks 缺失') }
if (hasTrigger) { ok('medai_flow_trigger 已注册') } else { bad('medai_flow_trigger 缺失') }
if (hasTasks && hasTrigger) {
  const count = (toolsText.match(/"name":"medai_/g) ?? []).length
  console.log(`  （medai_ 工具面工具数：${count}）`)
}

console.log(`[4/5] medai_flow_tasks 调用语义（不存在患者 → 明确错误，不编造）...`)
const call = await rpc('tools/call', { name: 'medai_flow_tasks', arguments: { patientId: 'NO_SUCH_PATIENT_999' } }, auth, sessionId)
if (call.text.includes('"isError":true') && call.text.includes('未找到')) {
  ok('medai_flow_tasks 对不存在患者返回明确"未找到"错误（不编造数据）')
} else {
  bad('medai_flow_tasks 语义异常', call.text.slice(0, 200))
}

console.log(`[5/5] 无 token → 401 ...`)
const noAuth = await fetch(MCP_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' },
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
})
if (noAuth.status === 401) { ok('无 token 请求返回 401') } else { bad('无 token 未返回 401', `HTTP ${noAuth.status}`) }

console.log(`\n结果：PASS=${PASS.length} FAIL=${FAIL.length}`)
process.exit(FAIL.length === 0 ? 0 : 1)
