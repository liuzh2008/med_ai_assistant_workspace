/**
 * flowBoardEndpoint 测试（TDD 指南 C8，G3 通道面，node 环境）。
 *
 * 覆盖：①注册两端点（GET/POST 路径 exact）；②GET 转发带凭据（JWT + 设备头）
 * 与 JSON 透传；③后端 401/500 状态透传；④后端不可达 → 502 结构化错误；
 * ⑤POST 转发 body；⑥无 webServer 不崩（返回 undefined）；⑦方法分发 405。
 */

import { describe, expect, it, vi } from 'vitest'
import { createFlowBoardEndpoint, FLOW_BOARD_PATH, FLOW_BOARD_CANCEL_PATH } from './flowBoardEndpoint.js'

/* eslint-disable @typescript-eslint/no-explicit-any -- 测试桩类型从简 */

interface FakeRes {
  status: number
  body: string
  writeHead(status: number, headers?: Record<string, string>): FakeRes
  end(text: string): FakeRes
}

function fakeRes(): FakeRes {
  return {
    status: 0,
    body: '',
    writeHead(status: number) {
      this.status = status
      return this
    },
    end(text: string) {
      this.body = text
      return this
    },
  }
}

/** 带可读 body 流的伪请求（POST）。 */
function streamReq(method: string, body: string): any {
  return {
    method,
    on: (event: string, cb: (chunk?: Buffer) => void) => {
      if (event === 'data') cb(Buffer.from(body))
      if (event === 'end') cb()
      return streamReq(method, body)
    },
  }
}

describe('G3 通道面：flowBoardEndpoint', () => {
  it('① 注册 GET/POST 两端点（exact 路径）', () => {
    const register = vi.fn(() => () => {})
    const endpoint = createFlowBoardEndpoint({ webServer: { register } } as any)
    endpoint.register()
    expect(register).toHaveBeenCalledTimes(2)
    expect(register.mock.calls[0][0].path).toBe(FLOW_BOARD_PATH)
    expect(register.mock.calls[1][0].path).toBe(FLOW_BOARD_CANCEL_PATH)
    expect(register.mock.calls[0][0].kind).toBe('exact')
  })

  it('② GET 转发带凭据（JWT + 设备头）并透传 200 JSON', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ counts: { active: 1, failed: 1 } }), { status: 200 }))
    const endpoint = createFlowBoardEndpoint({} as any, { fetchImpl, getJwt: () => 'jwt-x', machineToken: 'tok' })
    const res = fakeRes()
    await endpoint.forward({ method: 'GET' } as any, res as any, '/api/mcp/flow-board', 'GET')
    expect(fetchImpl).toHaveBeenCalledWith('http://127.0.0.1:8081/api/mcp/flow-board', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer jwt-x', 'X-MedAI-Machine-Token': 'tok' }),
    }))
    expect(res.status).toBe(200)
    expect(JSON.parse(res.body).counts.failed).toBe(1)
  })

  it('③ 后端 401 → 状态码透传', async () => {
    const endpoint = createFlowBoardEndpoint({} as any, {
      fetchImpl: async () => new Response('{"code":"MCP_AUTH_MISSING_JWT"}', { status: 401 }),
    })
    const res = fakeRes()
    await endpoint.forward({ method: 'GET' } as any, res as any, '/api/mcp/flow-board', 'GET')
    expect(res.status).toBe(401)
  })

  it('④ 后端不可达 → 502 结构化错误（无内部细节）', async () => {
    const endpoint = createFlowBoardEndpoint({} as any, {
      fetchImpl: async () => { throw new Error('ECONNREFUSED 127.0.0.1:8081') },
    })
    const res = fakeRes()
    await endpoint.forward({ method: 'GET' } as any, res as any, '/api/mcp/flow-board', 'GET')
    expect(res.status).toBe(502)
    expect(res.body).toContain('UPSTREAM_UNAVAILABLE')
    expect(res.body).not.toContain('ECONNREFUSED')
  })

  it('④b 设备头为占位/非 ASCII 值 → 不携带设备头（fetch 不抛 ByteString 错）', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 200 }))
    // 默认 machineToken='<机器token>'（含中文）→ 不加 X-MedAI-Machine-Token
    const endpoint = createFlowBoardEndpoint({} as any, { fetchImpl })
    const res = fakeRes()
    await endpoint.forward({ method: 'GET' } as any, res as any, '/api/mcp/flow-board', 'GET')
    const headers = fetchImpl.mock.calls[0][1].headers as Record<string, string>
    expect(headers['X-MedAI-Machine-Token']).toBeUndefined()
    expect(res.status).toBe(200)
  })

  it('⑤ POST 转发 body（契约② cancel）', async () => {
    const fetchImpl = vi.fn(async () => new Response('{"cancelled":true,"message":"流程已取消"}', { status: 200 }))
    const endpoint = createFlowBoardEndpoint({} as any, { fetchImpl })
    const res = fakeRes()
    await endpoint.forward({ method: 'POST' } as any, res as any, '/api/mcp/flow-board/cancel', 'POST', '{"patientId":"P001"}')
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:8081/api/mcp/flow-board/cancel',
      expect.objectContaining({ method: 'POST', body: '{"patientId":"P001"}' }),
    )
    expect(res.status).toBe(200)
    expect(JSON.parse(res.body).cancelled).toBe(true)
  })

  it('⑤b exchange 通道：无 getJwt 时先换服务 JWT 再转发（生产通道）', async () => {
    const exchangeResp = new Response(JSON.stringify({ token: 'svc-jwt-1' }), { status: 200 })
    const boardResp = new Response(JSON.stringify({ counts: { active: 1 } }), { status: 200 })
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(exchangeResp)
      .mockResolvedValueOnce(boardResp)
    const endpoint = createFlowBoardEndpoint({} as any, {
      fetchImpl,
      exchange: { url: 'http://127.0.0.1:8081/mcp/auth/exchange', token: 'medai-dev-token' },
    })
    const res = fakeRes()
    await endpoint.forward({ method: 'GET' } as any, res as any, '/api/mcp/flow-board', 'GET')
    expect(fetchImpl).toHaveBeenNthCalledWith(1, 'http://127.0.0.1:8081/mcp/auth/exchange', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer medai-dev-token' }),
    }))
    expect(fetchImpl).toHaveBeenNthCalledWith(2, 'http://127.0.0.1:8081/api/mcp/flow-board', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer svc-jwt-1' }),
    }))
    expect(res.status).toBe(200)
  })

  it('⑤c exchange 缓存：TTL 内第二次转发不再 exchange', async () => {
    const exchangeResp = new Response(JSON.stringify({ token: 'svc-jwt-1' }), { status: 200 })
    const boardResp = new Response(JSON.stringify({ counts: {} }), { status: 200 })
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(exchangeResp)
      .mockResolvedValue(boardResp)
    const endpoint = createFlowBoardEndpoint({} as any, {
      fetchImpl,
      exchange: { url: 'http://127.0.0.1:8081/mcp/auth/exchange', token: 't' },
    })
    const res1 = fakeRes()
    const res2 = fakeRes()
    await endpoint.forward({ method: 'GET' } as any, res1 as any, '/api/mcp/flow-board', 'GET')
    await endpoint.forward({ method: 'GET' } as any, res2 as any, '/api/mcp/flow-board', 'GET')
    expect(fetchImpl).toHaveBeenCalledTimes(3) // 1 exchange + 2 转发
  })

  it('⑤d 401 时清 exchange 缓存（下次重换）', async () => {
    const exchangeResp = new Response(JSON.stringify({ token: 'svc-jwt-1' }), { status: 200 })
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(exchangeResp)
      .mockResolvedValueOnce(new Response('{"code":"MCP_AUTH_INVALID_JWT"}', { status: 401 }))
      .mockResolvedValueOnce(exchangeResp) // 重换
      .mockResolvedValueOnce(new Response('{"counts":{}}', { status: 200 }))
    const endpoint = createFlowBoardEndpoint({} as any, {
      fetchImpl,
      exchange: { url: 'http://127.0.0.1:8081/mcp/auth/exchange', token: 't' },
    })
    const res1 = fakeRes()
    const res2 = fakeRes()
    await endpoint.forward({ method: 'GET' } as any, res1 as any, '/api/mcp/flow-board', 'GET')
    expect(res1.status).toBe(401)
    await endpoint.forward({ method: 'GET' } as any, res2 as any, '/api/mcp/flow-board', 'GET')
    expect(res2.status).toBe(200)
    // 4 次：exchange + 401 转发 + 重换 exchange + 成功转发
    expect(fetchImpl).toHaveBeenCalledTimes(4)
  })

  it('⑥ 无 webServer 不崩（返回 undefined）', () => {
    const endpoint = createFlowBoardEndpoint({} as any)
    expect(endpoint.register()).toBeUndefined()
  })

  it('⑦ 注册 handler 分发：GET 端点 405 拒绝非 GET', () => {
    const register = vi.fn((route: { handler: (req: any, res: any) => void }) => {
      const res = fakeRes()
      route.handler({ method: 'PUT' }, res)
      expect(res.status).toBe(405)
      return () => {}
    })
    const endpoint = createFlowBoardEndpoint({ webServer: { register } } as any)
    endpoint.register()
  })

  it('⑧ POST handler 转发流式请求体', async () => {
    const fetchImpl = vi.fn(async () => new Response('{"cancelled":false,"message":"无法取消"}', { status: 200 }))
    const register = vi.fn((route: { handler: (req: any, res: any) => Promise<void> }) => {
      const res = fakeRes()
      return route.handler(streamReq('POST', '{"patientId":"P9"}'), res)
        .then(() => {
          expect(fetchImpl).toHaveBeenCalledWith(
            'http://127.0.0.1:8081/api/mcp/flow-board/cancel',
            expect.objectContaining({ body: '{"patientId":"P9"}' }),
          )
          expect(res.status).toBe(200)
        })
    })
    const endpoint = createFlowBoardEndpoint({ webServer: { register } } as any, { fetchImpl })
    endpoint.register()
  })
})
