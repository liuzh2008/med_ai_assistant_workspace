#!/usr/bin/env node
/**
 * dsh-gateway v0.3（阶段 0-Linux 原型 → 阶段 1 试点基线）
 * MedAi SSO 登录代理 → HttpOnly 会话 → 按用户路由到对应 DSH 实例（单 origin 透传）
 *
 * v0.3：会话与实例 cookie 持久化到 state.json（网关重启不丢登录态、免重新引导实例）。
 * 其余同 v0.2：登录代理 + 验真（MedAi 自验签）+ 实例引导代管（bootstrap token → dsh-auth 注入）。
 */
'use strict'

const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { createProxyServer } = require('http-proxy')

// ---------- CONFIG ----------
const CONFIG = {
  listenPort: Number(process.env.GW_PORT || 3200),
  medaiBase: process.env.MEDAI_BASE || 'http://127.0.0.1:8081/api',
  stateFile: process.env.GW_STATE_FILE || '/srv/dsh-platform/gateway/state.json',
  instances: {
    u1: { port: 3101, tokenFile: '/srv/dsh-platform/state/u1.token' },
    u2: { port: 3102, tokenFile: '/srv/dsh-platform/state/u2.token' },
  },
  userMap: {
    '1657': 'u1', // 刘朝晖
    '0001': 'u2', // Administrator
  },
  sessionTtlMs: 12 * 3600 * 1000,
  cookieName: 'dshgw',
}

// ---------- 持久化（轻量 JSON，同步写——变更即落盘，防进程被杀丢状态） ----------
function persist() {
  try {
    const data = {
      sessions: [...sessions.entries()].map(([sid, s]) => [sid, s]),
      instAuth: [...instAuth.entries()],
    }
    fs.writeFileSync(CONFIG.stateFile, JSON.stringify(data), { mode: 0o600 })
  } catch (e) { console.error('[gw] state save failed:', e.message) }
}
function loadState() {
  try {
    const data = JSON.parse(fs.readFileSync(CONFIG.stateFile, 'utf8'))
    const now = Date.now()
    for (const [sid, s] of data.sessions || []) {
      if (s.expiresAt > now) sessions.set(sid, s)
    }
    for (const [k, v] of data.instAuth || []) instAuth.set(k, v)
    console.log(`[gw] state restored: sessions=${sessions.size} instAuth=${instAuth.size}`)
  } catch { console.log('[gw] no prior state') }
}

// ---------- 会话存储 ----------
const sessions = new Map()
const instAuth = new Map() // instanceKey -> 'dsh-auth-xxx=value'

function issueSession(userId, name) {
  const sid = crypto.randomBytes(24).toString('hex')
  sessions.set(sid, { userId, name, expiresAt: Date.now() + CONFIG.sessionTtlMs })
  persist()
  return sid
}
function readSession(req) {
  const m = (req.headers.cookie || '').match(new RegExp(CONFIG.cookieName + '=([^;]+)'))
  if (!m) return null
  const sid = decodeURIComponent(m[1])
  const s = sessions.get(sid)
  if (!s) return null
  if (s.expiresAt < Date.now()) { sessions.delete(sid); persist(); return null }
  return s
}

// ---------- 实例侧授权（引导代管） ----------
function readBootstrapToken(key) {
  const inst = CONFIG.instances[key]
  if (!inst) return null
  try { return fs.readFileSync(inst.tokenFile, 'utf8').trim() } catch { return null }
}
async function ensureInstanceAuth(key) {
  if (instAuth.has(key)) return true
  const inst = CONFIG.instances[key]
  const token = readBootstrapToken(key)
  if (!token) return false
  try {
    const r = await fetch(`http://127.0.0.1:${inst.port}/?token=${token}`, { redirect: 'manual' })
    const setCookies = typeof r.headers.getSetCookie === 'function' ? r.headers.getSetCookie() : []
    const auth = setCookies.find((c) => c.startsWith('dsh-auth-'))
    if (auth) {
      instAuth.set(key, auth.split(';')[0])
      persist()
      return true
    }
    return false
  } catch { return false }
}

// ---------- MedAi 登录代理 ----------
function medaiLogin(id, password) {
  return fetch(`${CONFIG.medaiBase}/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, password }),
  }).then(async (r) => {
    if (r.status !== 200) return { ok: false, status: r.status }
    const body = await r.json()
    if (!body || !body.token || !body.userId) return { ok: false, status: r.status, reason: 'no-token' }
    return { ok: true, token: body.token, userId: String(body.userId), name: body.name || body.username || body.userId }
  }).catch((e) => ({ ok: false, status: 0, reason: String(e.message || e) }))
}
function medaiVerify(token, userId) {
  return fetch(`${CONFIG.medaiBase}/users/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.status === 200).catch(() => false)
}

// ---------- 反代 ----------
const proxy = createProxyServer({ target: 'http://127.0.0.1:3101', ws: true, xfwd: false })
proxy.on('error', (err, _req, res) => {
  if (res && !res.headersSent) { res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('网关到实例转发失败: ' + err.message) }
  else if (res) res.end()
})
function targetFor(userId) {
  const key = CONFIG.userMap[userId]
  const inst = key && CONFIG.instances[key]
  return inst ? { key, url: `http://127.0.0.1:${inst.port}` } : null
}
function prepareProxyHeaders(req, t) {
  req.headers.host = `127.0.0.1:${CONFIG.instances[t.key].port}`
  const instCookie = instAuth.get(t.key)
  const browser = (req.headers.cookie || '').split(';').map((s) => s.trim()).filter((s) => s && !s.startsWith(CONFIG.cookieName + '=')).join('; ')
  req.headers.cookie = [instCookie, browser].filter(Boolean).join('; ')
  delete req.headers.origin
  delete req.headers['sec-fetch-site']
  delete req.headers['sec-fetch-mode']
}

// ---------- 页面 ----------
const LOGIN_HTML = `<!doctype html><html lang="zh"><meta charset="utf-8"><title>DSH 登录</title>
<body style="font-family:system-ui;display:flex;min-height:100vh;align-items:center;justify-content:center;background:#f5f6f8">
<form id="f" style="background:#fff;padding:36px;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.08);width:320px">
<h2 style="margin-top:0">MedAi AI 助手</h2>
<label>工号<br><input id="id" name="id" required style="width:100%;padding:8px;margin:6px 0 14px;box-sizing:border-box" autocomplete="username"></label>
<label>密码<br><input id="pw" name="password" type="password" required style="width:100%;padding:8px;margin:6px 0 14px;box-sizing:border-box" autocomplete="current-password"></label>
<button id="btn" style="width:100%;padding:10px;background:#2563eb;color:#fff;border:0;border-radius:8px;cursor:pointer">登录</button>
<p style="color:#b91c1c;min-height:18px" id="err"></p></form>
<script>
const f=document.getElementById('f'),err=document.getElementById('err'),btn=document.getElementById('btn');
f.addEventListener('submit',async(e)=>{
  e.preventDefault();
  err.textContent=''; btn.disabled=true; btn.textContent='登录中…';
  try{
    const r=await fetch('/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:document.getElementById('id').value.trim(),password:document.getElementById('pw').value})});
    if(r.redirected){location.href=r.url;return}
    err.textContent=(r.status===401)?'工号或密码错误，或账号未激活':(r.status===403?'账号未开通 DSH 工作区':('登录失败('+r.status+')'));
  }catch(x){err.textContent='网络错误：'+x.message}
  btn.disabled=false; btn.textContent='登录';
});
</script></body></html>`
function send(res, code, html) { res.writeHead(code, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html) }

// ---------- HTTP 主循环 ----------
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x')
  const path = u.pathname

  if (path === '/login' && req.method === 'GET') return send(res, 200, LOGIN_HTML)
  if (path === '/logout') { res.writeHead(302, { Location: '/login' }); return res.end() }

  if (path === '/login' && req.method === 'POST') {
    let raw = ''
    for await (const c of req) raw += c
    let body = {}
    try {
      const ct = req.headers['content-type'] || ''
      body = ct.includes('application/json') ? JSON.parse(raw) : Object.fromEntries(new URLSearchParams(raw))
    } catch { body = {} }
    const id = String(body.id || '').trim()
    const password = String(body.password || '')
    if (!id || !password) return send(res, 400, LOGIN_HTML.replace('<p style="color:#b91c1c;min-height:18px" id="err"></p>', '<p style="color:#b91c1c;min-height:18px" id="err">请输入工号与密码</p>'))
    const r = await medaiLogin(id, password)
    if (!r.ok) {
      const msg = r.status === 0 ? 'MedAi 后端不可达' : '工号或密码错误，或账号未激活'
      return send(res, 401, LOGIN_HTML.replace('<p style="color:#b91c1c;min-height:18px" id="err"></p>', `<p style="color:#b91c1c;min-height:18px" id="err">${msg}</p>`))
    }
    const valid = await medaiVerify(r.token, r.userId)
    if (!valid) return send(res, 401, LOGIN_HTML.replace('<p style="color:#b91c1c;min-height:18px" id="err"></p>', '<p style="color:#b91c1c;min-height:18px" id="err">登录态校验失败</p>'))
    const t = targetFor(r.userId)
    if (!t) return send(res, 403, `<h3>账号未开通 DSH 工作区</h3><p>userId=${r.userId}（${r.name}）。请联系管理员在 userMap 中开通。</p>`)
    await ensureInstanceAuth(t.key)
    const sid = issueSession(r.userId, r.name)
    res.writeHead(302, {
      Location: '/',
      'Set-Cookie': `${CONFIG.cookieName}=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${CONFIG.sessionTtlMs / 1000}`,
    })
    return res.end()
  }

  const session = readSession(req)
  if (!session) { res.writeHead(302, { Location: '/login' }); return res.end() }
  const t = targetFor(session.userId)
  if (!t) { return send(res, 403, `<h3>账号未开通 DSH 工作区</h3><p>userId=${session.userId}（${session.name}）。</p>`) }
  if (!instAuth.has(t.key)) await ensureInstanceAuth(t.key)
  prepareProxyHeaders(req, t)
  proxy.web(req, res, { target: t.url })
})

server.on('upgrade', (req, socket, head) => {
  const session = readSession(req)
  if (!session) { socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); socket.destroy(); return }
  const t = targetFor(session.userId)
  if (!t || !instAuth.has(t.key)) { socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); socket.destroy(); return }
  prepareProxyHeaders(req, t)
  proxy.ws(req, socket, head, { target: t.url })
})

loadState()
server.listen(CONFIG.listenPort, '0.0.0.0', () => {
  console.log(`dsh-gateway v0.3 listening on http://0.0.0.0:${CONFIG.listenPort}`)
  console.log(`userMap: ${Object.entries(CONFIG.userMap).map(([uid, k]) => `${uid}->${k}`).join(', ')}`)
  console.log(`stateFile: ${CONFIG.stateFile}`)
})
