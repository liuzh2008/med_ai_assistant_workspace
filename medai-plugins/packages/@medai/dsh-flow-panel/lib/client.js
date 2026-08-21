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
  FAILED: "\u5931\u8D25"
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

// src/client/index.ts
var name = "@medai/dsh-flow-panel";
var inject = ["slots"];
var TOOL_KEYS = ["medai_flow_tasks", "mcp__medai__medai_flow_tasks"];
function apply(ctx) {
  for (const key of TOOL_KEYS) {
    ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({ name: "tool.call.toolview", key }, FlowPanel));
  }
}

    return module.exports;
  }
});
