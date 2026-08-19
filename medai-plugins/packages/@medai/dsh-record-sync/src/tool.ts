/**
 * medai_record_generate_sync 工具定义与执行（纯函数，可测）。
 *
 * 契约（方案 §4.2 同步生成契约）：TS 工具 fetch F2b 同步等待 REST 端点
 * `POST /api/mcp/generate-sync`（复用 RecordPromptGenerationService.submit +
 * 同步轮询，上限 ≈90s）→ 返回完成状态 + 脱敏摘要 + promptId。
 * 明文草稿**不出现**在工具文本（唯一通道是 F4 明文草稿卡片）。
 *
 * 超时/网络失败 → 优雅降级（返回 TIMEOUT 语义，不抛异常不挂死对话），
 * agent 转 medai_record_status 查询路径。
 * 非 2xx → 抛结构化错误（DSH 标记 isError 块）；错误消息固定中文文案，
 * 不含后端响应体细节、不回显入参（PII 红线：姓名/身份证号等不出现）。
 *
 * 自声明 ToolDef 形状对齐 @medai/dsh-feature-guide 既有路线：workspace 无法
 * import `@deepseek-ai/dsh-tools` 的 defineTool（peer 由 DSH 运行时提供），
 * 直接给 JSON Schema parameters + output.render + execute（DSH 运行时验证）。
 *
 * @module @medai/dsh-record-sync/tool
 */

/** 工具名（与 F4 草稿卡片 keyed slot 注册名一致）。 */
export const TOOL_NAME = 'medai_record_generate_sync'

/**
 * 工具 description（模型可见）：同步等待快速类病历生成；超时降级语义
 * 必须在描述中明示，避免 agent 把 TIMEOUT 误当失败。
 */
export const TOOL_DESCRIPTION =
  '同步等待快速类病历生成（病情小结、现病史、入院记录总结等），提交后同步等待约 90 秒返回' +
  '完成状态、脱敏摘要与草稿卡片键（promptId）；明文草稿以卡片形式呈现，本工具只返回脱敏内容，不含明文。' +
  '适用于医生要求"写个病情小结/现病史/入院记录总结"等快速类文书时直接调用，一次调用返回最终结果；' +
  '若返回 TIMEOUT（仍在生成中），稍后用 medai_record_status 查询生成状态，不要重复提交。'

/** 工具自声明超时预算（DSH timeout-policy 读取；≈120s 覆盖后端 90s 等待上限）。 */
export const TOOL_TIMEOUT_MS = 120_000

/** fetch AbortController 等待上限（默认 90s，与后端同步轮询上限对齐）。 */
export const DEFAULT_ABORT_TIMEOUT_MS = 90_000

/** F2b 同步等待端点（主服务器；联调可经 options.endpoint 覆盖）。 */
export const DEFAULT_ENDPOINT = 'http://127.0.0.1:8081/api/mcp/generate-sync'

/** X-MedAI-Machine-Token 设备准入静态头（占位；正式值由部署配置下发）。 */
export const DEFAULT_MACHINE_TOKEN = '<机器token>'

/** 超时降级文案（与方案 §4.2 一字对齐）。 */
export const TIMEOUT_MESSAGE = '仍在生成中，可稍后用 medai_record_status 查询'

/** 非 2xx 结构化错误文案（无内部细节、无 PII）。 */
export const ERROR_UPSTREAM = '生成服务暂不可用，请稍后重试'

/** 2xx 但响应体不可解析文案。 */
export const ERROR_BAD_RESPONSE = '生成服务响应异常，请稍后重试'

/** 工具入参（parameters 声明 patientId/templateName 必填）。 */
export interface SyncGenerateArgs {
  patientId: string
  templateName: string
  force?: boolean
  additionalInfo?: string
}

/** 契约返回（给模型看的脱敏内容；promptId 供 F4 卡片取明文）。 */
export interface SyncGenerateResult {
  status: string
  promptId?: string
  summary?: string
  message?: string
  viewHint?: string
}

/** 工具执行选项（测试注入 fetch/超时/端点/JWT）。 */
export interface ToolOptions {
  /** F2b 端点（默认 dev 主服务器）。 */
  endpoint?: string
  /** 设备准入静态 token（默认占位符）。 */
  machineToken?: string
  /** JWT provider（默认包内 credentials.getCredentials）。 */
  getToken?: () => string | null
  /** 测试注入 fetch。 */
  fetchImpl?: typeof fetch
  /** fetch AbortController 等待上限（测试缩短）。 */
  abortTimeoutMs?: number
}

/** 自声明 ToolDef（DSH ToolDefinition 运行时最小形状；timeoutMs 供 timeout-policy）。 */
export interface ToolDef {
  name: string
  description: string
  parameters: Record<string, unknown>
  timeoutMs?: number
  output: {
    schema: Record<string, unknown>
    render: (args: unknown, value: unknown) => Array<{ type: string; text: string }>
  }
  execute: (args: unknown, exec: unknown) => Promise<unknown>
}

/** 校验入参；非法抛错（message 固定中文，不含入参回显）。 */
export function validateArgs(args: unknown): SyncGenerateArgs {
  const a = (args ?? {}) as Partial<SyncGenerateArgs>
  if (typeof a.patientId !== 'string' || a.patientId.trim() === '') {
    throw new Error('参数不合法：缺少患者 ID（patientId）')
  }
  if (typeof a.templateName !== 'string' || a.templateName.trim() === '') {
    throw new Error('参数不合法：缺少文书模板名（templateName）')
  }
  if (a.force !== undefined && typeof a.force !== 'boolean') {
    throw new Error('参数不合法：force 必须为布尔值')
  }
  if (a.additionalInfo !== undefined && typeof a.additionalInfo !== 'string') {
    throw new Error('参数不合法：additionalInfo 必须为字符串')
  }
  return {
    patientId: a.patientId,
    templateName: a.templateName,
    ...(a.force !== undefined ? { force: a.force } : {}),
    ...(a.additionalInfo !== undefined ? { additionalInfo: a.additionalInfo } : {}),
  }
}

/** 组装请求体（纯函数；additionalInfo 透传，脱敏由后端网关负责）。 */
export function buildRequestBody(args: SyncGenerateArgs): string {
  return JSON.stringify(args)
}

/**
 * 同步等待执行（纯函数，可注入 fetch/超时）。
 * - 2xx → 解析 JSON 返回契约字段（status/promptId/summary/message/viewHint）；
 * - 非 2xx → 抛结构化错误（isError 块，无内部细节、无 PII）；
 * - fetch reject / AbortController 超时 → 返回 TIMEOUT 降级（不抛异常）。
 */
export async function executeSyncGenerate(
  args: SyncGenerateArgs,
  jwt: string | null,
  options: ToolOptions = {},
): Promise<SyncGenerateResult> {
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT
  const machineToken = options.machineToken ?? DEFAULT_MACHINE_TOKEN
  const abortTimeoutMs = options.abortTimeoutMs ?? DEFAULT_ABORT_TIMEOUT_MS
  const fetchImpl = options.fetchImpl ?? globalThis.fetch

  const controller = new AbortController()
  // Promise.race 兜底：无论 fetch 实现是否尊重 signal（测试 mock 可能忽略），
  // abortTimeoutMs 到点必然触发降级（真实 fetch 同时收到 signal 尽早取消）
  let timer: ReturnType<typeof setTimeout> | undefined
  const abortPromise = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort()
      reject(new Error('aborted'))
    }, abortTimeoutMs)
  })
  let response: Response
  try {
    response = await Promise.race([
      fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
          'X-MedAI-Machine-Token': machineToken,
        },
        body: buildRequestBody(args),
        signal: controller.signal,
      }),
      abortPromise,
    ])
  } catch {
    // 网络失败 / 超时（AbortError）→ 优雅降级，不抛异常、不挂死对话
    return { status: 'TIMEOUT', message: TIMEOUT_MESSAGE }
  } finally {
    if (timer) clearTimeout(timer)
  }

  if (!response.ok) {
    // 非 2xx → isError 结构化错误：固定中文文案，不回显响应体/入参（无内部细节、无 PII）
    throw new Error(ERROR_UPSTREAM)
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new Error(ERROR_BAD_RESPONSE)
  }

  const p = (payload ?? {}) as Partial<SyncGenerateResult>
  const result: SyncGenerateResult = { status: typeof p.status === 'string' ? p.status : 'COMPLETED' }
  if (typeof p.promptId === 'string' && p.promptId !== '') result.promptId = p.promptId
  if (typeof p.summary === 'string' && p.summary !== '') result.summary = p.summary
  if (typeof p.message === 'string' && p.message !== '') result.message = p.message
  if (typeof p.viewHint === 'string' && p.viewHint !== '') result.viewHint = p.viewHint
  return result
}

/**
 * 构建工具定义：execute 返回 canonical value（脱敏契约），render 投影为
 * 模型可见 JSON 文本（F4 卡片从 content text 解析同一契约）。
 */
export function createToolDefinition(options: ToolOptions = {}): ToolDef {
  return {
    name: TOOL_NAME,
    description: TOOL_DESCRIPTION,
    timeoutMs: TOOL_TIMEOUT_MS,
    parameters: {
      type: 'object',
      properties: {
        patientId: { type: 'string', description: '患者 ID（必填）' },
        templateName: { type: 'string', description: '快速类文书模板名（白名单内：病情小结/现病史/入院记录总结等）' },
        force: { type: 'boolean', description: '是否强制重新生成（跳过当日防重）' },
        additionalInfo: { type: 'string', description: '补充信息（脱敏后拼接；禁止包含姓名/身份证号等个人敏感信息）' },
      },
      required: ['patientId', 'templateName'],
      additionalProperties: false,
    },
    output: {
      // canonical value 宽松对象声明（不约束字段，避免 schema 漂移风险）
      schema: { type: 'object', additionalProperties: true },
      render(_args: unknown, value: unknown) {
        return [{ type: 'text', text: JSON.stringify(value) }]
      },
    },
    async execute(args: unknown) {
      const valid = validateArgs(args)
      const jwt = options.getToken ? options.getToken() : null
      return executeSyncGenerate(valid, jwt, options)
    },
  }
}
