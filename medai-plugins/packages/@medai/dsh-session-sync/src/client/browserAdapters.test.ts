import { describe, expect, it, vi } from 'vitest'
import { createBrowserSessionMapStore, createSessionsNavigator, type BrowserStorageLike, type SessionsLike } from './browserAdapters'

function fakeStorage(initial: Record<string, string> = {}): BrowserStorageLike {
  const store = new Map(Object.entries(initial))
  return {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => { store.set(k, v) },
    removeItem: (k) => { store.delete(k) },
  }
}

describe('createBrowserSessionMapStore（localStorage 持久化）', () => {
  it('load 返回已存映射；save 持久化后再次 load 一致', async () => {
    const storage = fakeStorage()
    const store = createBrowserSessionMapStore(storage, 'medai.test.map')

    expect(await store.load()).toEqual({})
    await store.save({ 'P1|A1': 's-1', 'P2|A2': 's-2' })
    expect(await store.load()).toEqual({ 'P1|A1': 's-1', 'P2|A2': 's-2' })
    expect(storage.getItem('medai.test.map')).toContain('s-1')
  })

  it('损坏 JSON / 空值 load 返回空映射（不抛，对齐文件 store 容错）', async () => {
    const storage = fakeStorage({ 'medai.test.map': '{broken' })
    const store = createBrowserSessionMapStore(storage, 'medai.test.map')
    expect(await store.load()).toEqual({})

    const empty = fakeStorage({ 'medai.test.map': '' })
    expect(await createBrowserSessionMapStore(empty, 'medai.test.map').load()).toEqual({})
  })
})

describe('createSessionsNavigator（ctx.sessions 适配）', () => {
  it('open 既有会话返回 true；未知 id（抛错）返回 false', async () => {
    const sessions: SessionsLike = {
      open: (id: string) => {
        if (id === 's-exist') return
        throw new Error('unknown session id')
      },
    }
    const navigator = createSessionsNavigator({
      sessions,
      createSession: async () => 's-new',
    })

    expect(await navigator.open('s-exist')).toBe(true)
    expect(await navigator.open('s-ghost')).toBe(false)
  })

  it('create 走注入的 DSH 新会话 API（S1 联调接入点）', async () => {
    const navigator = createSessionsNavigator({
      sessions: { open: vi.fn() },
      createSession: async () => 's-created',
    })

    expect(await navigator.create()).toBe('s-created')
  })
})
