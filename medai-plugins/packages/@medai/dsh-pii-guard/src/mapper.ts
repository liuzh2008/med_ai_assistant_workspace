/**
 * 姓名映射消费（TDD 指南 US-M1-02 / M1-T2）。
 *
 * 消费 M2 下发的姓名映射表（内存驻留、只消费不生产、不落盘）；
 * 映射为空 → 降级为纯正则掩码（不抛异常、不阻断主链路）。
 */

export interface NameMapping {
  [realName: string]: string;
}

export interface ApplyResult {
  text: string;
  count: number;
}

/**
 * 纯函数替换：按映射表把真实姓名替换为泛化指代（长名优先，防子串误替换）。
 * 映射为空 → 原样返回、计数 0（降级）。
 */
export function applyNameMapping(text: string, mapping?: NameMapping | null): ApplyResult {
  if (!text || !mapping) {
    return { text, count: 0 };
  }
  const names = Object.keys(mapping)
    .filter((n) => n && n.length > 0)
    .sort((a, b) => b.length - a.length);
  let result = text;
  let count = 0;
  for (const name of names) {
    const alias = mapping[name];
    if (alias == null) continue;
    let idx: number;
    while ((idx = result.indexOf(name)) >= 0) {
      result = result.slice(0, idx) + alias + result.slice(idx + name.length);
      count++;
    }
  }
  return { text: result, count };
}

/**
 * 会话级姓名映射（内存 Map，按会话过期由上层清理；不落盘）。
 */
export class SessionNameMapper {
  private sessions = new Map<string, NameMapping>();

  register(sessionId: string, mapping: NameMapping): void {
    this.sessions.set(sessionId, { ...mapping });
  }

  apply(text: string, sessionId?: string | null): ApplyResult {
    const mapping = sessionId ? this.sessions.get(sessionId) : undefined;
    return applyNameMapping(text, mapping);
  }

  knownNames(sessionId?: string | null): string[] {
    const mapping = sessionId ? this.sessions.get(sessionId) : undefined;
    return mapping ? Object.keys(mapping) : [];
  }

  clear(): void {
    this.sessions.clear();
  }
}
