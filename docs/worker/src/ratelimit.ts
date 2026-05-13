/**
 * @description IP 限流模块 - 基于 Cloudflare KV 实现每小时请求频率限制
 * @module medai-docs-ai-worker/ratelimit
 */

/** 每小时允许的最大请求数 */
const RATE_LIMIT_PER_HOUR = 20;
/** KV 键的过期时间（秒） */
const TTL_SECONDS = 3600;

/**
 * @description 检查指定 IP 的请求频率是否超过限制
 * @param {string} ip - 客户端 IP 地址
 * @param {KVNamespace} kv - Cloudflare KV 命名空间
 * @returns {Promise<{allowed: boolean, remaining: number}>} 是否允许及剩余配额
 */
export async function checkRateLimit(
  ip: string,
  kv: KVNamespace
): Promise<{ allowed: boolean; remaining: number }> {
  const now = new Date();
  const hour =
    `${now.getUTCFullYear()}` +
    `${String(now.getUTCMonth() + 1).padStart(2, '0')}` +
    `${String(now.getUTCDate()).padStart(2, '0')}` +
    `${String(now.getUTCHours()).padStart(2, '0')}`;

  const key = `rate:${ip}:${hour}`;
  const current = await kv.get(key);
  const count = current ? parseInt(current, 10) : 0;

  if (count >= RATE_LIMIT_PER_HOUR) {
    return { allowed: false, remaining: 0 };
  }

  await kv.put(key, String(count + 1), { expirationTtl: TTL_SECONDS });
  return { allowed: true, remaining: RATE_LIMIT_PER_HOUR - count - 1 };
}
