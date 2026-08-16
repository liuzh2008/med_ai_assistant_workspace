/**
 * staleCleaner 测试（P6-C11，US-N2-05 三层清理-定时兜底分支）。
 *
 * 验收标准（对齐 US-N2-05 + 实现方案 §4.3 cleaner 表格）：
 *   - DSH 启动 + 每晚：删 mtime 超 3 天（默认 staleDays）未访问的会话文件；
 *   - 删无映射的孤儿文件（无患者归属，直接删）；
 *   - **在院患者的会话不受影响**（不误删）。
 *
 * 设计语义：listSessionFiles/deleteSession 依赖注入（S1 会话文件 API 替换点，
 * 含 DSH 看门狗文件扫描）；staleDays/now 可注入（测试与 cordis 配置）。
 */

import { describe, expect, it, vi } from 'vitest'
import { createStaleCleaner } from './staleCleaner'
import type { StaleCleanerDeps, StaleSessionFile } from './staleCleaner'

const NOW = 1_000_000_000_000 // 固定虚拟时刻
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000

function makeDeps(overrides?: Partial<StaleCleanerDeps>) {
  const deps: StaleCleanerDeps = {
    listSessionFiles: vi.fn(async () => []),
    getMappedSessionIds: vi.fn(() => new Set<string>()),
    isInpatientSession: vi.fn(async () => false),
    deleteSession: vi.fn(async () => undefined),
    staleDays: 3,
    now: () => NOW,
    ...overrides,
  }
  return deps
}

function makeFile(sessionId: string, ageMs: number): StaleSessionFile {
  return { sessionId, mtimeMs: NOW - ageMs }
}

describe('staleCleaner 定时兜底清理（US-N2-05）', () => {
  it('mtime 超 3 天未访问 → 删除该会话文件', async () => {
    const deps = makeDeps({
      listSessionFiles: vi.fn(async () => [makeFile('s-stale', THREE_DAYS_MS + 1000)]),
      getMappedSessionIds: vi.fn(() => new Set(['s-stale'])),
    })
    const cleaner = createStaleCleaner(deps)

    const deleted = await cleaner.runStaleCleanup()

    expect(deleted).toBe(1)
    expect(deps.deleteSession).toHaveBeenCalledWith('s-stale')
  })

  it('无映射的孤儿文件 → 删除（不查在院，无患者归属）', async () => {
    const deps = makeDeps({
      listSessionFiles: vi.fn(async () => [makeFile('s-orphan', 1000)]),
      getMappedSessionIds: vi.fn(() => new Set(['s-mapped'])),
    })
    const cleaner = createStaleCleaner(deps)

    const deleted = await cleaner.runStaleCleanup()

    expect(deleted).toBe(1)
    expect(deps.deleteSession).toHaveBeenCalledWith('s-orphan')
    expect(deps.isInpatientSession).not.toHaveBeenCalled()
  })

  it('mtime 未超 3 天 → 不删', async () => {
    const deps = makeDeps({
      listSessionFiles: vi.fn(async () => [makeFile('s-fresh', THREE_DAYS_MS - 1000)]),
      getMappedSessionIds: vi.fn(() => new Set(['s-fresh'])),
    })
    const cleaner = createStaleCleaner(deps)

    const deleted = await cleaner.runStaleCleanup()

    expect(deleted).toBe(0)
    expect(deps.deleteSession).not.toHaveBeenCalled()
  })

  it('在院患者的会话（mtime 超 3 天）→ 不误删', async () => {
    const deps = makeDeps({
      listSessionFiles: vi.fn(async () => [makeFile('s-inpatient', THREE_DAYS_MS + 5000)]),
      getMappedSessionIds: vi.fn(() => new Set(['s-inpatient'])),
      isInpatientSession: vi.fn(async () => true),
    })
    const cleaner = createStaleCleaner(deps)

    const deleted = await cleaner.runStaleCleanup()

    expect(deleted).toBe(0)
    expect(deps.deleteSession).not.toHaveBeenCalled()
  })
})
