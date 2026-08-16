/**
 * node:fs/promises 接口子集（sessionMap/syncEngine/cleaner 文件持久化注入用）。
 *
 * 取本项目仅用到的三个方法，避免绑定完整 node 类型（测试与 DSH 环境
 * 均以最小 fake 注入）。
 */

import type { promises as fs } from 'node:fs'

export type FsPromisesLike = Pick<typeof fs, 'readFile' | 'writeFile' | 'rename'>
