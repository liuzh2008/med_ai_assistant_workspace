/**
 * patientContextEndpoint（US-N2-03 联调接入）——DSH host HTTP 端点。
 *
 * 工作站选中患者时经 fetch 直报当前患者（N1 → POST /medai/patient-context），
 * 绕过 client→host 状态通道（S1 spike 遗留开放问题，实现方案 §12.3 候选②
 * "本地信任通道"的 HTTP 变体：患者状态由工作站显式上报 host，host 内存持有）。
 *
 * - 只更新内存患者状态（currentPatient），不落盘、不写日志 PII；
 * - Origin 白名单：仅接受工作站 origin（http(s)://<host>:8080），防跨站伪造；
 * - CORS：处理预检 OPTIONS + 响应头（浏览器跨域 8080→3080 需读响应）；
 * - 载荷：{patientId, patientLabel}；null/空体 → 清除当前患者（反问降级）。
 *
 * @module @medai/dsh-session-sync/patientContextEndpoint
 */

import type { IncomingMessage, ServerResponse } from 'node:http'

/** 端点路径（与工作站 resolveDshOrigin() 拼接使用）。 */
export const PATIENT_CONTEXT_PATH = '/medai/patient-context'

/** 工作站页面端口（跨域判定：http(s)://<host>:8080）。 */
const WORKSTATION_PORT = '8080'

export interface PatientContextPayload {
  patientId: string
  patientLabel: string
}

/** 端点 handler 依赖（setPatient 由 host 注入；null = 清除当前患者）。 */
export interface PatientContextEndpointDeps {
  setPatient(patient: PatientContextPayload | null): void
}

/** 载荷解析结果：ok=false 时 reason 为错误码（HTTP 400）。 */
export type PatientContextParseResult =
  | { ok: true; patient: PatientContextPayload | null }
  | { ok: false; reason: string }

/**
 * 校验来源是否为工作站页面：无 Origin（本机 curl/服务端调用）放行，
 * 或 http(s)://<host>:8080（覆盖 127.0.0.1 / localhost / 局域网 IP）。
 */
export function isAllowedWorkstationOrigin(origin: string | undefined): boolean {
  if (!origin) return true
  try {
    const url = new URL(origin)
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.port === WORKSTATION_PORT
  } catch {
    return false
  }
}

/**
 * 解析请求体 → 患者载荷（纯函数，可测）。
 * - 空体 / JSON null → 清除（null）
 * - {patientId, patientLabel} → 设置
 * - 其余（非法 JSON / 缺字段）→ ok:false
 */
export function parsePatientContextBody(text: string): PatientContextParseResult {
  if (text.trim() === '') return { ok: true, patient: null }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, reason: 'invalid-json' }
  }
  if (parsed === null) return { ok: true, patient: null }
  if (typeof parsed !== 'object') return { ok: false, reason: 'not-object' }
  const { patientId, patientLabel } = parsed as Record<string, unknown>
  if (typeof patientId !== 'string' || patientId === '') return { ok: false, reason: 'missing-patient-id' }
  if (typeof patientLabel !== 'string') return { ok: false, reason: 'missing-patient-label' }
  return { ok: true, patient: { patientId, patientLabel } }
}

function writeCorsHeaders(res: ServerResponse, origin: string | undefined): void {
  res.setHeader('Access-Control-Allow-Origin', origin && isAllowedWorkstationOrigin(origin) ? origin : '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Max-Age', '86400')
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

/**
 * 创建端点 handler：OPTIONS 预检 / POST 上报（Origin 校验 → 解析 → setPatient）。
 * 全部异常路径均返回 JSON，不抛给 webserver（不触发进程级兜底）。
 */
export function createPatientContextHandler(deps: PatientContextEndpointDeps) {
  return async function handlePatientContext(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined
    writeCorsHeaders(res, origin)

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    if (req.method !== 'POST') {
      json(res, 405, { ok: false, error: 'method-not-allowed' })
      return
    }

    if (!isAllowedWorkstationOrigin(origin)) {
      json(res, 403, { ok: false, error: 'origin-denied' })
      return
    }

    let text: string
    try {
      text = await readBody(req)
    } catch {
      json(res, 400, { ok: false, error: 'body-unreadable' })
      return
    }

    const result = parsePatientContextBody(text)
    if (!result.ok) {
      json(res, 400, { ok: false, error: result.reason })
      return
    }

    deps.setPatient(result.patient)
    json(res, 200, { ok: true })
  }
}
