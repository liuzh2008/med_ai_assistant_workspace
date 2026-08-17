/**
 * @medai/dsh-pii-guard 插件入口（TDD 指南 US-M1-03 / M1-T3）。
 *
 * 职责：
 * 1. **轻量正则减负**（前端减负，不做阻断）——`agent/pre-step` 中改写用户消息：
 *    确定性 PII 掩码 + 姓名映射（映射为空降级纯正则）。
 * 2. **工具在位明示降级**（与网关解绑后的补偿）：MCP 网关宕机时 DSH 照常启动
 *    （`failOnStartupError: false`）；本插件检测 medai 工具（`mcp__medai__*`）缺失
 *    （启动时连接失败 → 零工具）时，向进入步骤的消息注入一条 system 提示，
 *    要求 agent 明确告知"数据服务暂不可用"并**禁止编造**——把"静默零工具"
 *    转化为"对话期对用户可见的错误"。
 *
 * 约束：不持有业务数据/规则/凭据；姓名映射只消费 M2 下发（不拉取、不落盘）。
 */

import { maskPii } from './patterns.js';
import { applyNameMapping, SessionNameMapper } from './mapper.js';

export const name = '@medai/dsh-pii-guard';

/** medai MCP 工具名前缀（mcp-client 服务器限定名） */
export const MEDAI_TOOL_PREFIX = 'mcp__medai__';

/** 降级提示（注入进 enter 决策；文本唯一，用于去重） */
export const DEGRADED_PROMPT =
  '【系统提示】MCP 数据网关当前不可用：medai 工具（mcp__medai__*）未注册或调用失败。' +
  '若用户询问患者/医嘱/病历/检验/检查/诊断等数据，必须明确告知"数据服务暂不可用，请稍后重试或联系信息科"，严禁编造数据。';

export interface PreStepDecision {
  kind: 'enter' | 'reject';
  messages?: Array<{ [key: string]: unknown; content?: unknown }>;
  reason?: string;
}

export interface PreStepPayload {
  agent: unknown;
  messages: Array<{ [key: string]: unknown; content?: unknown }>;
  turn: number;
  step: number;
  signal: AbortSignal;
}

export interface ToolSchema {
  name: string;
  [key: string]: unknown;
}

export interface PluginContext {
  on(event: string, listener: (payload: PreStepPayload, next: () => Promise<PreStepDecision>) => Promise<PreStepDecision>): unknown;
  tools?: {
    schemas(): ToolSchema[];
    get(name: string): unknown;
  };
}

/** 会话级姓名映射（M2 下发注入用；映射为空 → 降级纯正则） */
export const nameMapper = new SessionNameMapper();

/**
 * 单条消息脱敏：content 为字符串时做 PII 掩码 + 姓名映射（可注入映射表）。
 */
export function sanitizeContent(
  content: string,
  sessionId?: string | null,
  mapping?: Record<string, string> | null,
): string {
  const { text } = applyNameMapping(content, mapping ?? undefined);
  return maskPii(text);
}

/**
 * 检测 medai MCP 工具是否在位（工具注册表为空/查不到 → 网关不可达）。
 * 注册表查询异常时视为在位（不误报降级）。
 */
export function medaiToolsMissing(ctx: PluginContext): boolean {
  try {
    const schemas = ctx?.tools?.schemas?.() ?? [];
    return !schemas.some((s) => typeof s?.name === 'string' && s.name.startsWith(MEDAI_TOOL_PREFIX));
  } catch {
    return false;
  }
}

/**
 * 去重注入降级提示：若 enter 消息中已存在该提示则不重复注入。
 */
export function ensureDegradedPrompt(
  messages: Array<{ [key: string]: unknown; content?: unknown }>,
): Array<{ [key: string]: unknown; content?: unknown }> {
  const already = messages.some((m) => m?.content === DEGRADED_PROMPT);
  if (already) {
    return messages;
  }
  return [...messages, { role: 'system', content: DEGRADED_PROMPT }];
}

/**
 * 插件装配：挂载 `agent/pre-step` 钩子——改写消息（PII 掩码 + 姓名映射），
 * 并在 medai 工具缺失时注入降级提示（明示错误给用户，禁止编造）。
 */
export function apply(ctx: PluginContext): void {
  ctx.on('agent/pre-step', async ({ messages }, next): Promise<PreStepDecision> => {
    const decision = await next();
    if (decision?.kind === 'enter' && Array.isArray(decision.messages)) {
      // 掩码只针对用户自由文本（role !== 'system'）：@medai/dsh-session-sync 注入的
      // system 患者上下文提示（含真实 patientId，供 AI 调 MCP 工具）必须保持原文，
      // 否则 AI 拿到掩码后的 patientId，medai_* 工具调用必然失败（查无此患者）。
      let cleaned = decision.messages.map((m) => {
        if (typeof m?.content === 'string' && m.role !== 'system') {
          return { ...m, content: maskPii(nameMapper.apply(m.content).text) };
        }
        return m;
      });
      if (medaiToolsMissing(ctx)) {
        cleaned = ensureDegradedPrompt(cleaned);
      }
      return { ...decision, messages: cleaned };
    }
    return decision;
  });
}
