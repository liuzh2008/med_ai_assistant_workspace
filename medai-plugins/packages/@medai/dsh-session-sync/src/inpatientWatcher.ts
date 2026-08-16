/**
 * inpatientWatcher（P6-C11，US-N2-05 在院清单定时对比）。
 *
 * DSH 启动 + 每 checkIntervalMs（默认 6h）拉取 `GET /api/mcp/archive/
 * inpatients`（JWT 鉴权，N3 端点）：清单对比本地映射——清单缺失的患者
 * → 触发 discharge 清理（共用 dischargeCleaner）；**拉取失败（N3 不可达）
 * → 跳过本轮**（不误删，降级铁律）。
 *
 * 设计语义：contextKey 格式 `patientId|admissionTime`（N1 组装约定，联调
 * 校正点），extractPatientId 只提取 patientId 用于清单对比，零医疗判断。
 *
 * @module @medai/dsh-session-sync/inpatientWatcher
 */

/** contextKey（N1 组装 `patientId|admissionTime`）提取患者 ID。 */
export function extractPatientId(contextKey: string): string {
  const sep = contextKey.indexOf('|')
  return sep === -1 ? contextKey : contextKey.slice(0, sep)
}

export interface InpatientWatcherDeps {
  /** 拉取在院 patientId 清单；失败返回 null（跳过本轮）。 */
  fetchInpatients: () => Promise<string[] | null>
  /** 本地映射的 contextKey 列表（清单对比；discharge 清理需 contextKey）。 */
  getLocalContextKeys: () => string[]
  /** 清单缺失的患者 → 出院清理（dischargeCleaner.onPatientDischarged）。 */
  onPatientDischarged: (contextKey: string) => Promise<void>
  /** 对比周期（默认 6h = inpatientCheckIntervalMs）。 */
  checkIntervalMs?: number
}

export interface InpatientWatcher {
  /** 启动：立即检查一次 + 按周期定时对比。 */
  start(): void
  /** 手动触发一次对比（启动/测试用）。 */
  checkNow(): Promise<void>
  /** 停止定时器（插件卸载时调用）。 */
  dispose(): void
}

export function createInpatientWatcher(deps: InpatientWatcherDeps): InpatientWatcher {
  const intervalMs = deps.checkIntervalMs ?? 6 * 60 * 60 * 1000
  let timer: ReturnType<typeof setTimeout> | undefined

  async function checkNow(): Promise<void> {
    const inpatients = await deps.fetchInpatients()
    if (inpatients === null) return // 拉取失败：跳过本轮，不误删
    const inpatientSet = new Set(inpatients)

    for (const contextKey of deps.getLocalContextKeys()) {
      if (!inpatientSet.has(extractPatientId(contextKey))) {
        await deps.onPatientDischarged(contextKey)
      }
    }
  }

  return {
    start(): void {
      void checkNow() // 启动立即检查
      timer = setInterval(() => {
        void checkNow()
      }, intervalMs)
    },
    checkNow,
    dispose(): void {
      if (timer !== undefined) {
        clearInterval(timer)
        timer = undefined
      }
    },
  }
}
