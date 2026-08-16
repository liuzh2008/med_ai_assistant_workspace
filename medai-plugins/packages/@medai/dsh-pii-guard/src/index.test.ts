import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { apply, sanitizeContent, DEGRADED_PROMPT, medaiToolsMissing } from './index';
import type { PluginContext, PreStepDecision } from './index';

const PATCH_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../patches/mcp-medai.patch.yml');

describe('@medai/dsh-pii-guard 插件装配', () => {
  function makeCtx() {
    const handlers = new Map<string, (payload: unknown, next: () => Promise<PreStepDecision>) => Promise<PreStepDecision>>();
    const ctx: PluginContext = {
      on: vi.fn((event: string, listener: never) => {
        handlers.set(event, listener as never);
      }) as unknown as PluginContext['on'],
    };
    return { ctx, handlers };
  }

  it('apply 应挂载 agent/pre-step 钩子', () => {
    const { ctx, handlers } = makeCtx();
    apply(ctx);
    expect(handlers.has('agent/pre-step')).toBe(true);
  });

  it('pre-step 应改写进入步骤的用户消息（PII 掩码）', async () => {
    const { ctx, handlers } = makeCtx();
    apply(ctx);
    const listener = handlers.get('agent/pre-step')!;

    const decision = await listener(
      { agent: {}, messages: [{ role: 'user', content: '身份证110101199001011234' }], turn: 1, step: 1, signal: new AbortController().signal },
      async () => ({ kind: 'enter' as const, messages: [{ role: 'user', content: '身份证110101199001011234' }] }),
    );

    expect(decision.kind).toBe('enter');
    expect(decision.messages![0].content).toBe('身份证1101**********1234');
  });

  it('pre-step 下游拒绝 应透传不改写', async () => {
    const { ctx, handlers } = makeCtx();
    apply(ctx);
    const listener = handlers.get('agent/pre-step')!;

    const decision = await listener(
      { agent: {}, messages: [{ role: 'user', content: '身份证110101199001011234' }], turn: 1, step: 1, signal: new AbortController().signal },
      async () => ({ kind: 'reject' as const, reason: 'blocked' }),
    );

    expect(decision.kind).toBe('reject');
    expect(decision.reason).toBe('blocked');
  });

  it('非字符串 content 消息 应原样保留', async () => {
    const { ctx, handlers } = makeCtx();
    apply(ctx);
    const listener = handlers.get('agent/pre-step')!;

    const decision = await listener(
      { agent: {}, messages: [{ role: 'user', content: [{ type: 'image' }] }], turn: 1, step: 1, signal: new AbortController().signal },
      async () => ({ kind: 'enter' as const, messages: [{ role: 'user', content: [{ type: 'image' }] }] }),
    );

    expect(decision.messages![0].content).toEqual([{ type: 'image' }]);
  });
});

describe('mcp-medai.patch.yml 接线配置（M1-C3）', () => {
  it('failOnStartupError 应为 false（与网关解绑：宕机时 DSH 照常启动，明示降级由本插件承担）', () => {
    const patch = readFileSync(PATCH_PATH, 'utf8');
    expect(patch).toContain('failOnStartupError: false');
  });

  it('应配置 serverName=medai 与 streamable-http', () => {
    const patch = readFileSync(PATCH_PATH, 'utf8');
    expect(patch).toContain('serverName: medai');
    expect(patch).toContain('transport: streamable-http');
  });
});

describe('sanitizeContent', () => {
  it('PII 掩码 + 姓名映射（可注入映射表）', () => {
    expect(sanitizeContent('张伟手机13800138000', 's1', { 张伟: '3床患者' }))
      .toBe('3床患者手机138****8000');
  });

  it('无映射 降级纯正则', () => {
    expect(sanitizeContent('身份证110101199001011234')).toBe('身份证1101**********1234');
  });
});

describe('工具在位明示降级（与网关解绑：failOnStartupError:false）', () => {
  function toolsCtx(schemas: Array<{ name: string }>) {
    const handlers = new Map<string, (payload: unknown, next: () => Promise<PreStepDecision>) => Promise<PreStepDecision>>();
    const ctx = {
      tools: { schemas: () => schemas, get: () => undefined },
      on: vi.fn((event: string, listener: never) => { handlers.set(event, listener as never); }) as unknown as PluginContext['on'],
    };
    return { ctx, handlers };
  }

  it('medai 工具缺失（网关不可达 → 零工具）应注入降级提示', async () => {
    const { ctx, handlers } = toolsCtx([]);
    apply(ctx);
    const listener = handlers.get('agent/pre-step')!;

    const decision = await listener(
      { agent: {}, messages: [], turn: 1, step: 1, signal: new AbortController().signal },
      async () => ({ kind: 'enter' as const, messages: [{ role: 'user', content: 'XX的检验结果如何' }] }),
    );

    const contents = decision.messages!.map((m) => m.content);
    expect(contents).toContain(DEGRADED_PROMPT);
  });

  it('medai 工具在位 不应注入降级提示', async () => {
    const { ctx, handlers } = toolsCtx([{ name: 'mcp__medai__medai_patient_list_by_department' }]);
    apply(ctx);
    const listener = handlers.get('agent/pre-step')!;

    const decision = await listener(
      { agent: {}, messages: [], turn: 1, step: 1, signal: new AbortController().signal },
      async () => ({ kind: 'enter' as const, messages: [{ role: 'user', content: 'XX的检验结果如何' }] }),
    );

    const contents = decision.messages!.map((m) => m.content);
    expect(contents).not.toContain(DEGRADED_PROMPT);
  });

  it('重复 pre-step 应只注入一次（去重，防对话膨胀）', async () => {
    const { ctx, handlers } = toolsCtx([]);
    apply(ctx);
    const listener = handlers.get('agent/pre-step')!;
    const payload = { agent: {}, messages: [], turn: 1, step: 1, signal: new AbortController().signal };

    const first = await listener(payload, async () => ({ kind: 'enter' as const, messages: [{ role: 'user', content: '问' }] }));
    const second = await listener(payload, async () => ({ kind: 'enter' as const, messages: [{ role: 'user', content: '再问' }] }));

    const count = (msgs: PreStepDecision['messages']) => msgs!.filter((m) => m.content === DEGRADED_PROMPT).length;
    expect(count(first.messages)).toBe(1);
    expect(count(second.messages)).toBe(1); // 前一步已注入，本轮消息带提示则不再注入
  });

  it('注册表查询异常 应视为工具在位（不误报降级）', () => {
    const ctx = { tools: { schemas: () => { throw new Error('boom'); }, get: () => undefined }, on: vi.fn() } as unknown as PluginContext;
    expect(medaiToolsMissing(ctx)).toBe(false);
  });

  it('工具缺失时 用户消息仍被 PII 掩码', async () => {
    const { ctx, handlers } = toolsCtx([]);
    apply(ctx);
    const listener = handlers.get('agent/pre-step')!;

    const decision = await listener(
      { agent: {}, messages: [], turn: 1, step: 1, signal: new AbortController().signal },
      async () => ({ kind: 'enter' as const, messages: [{ role: 'user', content: '身份证110101199001011234' }] }),
    );

    expect(decision.messages![0].content).toBe('身份证1101**********1234');
  });
});
