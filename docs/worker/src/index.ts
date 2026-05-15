/**
 * @description Cloudflare Worker 入口 - 处理 AI 聊天请求，转发至 GitHub Models API
 * @module medai-docs-ai-worker
 */
import { getSystemPrompt, getKnowledgeContext } from './knowledge';
import { checkRateLimit } from './ratelimit';

export interface Env {
  DEEPSEEK_API_KEY: string;
  RATE_LIMIT: KVNamespace;
  ALLOWED_ORIGIN?: string;
}

/**
 * @description 生成 CORS 响应头
 * @param {string} origin - 请求来源域名
 * @returns {Record<string, string>} CORS 响应头键值对
 */
function getCorsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * @description 根据环境变量和请求来源解析允许的 CORS Origin
 * @param {Request} request - 原始请求对象
 * @param {Env} env - Worker 环境变量
 * @returns {string} 允许的 Origin 值
 */
function resolveCorsOrigin(request: Request, env: Env): string {
  const allowedOrigin = env.ALLOWED_ORIGIN || '*';
  const requestOrigin = request.headers.get('Origin') || '';
  if (allowedOrigin === '*') {
    return requestOrigin || '*';
  }
  return allowedOrigin;
}

/**
 * @description 处理 CORS 预检请求（OPTIONS）
 * @param {Request} request - 原始请求对象
 * @param {Env} env - Worker 环境变量
 * @returns {Response} 204 No Response 含 CORS 头
 */
function handleOptions(request: Request, env: Env): Response {
  const corsOrigin = resolveCorsOrigin(request, env);
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(corsOrigin),
  });
}

/**
 * @description 处理 AI 聊天请求：限流校验 → 构建 Prompt → 调用 GitHub Models API → 流式返回 SSE
 * @param {Request} request - 原始请求对象
 * @param {Env} env - Worker 环境变量
 * @returns {Promise<Response>} 流式 SSE 响应或错误响应
 */
async function handleChat(request: Request, env: Env): Promise<Response> {
  const corsOrigin = resolveCorsOrigin(request, env);

  // 限流检查
  const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rateLimit = await checkRateLimit(clientIp, env.RATE_LIMIT);

  if (!rateLimit.allowed) {
    return new Response(
      JSON.stringify({ error: '请求过于频繁，请稍后再试' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          ...getCorsHeaders(corsOrigin),
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }

  // 解析请求体
  let body: {
    message?: string;
    history?: Array<{ role: string; content: string }>;
  };
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: '请求体格式错误，无法解析为 JSON' }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          ...getCorsHeaders(corsOrigin),
        },
      }
    );
  }

  const message = body.message;
  if (!message || typeof message !== 'string') {
    return new Response(
      JSON.stringify({ error: 'message 字段必填且必须为字符串' }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          ...getCorsHeaders(corsOrigin),
        },
      }
    );
  }

  // 构建消息数组
  const systemPrompt = getSystemPrompt();
  const knowledgeContext = getKnowledgeContext();

  const messages: Array<{ role: string; content: string }> = [
    {
      role: 'system',
      content:
        systemPrompt +
        (knowledgeContext
          ? '\n\n以下是系统知识库内容，请基于这些内容回答用户问题：\n' +
            knowledgeContext
          : ''),
    },
  ];

  if (body.history && Array.isArray(body.history)) {
    for (const h of body.history) {
      if (
        h &&
        typeof h === 'object' &&
        typeof h.role === 'string' &&
        typeof h.content === 'string'
      ) {
        messages.push({ role: h.role, content: h.content });
      }
    }
  }

  messages.push({ role: 'user', content: message });

  // 调用 DeepSeek API
  let apiResponse: Response;
  try {
    apiResponse = await fetch(
      'https://api.deepseek.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'deepseek-v4-flash',
          messages,
          stream: true,
          temperature: 0.7,
          max_tokens: 4096,
        }),
      }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: 'AI 服务调用失败', detail: String(e) }),
      {
        status: 502,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          ...getCorsHeaders(corsOrigin),
        },
      }
    );
  }

  if (!apiResponse.ok) {
    const errorText = await apiResponse.text();
    return new Response(
      JSON.stringify({
        error: 'AI 服务调用失败',
        status: apiResponse.status,
        detail: errorText,
      }),
      {
        status: 502,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          ...getCorsHeaders(corsOrigin),
        },
      }
    );
  }

  if (!apiResponse.body) {
    return new Response(
      JSON.stringify({ error: 'AI 服务响应为空' }),
      {
        status: 502,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          ...getCorsHeaders(corsOrigin),
        },
      }
    );
  }

  // 流式返回 SSE
  return new Response(apiResponse.body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      ...getCorsHeaders(corsOrigin),
      'X-RateLimit-Remaining': String(rateLimit.remaining),
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return handleOptions(request, env);
    }

    if (request.method === 'POST' && url.pathname === '/api/chat') {
      return handleChat(request, env);
    }

    const corsOrigin = resolveCorsOrigin(request, env);

    return new Response(
      JSON.stringify({ error: 'Not Found' }),
      {
        status: 404,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          ...getCorsHeaders(corsOrigin),
        },
      }
    );
  },
};
