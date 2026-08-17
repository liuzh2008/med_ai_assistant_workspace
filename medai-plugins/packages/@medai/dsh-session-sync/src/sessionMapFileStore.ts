/**
 * sessionMapFileStore（P6-A1 拆分）——node:fs 文件持久化实现。
 *
 * 从 sessionMap.ts 拆出：`createFileSessionMapStore` 依赖 node:fs，
 * 而 client bundle（浏览器）不得触碰 node 模块——拆分后 sessionMap.ts
 * 为纯逻辑（navigator/store 注入），文件 store 仅 host/测试侧引用。
 *
 * 原子写 = 同目录临时文件写入 + rename（杜绝半写文件被读）；
 * 文件不存在/损坏 → load 返回空映射（不抛，后续重建）。
 *
 * @module @medai/dsh-session-sync/sessionMapFileStore
 */

import { promises as fs } from 'node:fs'
import type { FsPromisesLike } from './fsTypes'
import type { SessionMapStore } from './sessionMap'

/**
 * 文件持久化实现：`{contextKey: sessionId}` 写 `map.json`。
 */
export function createFileSessionMapStore(
  filePath: string,
  fsImpl: FsPromisesLike = fs,
): SessionMapStore {
  return {
    async load() {
      try {
        return JSON.parse(await fsImpl.readFile(filePath, 'utf8')) as Record<string, string>
      } catch {
        return {}
      }
    },
    async save(map: Record<string, string>) {
      const tmpPath = `${filePath}.tmp`
      await fsImpl.writeFile(tmpPath, JSON.stringify(map, null, 2), 'utf8')
      await fsImpl.rename(tmpPath, filePath)
    },
  }
}
