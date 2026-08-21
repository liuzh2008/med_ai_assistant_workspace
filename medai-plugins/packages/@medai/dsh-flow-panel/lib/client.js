window.__ModuleLoader__.load({
  id: "@medai/dsh-flow-panel",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;

var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  TOOL_KEYS: () => TOOL_KEYS,
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(index_exports);

// src/client/FlowPanel.tsx
var import_react = require("react");

// src/model.ts
var STEP_LABELS = {
  "gen-admission-record": "\u5165\u9662\u8BB0\u5F55\u751F\u6210\u4E2D",
  "wait-orders-window": "\u7B49\u5F85\u533B\u5631\u7A97\u53E3\uFF08\u7EA61\u5C0F\u65F6\uFF09",
  "gen-followups": "\u9996\u6B21\u75C5\u7A0B/\u5165\u9662\u6C9F\u901A\u751F\u6210\u4E2D"
};
var STATUS_LABELS = {
  ACTIVE: "\u8FDB\u884C\u4E2D",
  DONE: "\u5DF2\u5B8C\u6210",
  FAILED: "\u5931\u8D25",
  CANCELLED: "\u5DF2\u53D6\u6D88"
};
function flowStepLabel(step) {
  if (typeof step !== "string" || step === "") return "\u5F85\u542F\u52A8";
  return STEP_LABELS[step] ?? step;
}
function flowStatusLabel(status) {
  if (typeof status !== "string" || status === "") return "\u672A\u77E5";
  return STATUS_LABELS[status] ?? status;
}
function buildPanelModel(env) {
  if (typeof env !== "object" || env === null) return { tasks: [], empty: true };
  const items = env.items;
  if (!Array.isArray(items) || items.length === 0) return { tasks: [], empty: true };
  const tasks = [];
  for (const raw of items) {
    const item = typeof raw === "object" && raw !== null ? raw : {};
    tasks.push({
      flowId: typeof item.flowId === "string" && item.flowId !== "" ? item.flowId : "\u672A\u77E5\u6D41\u7A0B",
      stepLabel: flowStepLabel(item.currentStep),
      status: typeof item.status === "string" ? item.status : "\u672A\u77E5",
      statusLabel: flowStatusLabel(item.status),
      failureReason: typeof item.failureReason === "string" && item.failureReason !== "" ? item.failureReason : null,
      updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : ""
    });
  }
  return { tasks, empty: false };
}

// src/client/FlowPanel.tsx
function TaskRow({ task }) {
  return (0, import_react.createElement)(
    "div",
    { className: "medai-flow-task-row" },
    (0, import_react.createElement)("span", { className: "medai-flow-task-flow" }, task.flowId),
    (0, import_react.createElement)("span", { className: "medai-flow-task-step" }, task.stepLabel),
    (0, import_react.createElement)("span", { className: `medai-flow-task-status medai-flow-task-status-${task.status.toLowerCase()}` }, task.statusLabel),
    task.failureReason ? (0, import_react.createElement)("div", { className: "medai-flow-task-reason" }, `\u539F\u56E0\uFF1A${task.failureReason}`) : null,
    task.updatedAt ? (0, import_react.createElement)("div", { className: "medai-flow-task-time" }, task.updatedAt) : null
  );
}
function FlowPanel({ env }) {
  const model = buildPanelModel(env);
  if (model.empty) {
    return (0, import_react.createElement)("div", { className: "medai-flow-panel" }, "\u6682\u65E0\u6D41\u7A0B\u4EFB\u52A1");
  }
  return (0, import_react.createElement)(
    "div",
    { className: "medai-flow-panel" },
    model.tasks.map((task, idx) => (0, import_react.createElement)(TaskRow, { key: idx, task }))
  );
}

// src/client/BoardBadge.tsx
var import_react3 = require("react");

// src/boardModel.ts
var FLOW_LABELS = {
  "admission-first-mile": "\u9996\u8BCA\u6536\u6CBB"
};
function flowLabel(flowId) {
  if (typeof flowId !== "string" || flowId === "") return "\u6D41\u7A0B";
  return FLOW_LABELS[flowId] ?? flowId;
}
function toInt(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}
function parseBoardData(env) {
  if (typeof env !== "object" || env === null) return null;
  const counts = env.counts;
  const patients = env.patients;
  if (typeof counts !== "object" || counts === null) return null;
  if (!Array.isArray(patients)) return null;
  return {
    counts,
    patients
  };
}
function buildSummary(data) {
  if (!data) return null;
  const active = toInt(data.counts.active);
  const failed = toInt(data.counts.failed);
  return `${active} \u8FDB\u884C\u4E2D \xB7 ${failed} \u5931\u8D25`;
}
function isAlerted(data) {
  return data !== null && toInt(data.counts.failed) > 0;
}
function statusRank(item) {
  const first = Array.isArray(item.flows) ? item.flows[0] : void 0;
  const status = typeof first === "object" && first !== null ? first.status : void 0;
  if (status === "FAILED") return 0;
  if (status === "ACTIVE") return 1;
  return 2;
}
function sortPatients(patients) {
  if (!Array.isArray(patients)) return [];
  return [...patients].sort((a, b) => statusRank(a) - statusRank(b));
}
function patientFlowSummary(patient) {
  const flows = Array.isArray(patient.flows) ? patient.flows : [];
  if (flows.length === 0) return "\u6682\u65E0\u6D41\u7A0B\u4EFB\u52A1";
  const first = flows[0];
  const name2 = flowLabel(first.flowId);
  const step = flowStepLabel(first.currentStep);
  const status = flowStatusLabel(first.status);
  return `${name2}\xB7${step}\xB7${status}`;
}

// src/client/useBoardData.ts
var import_react2 = require("react");
var FLOW_BOARD_URL = "/medai/flow-board";
var FLOW_BOARD_CANCEL_URL = "/medai/flow-board/cancel";
function useBoardData(intervalMs = 3e4) {
  const [data, setData] = (0, import_react2.useState)(null);
  const reload = (0, import_react2.useCallback)(async () => {
    try {
      const resp = await fetch(FLOW_BOARD_URL);
      if (!resp.ok) {
        setData(null);
        return;
      }
      setData(parseBoardData(await resp.json()));
    } catch {
      setData(null);
    }
  }, []);
  (0, import_react2.useEffect)(() => {
    void reload();
    const timer = setInterval(() => void reload(), intervalMs);
    return () => clearInterval(timer);
  }, [reload, intervalMs]);
  return { data, reload };
}
async function cancelFlow(patientId) {
  try {
    const resp = await fetch(FLOW_BOARD_CANCEL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId })
    });
    let payload = {};
    try {
      payload = await resp.json();
    } catch {
      payload = {};
    }
    if (resp.ok && payload.cancelled !== false) {
      return { ok: true, message: typeof payload.message === "string" ? payload.message : "\u6D41\u7A0B\u5DF2\u53D6\u6D88" };
    }
    return {
      ok: false,
      message: typeof payload.message === "string" ? payload.message : "\u53D6\u6D88\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5"
    };
  } catch {
    return { ok: false, message: "\u7F51\u7EDC\u5F02\u5E38\uFF0C\u53D6\u6D88\u5931\u8D25" };
  }
}

// src/client/BoardBadge.tsx
function BadgeView({ summary, alerted }) {
  if (summary === null) {
    return (0, import_react3.createElement)("div", { className: "medai-flow-badge medai-flow-badge-hidden" });
  }
  return (0, import_react3.createElement)(
    "div",
    {
      className: `medai-flow-badge${alerted ? " medai-flow-badge-alert" : ""}`,
      title: "\u75C5\u4EBA\u5DE5\u4F5C\u6D41\u6982\u8981\uFF08\u70B9\u51FB\u52A9\u624B\u5185\u300C\u6D41\u7A0B\u770B\u677F\u300D\u67E5\u770B\u8BE6\u60C5\uFF09"
    },
    summary
  );
}
function BoardBadge() {
  const { data } = useBoardData(3e4);
  return (0, import_react3.createElement)(BadgeView, { summary: buildSummary(data), alerted: isAlerted(data) });
}

// src/client/BoardTab.tsx
var import_react4 = require("react");
function toInt2(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}
function StatCard({ label, value, cls }) {
  return (0, import_react4.createElement)(
    "div",
    { className: `medai-board-stat ${cls}` },
    (0, import_react4.createElement)("span", { className: "medai-board-stat-value" }, String(value)),
    (0, import_react4.createElement)("span", { className: "medai-board-stat-label" }, label)
  );
}
function PatientCard({
  patient,
  expanded,
  busy,
  onToggle,
  onCancel
}) {
  const flows = Array.isArray(patient.flows) ? patient.flows : [];
  const firstStatus = flows[0] && typeof flows[0] === "object" ? flows[0].status : void 0;
  const isFailed = firstStatus === "FAILED";
  const isActive = firstStatus === "ACTIVE";
  const name2 = typeof patient.name === "string" ? patient.name : "";
  const bed = typeof patient.bedNumber === "string" ? patient.bedNumber : "";
  return (0, import_react4.createElement)(
    "div",
    { className: `medai-board-patient${isFailed ? " medai-board-patient-failed" : ""}` },
    (0, import_react4.createElement)(
      "div",
      { className: "medai-board-patient-head", onClick: onToggle },
      (0, import_react4.createElement)("span", { className: "medai-board-bed" }, `[${bed}]`),
      (0, import_react4.createElement)("span", { className: "medai-board-name" }, name2),
      (0, import_react4.createElement)("span", { className: "medai-board-summary" }, patientFlowSummary(patient)),
      (0, import_react4.createElement)("span", { className: "medai-board-toggle" }, expanded ? "\u25BE" : "\u25B8")
    ),
    expanded ? (0, import_react4.createElement)(
      "div",
      { className: "medai-board-detail" },
      flows.length === 0 ? (0, import_react4.createElement)("div", { className: "medai-board-empty" }, "\u6682\u65E0\u6D41\u7A0B\u4EFB\u52A1") : flows.map((raw, idx) => {
        const item = typeof raw === "object" && raw !== null ? raw : {};
        const status = typeof item.status === "string" ? item.status : "\u672A\u77E5";
        return (0, import_react4.createElement)(
          "div",
          { key: idx, className: `medai-board-flow medai-board-flow-${status.toLowerCase()}` },
          (0, import_react4.createElement)("span", { className: "medai-board-flow-name" }, flowLabel(item.flowId)),
          (0, import_react4.createElement)("span", { className: "medai-board-flow-status" }, flowStatusLabel(item.status)),
          typeof item.currentStep === "string" && item.currentStep !== "" ? (0, import_react4.createElement)("span", { className: "medai-board-flow-step" }, String(item.currentStep)) : null,
          typeof item.failureReason === "string" && item.failureReason !== "" ? (0, import_react4.createElement)("div", { className: "medai-board-flow-reason" }, `\u539F\u56E0\uFF1A${item.failureReason}`) : null,
          typeof item.updatedAt === "string" && item.updatedAt !== "" ? (0, import_react4.createElement)("div", { className: "medai-board-flow-time" }, item.updatedAt) : null,
          isActive ? (0, import_react4.createElement)(
            "button",
            {
              className: "medai-board-cancel",
              disabled: busy,
              onClick: (e) => {
                e.stopPropagation();
                onCancel();
              }
            },
            busy ? "\u53D6\u6D88\u4E2D\u2026" : "\u53D6\u6D88"
          ) : null
        );
      })
    ) : null
  );
}
function BoardView({
  board,
  expanded,
  busy,
  notice,
  onToggle,
  onCancel,
  onRefresh
}) {
  const counts = board?.counts ?? {};
  const patients = sortPatients(board?.patients ?? []);
  return (0, import_react4.createElement)(
    "div",
    { className: "medai-board" },
    (0, import_react4.createElement)(
      "div",
      { className: "medai-board-stats" },
      (0, import_react4.createElement)(StatCard, { label: "\u8FDB\u884C\u4E2D", value: toInt2(counts.active), cls: "stat-active" }),
      (0, import_react4.createElement)(StatCard, { label: "\u5DF2\u5B8C\u6210", value: toInt2(counts.done), cls: "stat-done" }),
      (0, import_react4.createElement)(StatCard, { label: "\u5931\u8D25", value: toInt2(counts.failed), cls: "stat-failed" }),
      (0, import_react4.createElement)(StatCard, { label: "\u5DF2\u53D6\u6D88", value: toInt2(counts.cancelled), cls: "stat-cancelled" })
    ),
    (0, import_react4.createElement)(
      "div",
      { className: "medai-board-toolbar" },
      (0, import_react4.createElement)("button", { className: "medai-board-refresh", onClick: onRefresh }, "\u5237\u65B0"),
      notice ? (0, import_react4.createElement)("span", { className: "medai-board-notice" }, notice) : null
    ),
    (0, import_react4.createElement)(
      "div",
      { className: "medai-board-list" },
      patients.length === 0 ? (0, import_react4.createElement)("div", { className: "medai-board-empty" }, "\u6682\u65E0\u6D41\u7A0B\u4EFB\u52A1") : patients.map((patient) => {
        const patientId = typeof patient.patientId === "string" ? patient.patientId : "";
        return (0, import_react4.createElement)(PatientCard, {
          key: patientId,
          patient,
          expanded: expanded === patientId,
          busy: busy === patientId,
          onToggle: () => onToggle(patientId),
          onCancel: () => onCancel(patient)
        });
      })
    )
  );
}
function BoardTab() {
  const { data, reload } = useBoardData(3e4);
  const [expanded, setExpanded] = (0, import_react4.useState)(null);
  const [busyPatient, setBusyPatient] = (0, import_react4.useState)(null);
  const [notice, setNotice] = (0, import_react4.useState)(null);
  const handleToggle = (patientId) => {
    setExpanded(expanded === patientId ? null : patientId);
  };
  const handleCancel = async (patient) => {
    const patientId = typeof patient.patientId === "string" ? patient.patientId : "";
    if (patientId === "") return;
    setBusyPatient(patientId);
    const outcome = await cancelFlow(patientId);
    setBusyPatient(null);
    setNotice(outcome.message);
    reload();
  };
  return (0, import_react4.createElement)(BoardView, {
    board: data,
    expanded,
    busy: busyPatient,
    notice,
    onToggle: handleToggle,
    onCancel: (p) => void handleCancel(p),
    onRefresh: () => void reload()
  });
}

// src/client/index.ts
var name = "@medai/dsh-flow-panel";
var inject = ["slots"];
var TOOL_KEYS = ["medai_flow_tasks", "mcp__medai__medai_flow_tasks"];
function apply(ctx) {
  for (const key of TOOL_KEYS) {
    ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({ name: "tool.call.toolview", key }, FlowPanel));
  }
  ctx.slots.inject("shell.overlay", () => ctx.slots.register({ name: "shell.overlay", id: "medai-flow-badge" }, BoardBadge));
  ctx.slots.inject("conversation.view", () => ctx.slots.register({ name: "conversation.view", id: "medai-flow-board", label: "\u6D41\u7A0B\u770B\u677F" }, BoardTab));
}

    return module.exports;
  }
});
