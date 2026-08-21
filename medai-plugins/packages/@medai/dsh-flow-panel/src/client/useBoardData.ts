/**
 * useBoardData（G4 呈现面数据 hook，TDD 指南 C12）。
 *
 * 轮询拉取 G3 同源端点 GET /medai/flow-board（契约①），容错解析为 BoardData；
 * 后端不可达/非 2xx → data=null（组件降级隐藏/提示），零异常。
 * cancelFlow：看板「取消」按钮动作（契约②，经 G3 端点 POST 转发）。
 *
 * @module @medai/dsh-flow-panel/client/useBoardData
 */

import { useCallback, useEffect, useState } from 'react'
import { parseBoardData, type BoardData } from '../boardModel.js'

/** 同源端点（DSH GUI 3080，host 半 G3 注册）。 */
export const FLOW_BOARD_URL = '/medai/flow-board'
export const FLOW_BOARD_CANCEL_URL = '/medai/flow-board/cancel'

export interface BoardState {
  data: BoardData | null
  reload: () => void
}

/**
 * 轮询看板数据（默认 30s；返回 reload 供手动刷新/取消后重载）。
 */
export function useBoardData(intervalMs = 30_000): BoardState {
  const [data, setData] = useState<BoardData | null>(null)

  const reload = useCallback(async () => {
    try {
      const resp = await fetch(FLOW_BOARD_URL)
      if (!resp.ok) {
        setData(null)
        return
      }
      setData(parseBoardData(await resp.json()))
    } catch {
      setData(null)
    }
  }, [])

  useEffect(() => {
    void reload()
    const timer = setInterval(() => void reload(), intervalMs)
    return () => clearInterval(timer)
  }, [reload, intervalMs])

  return { data, reload }
}

export interface CancelOutcome {
  ok: boolean
  message: string
}

/**
 * 取消失败/进行中流程（契约②）；失败返回结构化中文原因（不回显内部细节）。
 */
export async function cancelFlow(patientId: string): Promise<CancelOutcome> {
  try {
    const resp = await fetch(FLOW_BOARD_CANCEL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId }),
    })
    let payload: { cancelled?: unknown; message?: unknown } = {}
    try {
      payload = (await resp.json()) as { cancelled?: unknown; message?: unknown }
    } catch {
      payload = {}
    }
    if (resp.ok && payload.cancelled !== false) {
      return { ok: true, message: typeof payload.message === 'string' ? payload.message : '流程已取消' }
    }
    return {
      ok: false,
      message: typeof payload.message === 'string' ? payload.message : '取消失败，请稍后重试',
    }
  } catch {
    return { ok: false, message: '网络异常，取消失败' }
  }
}
