/**
 * sessionMap 测试（P6-C6，US-N2-02 每患者一会话分治）。
 *
 * 验收标准：
 *   1. 首次 contextKey 未命中 → 创建新 DSH 会话并登记映射，持久化到 map.json（原子写）；
 *   2. 再次同一 contextKey → 命中 → 导航恢复原会话（不新建）；
 *   3. 重入院 contextKey 变化 → 未命中 → 新建会话（N2 零医疗判断）；
 *   4. 映射文件已存在且 DSH 重启 → 启动加载全部恢复，不产生重复会话。
 *
 * 设计语义（对齐实现方案 §4.3 sessionMap 节 + S1 spike 结论）：
 *   - select(contextKey) 为唯一入口：命中且会话存在 → open 恢复；未命中或
 *     会话已消失（看门狗清理等）→ create 新建并更新映射，变更即持久化；
 *   - 持久化失败不阻塞（对话照常，下次变更再写）；内存映射始终可用；
 *   - navigator/store 注入（sessionNavigator 接口隔离 S1 替换点）。
 */

import { describe, expect, it, vi } from 'vitest'
import { createSessionMap, createFileSessionMapStore } from './sessionMap'
import { mkdtempSync, readFileSync, existsSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const KEY_A1 = 'P000123|A1'
const KEY_A2 = 'P000123|A2' // 重入院：key 变化
const KEY_B1 = 'P000456|B1'

/** 内存 fake：navigator 维护“现存会话”集合，store 维护持久化映射。 */
function makeFakes(initialAlive: string[] = []) {
  const alive = new Set(initialAlive)
  let seq = 0
  let persisted: Record<string, string> = {}
  const navigator = {
    open: vi.fn(async (sessionId: string) => alive.has(sessionId)),
    create: vi.fn(async () => {
      const id = `session-${++seq}`
      alive.add(id)
      return id
    }),
  }
  const store = {
    load: vi.fn(async () => ({ ...persisted })),
    save: vi.fn(async (map: Record<string, string>) => {
      persisted = { ...map }
    }),
  }
  return { navigator, store, alive, getPersisted: () => persisted }
}

describe('sessionMap（US-N2-02 每患者一会话分治）', () => {
  it('未命中：创建新会话并登记映射，变更即持久化', async () => {
    const { navigator, store } = makeFakes()
    const sm = await createSessionMap(navigator, store)

    const r = await sm.select(KEY_A1)

    expect(r.created).toBe(true)
    expect(r.sessionId).toMatch(/^session-\d+$/)
    expect(navigator.create).toHaveBeenCalledTimes(1)
    expect(navigator.open).not.toHaveBeenCalled()
    // 登记 + 持久化（原子写入口）
    expect(sm.get(KEY_A1)).toBe(r.sessionId)
    expect(store.save).toHaveBeenCalledWith({ [KEY_A1]: r.sessionId })
  })

  it('命中：导航恢复原会话，不新建', async () => {
    const { navigator, store } = makeFakes()
    const sm = await createSessionMap(navigator, store)
    const first = await sm.select(KEY_A1)

    const r = await sm.select(KEY_A1)

    expect(r.created).toBe(false)
    expect(r.sessionId).toBe(first.sessionId)
    expect(navigator.open).toHaveBeenCalledWith(first.sessionId)
    expect(navigator.create).toHaveBeenCalledTimes(1) // 仅首次创建
    expect(store.save).toHaveBeenCalledTimes(1) // 第二次命中不再持久化
  })

  it('重入院（key 变化）：未命中 → 新建独立会话，互不影响', async () => {
    const { navigator } = makeFakes()
    const sm = await createSessionMap(navigator, makeFakes().store)
    const a1 = await sm.select(KEY_A1)

    const r = await sm.select(KEY_A2)

    expect(r.created).toBe(true)
    expect(r.sessionId).not.toBe(a1.sessionId)
    expect(sm.get(KEY_A1)).toBe(a1.sessionId)
    expect(sm.get(KEY_A2)).toBe(r.sessionId)
  })

  it('命中但会话已消失（看门狗清理等）：重建会话并更新映射', async () => {
    const f = makeFakes()
    const sm = await createSessionMap(f.navigator, f.store)
    const first = await sm.select(KEY_A1)
    f.alive.delete(first.sessionId) // 模拟 DSH 侧会话丢失

    const r = await sm.select(KEY_A1)

    expect(r.created).toBe(true)
    expect(r.sessionId).not.toBe(first.sessionId)
    expect(sm.get(KEY_A1)).toBe(r.sessionId)
  })

  it('启动加载：store 已有映射 → 全部恢复且不产生重复会话', async () => {
    const preloaded: Record<string, string> = { [KEY_A1]: 'session-1', [KEY_B1]: 'session-2' }
    const f = makeFakes(['session-1', 'session-2']) // 预加载会话在 DSH 侧仍存在
    f.store.load.mockResolvedValueOnce({ ...preloaded })

    const sm = await createSessionMap(f.navigator, f.store)

    // 直接命中既有会话：open 恢复，不 create
    const r = await sm.select(KEY_A1)
    expect(r.created).toBe(false)
    expect(r.sessionId).toBe('session-1')
    const rb = await sm.select(KEY_B1)
    expect(rb.sessionId).toBe('session-2')
    expect(f.navigator.create).not.toHaveBeenCalled()
  })

  it('持久化失败不阻塞：select 仍返回新会话，内存映射可用', async () => {
    const { navigator, store } = makeFakes()
    store.save.mockRejectedValueOnce(new Error('disk full'))
    const sm = await createSessionMap(navigator, store)

    const r = await sm.select(KEY_A1)

    expect(r.created).toBe(true)
    expect(sm.get(KEY_A1)).toBe(r.sessionId)
    // 后续变更仍可继续（不因一次失败卡死）
    const r2 = await sm.select(KEY_A2)
    expect(r2.created).toBe(true)
  })

  it('remove：删除映射条目并持久化（P6-C11 出院清理用）', async () => {
    const f = makeFakes()
    const sm = await createSessionMap(f.navigator, f.store)
    await sm.select(KEY_A1)
    await sm.select(KEY_A2)

    await sm.remove(KEY_A1)

    expect(sm.get(KEY_A1)).toBeUndefined()
    expect(sm.get(KEY_A2)).toBeDefined() // 其他条目不受影响
    expect(f.store.save).toHaveBeenLastCalledWith({ [KEY_A2]: sm.get(KEY_A2) })
  })

  it('remove 不存在的 key：空操作不抛、不持久化', async () => {
    const f = makeFakes()
    const sm = await createSessionMap(f.navigator, f.store)
    const saveCalls = f.store.save.mock.calls.length

    await sm.remove(KEY_A1)

    expect(f.store.save.mock.calls.length).toBe(saveCalls)
  })

  it('文件 store：原子写（临时文件 + rename），save 后无 .tmp 残留', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'session-map-'))
    const file = join(dir, 'map.json')
    const store = createFileSessionMapStore(file)

    expect(await store.load()).toEqual({}) // 文件不存在 → 空映射

    await store.save({ [KEY_A1]: 'session-1' })
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ [KEY_A1]: 'session-1' })
    // 原子写：无临时文件残留
    expect(readdirSync(dir).filter((n) => n.includes('.tmp'))).toEqual([])
    expect(existsSync(file)).toBe(true)

    // 重新 load 恢复
    expect(await store.load()).toEqual({ [KEY_A1]: 'session-1' })
  })
})
