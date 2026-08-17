import { describe, expect, it, vi } from 'vitest'
import {
  createPatientContextHandler,
  isAllowedWorkstationOrigin,
  parsePatientContextBody,
  PATIENT_CONTEXT_PATH,
} from './patientContextEndpoint'
import type { IncomingMessage, ServerResponse } from 'node:http'

/** 最小 IncomingMessage 假体：支持 data/end/error 事件 + 手动触发。 */
function streamReq(body: string, headers: Record<string, string | undefined>, method = 'POST'): IncomingMessage {
  const listeners: Record<string, Array<(arg?: unknown) => void>> = {}
  const req = {
    method,
    headers,
    on(event: string, cb: (arg?: unknown) => void) {
      ;(listeners[event] ??= []).push(cb)
      return req
    },
    __emit(event: string, arg?: unknown) {
      for (const cb of listeners[event] ?? []) cb(arg)
    },
  }
  return req as unknown as IncomingMessage
}

/** 无 body 流（直接 end）。 */
function plainReq(headers: Record<string, string | undefined>, method = 'POST'): IncomingMessage {
  return streamReq('', headers, method)
}

function makeRes() {
  return {
    setHeader: vi.fn(),
    writeHead: vi.fn(),
    end: vi.fn(),
  } as unknown as ServerResponse & {
    setHeader: ReturnType<typeof vi.fn>
    writeHead: ReturnType<typeof vi.fn>
    end: ReturnType<typeof vi.fn>
  }
}

function lastBody(res: ReturnType<typeof makeRes>): unknown {
  return JSON.parse(String(res.end.mock.calls[0][0]))
}

describe('isAllowedWorkstationOrigin', () => {
  it('无 Origin（本机 curl/服务端）放行', () => {
    expect(isAllowedWorkstationOrigin(undefined)).toBe(true)
  })

  it('工作站 origin（http(s)://<host>:8080）放行', () => {
    expect(isAllowedWorkstationOrigin('http://127.0.0.1:8080')).toBe(true)
    expect(isAllowedWorkstationOrigin('http://100.66.1.3:8080')).toBe(true)
    expect(isAllowedWorkstationOrigin('http://localhost:8080')).toBe(true)
  })

  it('非工作站 origin 拒绝（跨站伪造/DSH 自身端口）', () => {
    expect(isAllowedWorkstationOrigin('http://evil.example.com')).toBe(false)
    expect(isAllowedWorkstationOrigin('http://127.0.0.1:3080')).toBe(false)
    expect(isAllowedWorkstationOrigin('http://127.0.0.1:9999')).toBe(false)
    expect(isAllowedWorkstationOrigin('not-a-url')).toBe(false)
  })
})

describe('parsePatientContextBody', () => {
  it('空体 → 清除（null）', () => {
    expect(parsePatientContextBody('')).toEqual({ ok: true, patient: null })
    expect(parsePatientContextBody('  ')).toEqual({ ok: true, patient: null })
  })

  it('JSON null → 清除', () => {
    expect(parsePatientContextBody('null')).toEqual({ ok: true, patient: null })
  })

  it('合法载荷 → 设置', () => {
    expect(parsePatientContextBody('{"patientId":"P000123","patientLabel":"心血管一病区 3床 张*"}'))
      .toEqual({ ok: true, patient: { patientId: 'P000123', patientLabel: '心血管一病区 3床 张*' } })
  })

  it('非法输入 → ok:false（400 语义）', () => {
    expect(parsePatientContextBody('{bad json').ok).toBe(false)
    expect(parsePatientContextBody('"string"').ok).toBe(false)
    expect(parsePatientContextBody('{}').ok).toBe(false)
    expect(parsePatientContextBody('{"patientId":"P1"}').ok).toBe(false)
    expect(parsePatientContextBody('{"patientLabel":"x"}').ok).toBe(false)
    expect(parsePatientContextBody('{"patientId":"","patientLabel":"x"}').ok).toBe(false)
  })
})

describe('createPatientContextHandler', () => {
  it('POST 合法载荷 → setPatient 调用 + 200 {ok:true} + CORS 头', async () => {
    const setPatient = vi.fn()
    const handler = createPatientContextHandler({ setPatient })
    const req = streamReq('{"patientId":"P1","patientLabel":"一病区 1床 王*"}', { origin: 'http://100.66.1.3:8080' })
    const res = makeRes()
    const em = req as unknown as { __emit: (e: string, a?: unknown) => void }

    // 先启动 handler（同步注册 readBody 监听）再喂事件，避免事件先于监听丢失
    const pending = handler(req, res)
    em.__emit('data', Buffer.from('{"patientId":"P1","patientLabel":"一病区 1床 王*"}'))
    em.__emit('end')
    await pending

    expect(setPatient).toHaveBeenCalledWith({ patientId: 'P1', patientLabel: '一病区 1床 王*' })
    expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' })
    expect(lastBody(res)).toEqual({ ok: true })
    expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'http://100.66.1.3:8080')
  })

  it('空体（清除）→ setPatient(null)', async () => {
    const setPatient = vi.fn()
    const handler = createPatientContextHandler({ setPatient })
    const req = plainReq({})
    const res = makeRes()

    const pending = handler(req, res)
    ;(req as unknown as { __emit: (e: string) => void }).__emit('end')
    await pending

    expect(setPatient).toHaveBeenCalledWith(null)
    expect(lastBody(res)).toEqual({ ok: true })
  })

  it('OPTIONS 预检 → 204 + CORS 头（不调 setPatient）', async () => {
    const setPatient = vi.fn()
    const handler = createPatientContextHandler({ setPatient })
    const req = plainReq({ origin: 'http://127.0.0.1:8080' }, 'OPTIONS')
    const res = makeRes()

    await handler(req, res)

    expect(res.writeHead).toHaveBeenCalledWith(204)
    expect(setPatient).not.toHaveBeenCalled()
    expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'POST, OPTIONS')
  })

  it('非法 origin → 403 且不更新患者', async () => {
    const setPatient = vi.fn()
    const handler = createPatientContextHandler({ setPatient })
    const req = plainReq({ origin: 'http://evil.example.com' })
    const res = makeRes()

    await handler(req, res)

    expect(res.writeHead).toHaveBeenCalledWith(403, { 'Content-Type': 'application/json' })
    expect(setPatient).not.toHaveBeenCalled()
  })

  it('非 POST → 405', async () => {
    const handler = createPatientContextHandler({ setPatient: vi.fn() })
    const req = plainReq({}, 'GET')
    const res = makeRes()

    await handler(req, res)

    expect(res.writeHead).toHaveBeenCalledWith(405, { 'Content-Type': 'application/json' })
  })

  it('非法 JSON body → 400', async () => {
    const setPatient = vi.fn()
    const handler = createPatientContextHandler({ setPatient })
    const req = streamReq('{oops', {})
    const res = makeRes()
    const em = req as unknown as { __emit: (e: string, a?: unknown) => void }

    const pending = handler(req, res)
    em.__emit('data', Buffer.from('{oops'))
    em.__emit('end')
    await pending

    expect(res.writeHead).toHaveBeenCalledWith(400, { 'Content-Type': 'application/json' })
    expect(setPatient).not.toHaveBeenCalled()
  })
})

describe('PATIENT_CONTEXT_PATH', () => {
  it('端点路径稳定（工作站约定）', () => {
    expect(PATIENT_CONTEXT_PATH).toBe('/medai/patient-context')
  })
})
