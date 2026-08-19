/**
 * @medai/dsh-record-sync 单测（T2.3 syncGenerateTool.test.ts 对齐）。
 *
 * 覆盖（任务验收）：
 *   ① 注册定义存在且 timeoutMs===120000（timeout-policy 自声明生效）；
 *   ② 成功调用传参正确（URL/headers/body）并返回契约字段；
 *   ③ 后端 5xx 返回 isError（抛错）且无内部细节；
 *   ④ fetch reject / 超时返回 TIMEOUT 降级文案（不抛异常）；
 *   ⑤ 错误消息不含 PII（姓名/身份证号样式）。
 */

import { describe, expect, it, vi } from 'vitest'
import {
  ERROR_UPSTREAM,
  TIMEOUT_MESSAGE,
  TOOL_TIMEOUT_MS,
  createToolDefinition,
  DEFAULT_ENDPOINT,
  type SyncGenerateArgs,
} from './tool'

const ARGS: SyncGenerateArgs = { patientId: 'P001', templateName: '病情小结' }

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('medai_record_generate_sync 工具定义', () => {
  it('① 注册定义存在：name/description/parameters 齐备且 timeoutMs===120000', () => {
    const def = createToolDefinition()
    expect(def.name).toBe('medai_record_generate_sync')
    expect(def.description.length).toBeGreaterThan(0)
    expect(def.timeoutMs).toBe(TOOL_TIMEOUT_MS)
    expect(def.timeoutMs).toBe(120000)
    const params = def.parameters as { required?: string[]; properties?: Record<string, unknown> }
    expect(params.required).toContain('patientId')
    expect(params.required).toContain('templateName')
    expect(params.properties).toHaveProperty('force')
    expect(params.properties).toHaveProperty('additionalInfo')
  })

  it('① 入参校验：缺 patientId/templateName 抛固定中文错误', async () => {
    const def = createToolDefinition()
    await expect(def.execute({ templateName: '病情小结' }, undefined)).rejects.toThrow('参数不合法')
    await expect(def.execute({ patientId: 'P001' }, undefined)).rejects.toThrow('参数不合法')
  })
})

describe('medai_record_generate_sync 执行', () => {
  it('② 成功调用：URL/headers/body 传参正确，返回契约字段（status/promptId/summary）', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        status: 'COMPLETED',
        promptId: 'p-123',
        summary: '患者病情稳定，已生成病情小结草稿',
        message: '生成完成',
        viewHint: '草稿已生成，点击查看',
      }),
    )
    const def = createToolDefinition({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      getToken: () => 'good-jwt',
    })

    const result = (await def.execute(ARGS, undefined)) as {
      status: string
      promptId: string
      summary: string
    }
    expect(result.status).toBe('COMPLETED')
    expect(result.promptId).toBe('p-123')
    expect(result.summary).toContain('病情稳定')

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(DEFAULT_ENDPOINT)
    expect(init.method).toBe('POST')
    const headers = init.headers as Record<string, string>
    expect(headers['Content-Type']).toBe('application/json')
    expect(headers.Authorization).toBe('Bearer good-jwt')
    expect(headers['X-MedAI-Machine-Token']).toBe('<机器token>')
    expect(JSON.parse(String(init.body))).toEqual(ARGS)
  })

  it('② force/additionalInfo 可选参数透传；无 JWT 时不带 Authorization', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ status: 'COMPLETED' }))
    const def = createToolDefinition({ fetchImpl: fetchImpl as unknown as typeof fetch })
    await def.execute({ ...ARGS, force: true, additionalInfo: '今晚体温已正常' }, undefined)

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBeUndefined()
    expect(JSON.parse(String(init.body))).toEqual({
      patientId: 'P001',
      templateName: '病情小结',
      force: true,
      additionalInfo: '今晚体温已正常',
    })
  })

  it('③ 后端 5xx → 抛结构化错误（isError 块），且无内部细节', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(
        { error: '内部异常:NullPointerException at com.example.MedAiAssistant.sync.generate(RecordPromptGenerationService.java:88)' },
        500,
      ),
    )
    const def = createToolDefinition({ fetchImpl: fetchImpl as unknown as typeof fetch, getToken: () => 'jwt' })

    await expect(def.execute(ARGS, undefined)).rejects.toThrow(ERROR_UPSTREAM)
    // 无内部细节：响应体中的异常堆栈/类名不得出现在错误消息
    let message = ''
    try {
      await def.execute(ARGS, undefined)
    } catch (err) {
      message = err instanceof Error ? err.message : String(err)
    }
    expect(message).not.toContain('NullPointerException')
    expect(message).not.toContain('内部异常')
    expect(message).not.toContain('RecordPromptGenerationService')
  })

  it('④ fetch reject → TIMEOUT 降级文案（不抛异常）', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'))
    const def = createToolDefinition({ fetchImpl: fetchImpl as unknown as typeof fetch })

    const result = (await def.execute(ARGS, undefined)) as { status: string; message: string }
    expect(result.status).toBe('TIMEOUT')
    expect(result.message).toBe(TIMEOUT_MESSAGE)
  })

  it('④ AbortController 超时 → TIMEOUT 降级文案（不抛异常）', async () => {
    const fetchImpl = vi.fn().mockImplementation(
      () => new Promise<Response>(() => { /* 永不 settle，等待 abort */ }),
    )
    const def = createToolDefinition({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      abortTimeoutMs: 20,
    })

    const result = (await def.execute(ARGS, undefined)) as { status: string; message: string }
    expect(result.status).toBe('TIMEOUT')
    expect(result.message).toBe('仍在生成中，可稍后用 medai_record_status 查询')
  })

  it('⑤ 错误消息不含 PII（姓名/身份证号样式字符串不出现在任何输出）', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ error: '业务校验失败' }, 400),
    )
    const def = createToolDefinition({ fetchImpl: fetchImpl as unknown as typeof fetch, getToken: () => 'jwt' })

    const piiArgs: SyncGenerateArgs = {
      patientId: '张三-P1234',
      templateName: '病情小结',
      additionalInfo: '患者身份证号110101199001011234，联系电话13800138000',
    }
    let message = ''
    try {
      await def.execute(piiArgs, undefined)
    } catch (err) {
      message = err instanceof Error ? err.message : String(err)
    }
    expect(message).not.toContain('张三')
    expect(message).not.toContain('P1234')
    expect(message).not.toContain('110101199001011234')
    expect(message).not.toContain('13800138000')

    // 成功路径：返回的脱敏摘要也不得回显入参中的 PII 原文
    const fetchOk = vi.fn().mockResolvedValue(
      jsonResponse({ status: 'COMPLETED', promptId: 'p-9', summary: '已生成草稿' }),
    )
    const defOk = createToolDefinition({ fetchImpl: fetchOk as unknown as typeof fetch })
    const out = JSON.stringify(await defOk.execute(piiArgs, undefined))
    expect(out).not.toContain('张三')
    expect(out).not.toContain('110101199001011234')
    expect(out).not.toContain('13800138000')
  })
})
