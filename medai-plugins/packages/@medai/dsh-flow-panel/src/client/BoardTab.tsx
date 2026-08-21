/**
 * BoardTab（G4 呈现面：conversation.view "流程看板" Tab，TDD 指南 C11/C12）。
 *
 * 视图环 Tab（与 Chat/Trajectory 并列，session scope）：
 *   统计卡（进行中/已完成/失败/已取消）→ 按病人聚合卡片（失败置顶标红，
 *   床号/姓名/流程摘要）→ 点击展开该病人流程明细（flowId/步骤/状态/失败原因/时间）
 *   → ACTIVE 流程「取消」按钮（契约②，复用 FlowCancelResult 语义）→
 *   30s 自动轮询 + 手动刷新按钮。
 * BoardView 为纯渲染视图（可测）；业务裁决（能否取消）由后端 G2。
 *
 * @module @medai/dsh-flow-panel/client/BoardTab
 */

import { createElement, useState, type ReactElement } from 'react'
import {
  flowLabel, patientFlowSummary, sortPatients, type BoardData, type PatientBoard,
} from '../boardModel.js'
import { flowStatusLabel } from '../model.js'
import { cancelFlow, useBoardData } from './useBoardData.js'

function toInt(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

/** 统计卡（四类计数）。 */
function StatCard({ label, value, cls }: { label: string; value: number; cls: string }): ReactElement {
  return createElement(
    'div',
    { className: `medai-board-stat ${cls}` },
    createElement('span', { className: 'medai-board-stat-value' }, String(value)),
    createElement('span', { className: 'medai-board-stat-label' }, label),
  )
}

/** 病人卡片（点击展开明细；失败红色；ACTIVE 可取消）。 */
function PatientCard({
  patient, expanded, busy, onToggle, onCancel,
}: {
  patient: PatientBoard
  expanded: boolean
  busy: boolean
  onToggle: () => void
  onCancel: () => void
}): ReactElement {
  const flows = Array.isArray(patient.flows) ? patient.flows : []
  const firstStatus = flows[0] && typeof flows[0] === 'object'
    ? (flows[0] as { status?: unknown }).status : undefined
  const isFailed = firstStatus === 'FAILED'
  const isActive = firstStatus === 'ACTIVE'
  const name = typeof patient.name === 'string' ? patient.name : ''
  const bed = typeof patient.bedNumber === 'string' ? patient.bedNumber : ''

  return createElement(
    'div',
    { className: `medai-board-patient${isFailed ? ' medai-board-patient-failed' : ''}` },
    createElement(
      'div',
      { className: 'medai-board-patient-head', onClick: onToggle },
      createElement('span', { className: 'medai-board-bed' }, `[${bed}]`),
      createElement('span', { className: 'medai-board-name' }, name),
      createElement('span', { className: 'medai-board-summary' }, patientFlowSummary(patient)),
      createElement('span', { className: 'medai-board-toggle' }, expanded ? '▾' : '▸'),
    ),
    expanded
      ? createElement(
        'div',
        { className: 'medai-board-detail' },
        flows.length === 0
          ? createElement('div', { className: 'medai-board-empty' }, '暂无流程任务')
          : flows.map((raw, idx) => {
            const item = (typeof raw === 'object' && raw !== null ? raw : {}) as {
              flowId?: unknown
              currentStep?: unknown
              status?: unknown
              failureReason?: unknown
              updatedAt?: unknown
            }
            const status = typeof item.status === 'string' ? item.status : '未知'
            return createElement(
              'div',
              { key: idx, className: `medai-board-flow medai-board-flow-${status.toLowerCase()}` },
              createElement('span', { className: 'medai-board-flow-name' }, flowLabel(item.flowId)),
              createElement('span', { className: 'medai-board-flow-status' }, flowStatusLabel(item.status)),
              typeof item.currentStep === 'string' && item.currentStep !== ''
                ? createElement('span', { className: 'medai-board-flow-step' }, String(item.currentStep))
                : null,
              typeof item.failureReason === 'string' && item.failureReason !== ''
                ? createElement('div', { className: 'medai-board-flow-reason' }, `原因：${item.failureReason}`)
                : null,
              typeof item.updatedAt === 'string' && item.updatedAt !== ''
                ? createElement('div', { className: 'medai-board-flow-time' }, item.updatedAt)
                : null,
              isActive
                ? createElement(
                  'button',
                  {
                    className: 'medai-board-cancel',
                    disabled: busy,
                    onClick: (e: { stopPropagation(): void }) => {
                      e.stopPropagation()
                      onCancel()
                    },
                  },
                  busy ? '取消中…' : '取消',
                )
                : null,
            )
          }),
      )
      : null,
  )
}

/** 纯渲染视图：统计卡 + 病人卡片 + 刷新/提示（数据与交互回调注入，可测）。 */
export function BoardView({
  board, expanded, busy, notice, onToggle, onCancel, onRefresh,
}: {
  board: BoardData | null
  expanded: string | null
  busy: string | null
  notice: string | null
  onToggle: (patientId: string) => void
  onCancel: (patient: PatientBoard) => void
  onRefresh: () => void
}): ReactElement {
  const counts = board?.counts ?? {}
  const patients = sortPatients(board?.patients ?? [])

  return createElement(
    'div',
    { className: 'medai-board' },
    createElement(
      'div',
      { className: 'medai-board-stats' },
      createElement(StatCard, { label: '进行中', value: toInt(counts.active), cls: 'stat-active' }),
      createElement(StatCard, { label: '已完成', value: toInt(counts.done), cls: 'stat-done' }),
      createElement(StatCard, { label: '失败', value: toInt(counts.failed), cls: 'stat-failed' }),
      createElement(StatCard, { label: '已取消', value: toInt(counts.cancelled), cls: 'stat-cancelled' }),
    ),
    createElement(
      'div',
      { className: 'medai-board-toolbar' },
      createElement('button', { className: 'medai-board-refresh', onClick: onRefresh }, '刷新'),
      notice ? createElement('span', { className: 'medai-board-notice' }, notice) : null,
    ),
    createElement(
      'div',
      { className: 'medai-board-list' },
      patients.length === 0
        ? createElement('div', { className: 'medai-board-empty' }, '暂无流程任务')
        : patients.map((patient) => {
          const patientId = typeof patient.patientId === 'string' ? patient.patientId : ''
          return createElement(PatientCard, {
            key: patientId,
            patient,
            expanded: expanded === patientId,
            busy: busy === patientId,
            onToggle: () => onToggle(patientId),
            onCancel: () => onCancel(patient),
          })
        }),
    ),
  )
}

/** 看板 Tab（接 G3 数据 + 交互编排；渲染委托 BoardView）。 */
export function BoardTab(): ReactElement {
  const { data, reload } = useBoardData(30_000)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [busyPatient, setBusyPatient] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const handleToggle = (patientId: string): void => {
    setExpanded(expanded === patientId ? null : patientId)
  }

  const handleCancel = async (patient: PatientBoard): Promise<void> => {
    const patientId = typeof patient.patientId === 'string' ? patient.patientId : ''
    if (patientId === '') return
    setBusyPatient(patientId)
    const outcome = await cancelFlow(patientId)
    setBusyPatient(null)
    setNotice(outcome.message)
    reload()
  }

  return createElement(BoardView, {
    board: data,
    expanded,
    busy: busyPatient,
    notice,
    onToggle: handleToggle,
    onCancel: (p) => void handleCancel(p),
    onRefresh: () => void reload(),
  })
}
