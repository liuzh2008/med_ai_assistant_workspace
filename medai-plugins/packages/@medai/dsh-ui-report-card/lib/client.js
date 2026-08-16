window.__ModuleLoader__.load({
  id: "@medai/dsh-ui-report-card",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;

"use strict";
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
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(index_exports);

// src/ReportCard.tsx
var import_react = require("react");

// src/envelope.ts
var ERROR_MESSAGES = {
  unauthorized: "\u672C\u673A\u672A\u6388\u6743\uFF0C\u8BF7\u91CD\u65B0\u767B\u5F55\u5DE5\u4F5C\u7AD9",
  forbidden: "\u8BE5\u60A3\u8005\u4E0D\u5728\u60A8\u7684\u79D1\u5BA4\u8303\u56F4\u5185\uFF0C\u65E0\u6CD5\u67E5\u8BE2",
  timeout: "\u67E5\u8BE2\u8D85\u65F6\uFF0C\u8BF7\u91CD\u8BD5",
  "tool-error": "\u67E5\u8BE2\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5"
};
function parseEnvelope(raw) {
  if (typeof raw !== "object" || raw === null) return null;
  const env = raw;
  if (!Array.isArray(env.items)) return null;
  return env;
}
function truncationText(env) {
  if (!env || env.truncated !== true) return null;
  const shown = Array.isArray(env.items) ? env.items.length : 0;
  if (typeof env.totalCount === "number") {
    return `\u5DF2\u663E\u793A ${shown} \u6761\uFF0C\u5171 ${env.totalCount} \u6761`;
  }
  return "\u5DF2\u622A\u65AD";
}
function classifyError(code, text) {
  const t = (text ?? "").toLowerCase();
  if (code === "401" || t.includes("401") || t.includes("\u672A\u767B\u5F55") || t.includes("unauthorized")) {
    return "unauthorized";
  }
  if (code === "403" || t.includes("403") || t.includes("\u79D1\u5BA4") || t.includes("\u65E0\u6743") || t.includes("forbidden")) {
    return "forbidden";
  }
  if (t.includes("\u8D85\u65F6") || t.includes("timed out") || t.includes("timeout")) {
    return "timeout";
  }
  return "tool-error";
}

// src/sections.ts
var SECTION_KIND_MAP = {
  PATIENT_LIST: "patient-list",
  PATIENT_BASIC: "patient-list",
  LAB_RESULT: "lab-report",
  EXAM_RESULT: "exam-report",
  MEDICAL_RECORD: "record-timeline",
  DIAGNOSIS: "diagnosis-list",
  ORDER: "order-groups"
};
function sectionOf(sectionKey) {
  if (!sectionKey) return "generic";
  return SECTION_KIND_MAP[sectionKey] ?? "generic";
}
function str(v) {
  if (v === null || v === void 0) return "";
  return String(v);
}
function genericRows(item) {
  return Object.entries(item).map(([key, value]) => ({ label: key, value: str(value) }));
}
function buildReportSection(sectionKey, item) {
  const kind = sectionOf(sectionKey);
  const title = str(item.labName || item.checkName || item.diagnosisText || item.orderName || item.docTypeName || "");
  switch (kind) {
    case "lab-report": {
      const result = str(item.labResult);
      const unit = str(item.unit);
      const abnormal = Boolean(item.abnormalIndicator && String(item.abnormalIndicator).length > 0);
      const rows = [
        { label: "\u7ED3\u679C", value: unit ? `${result} ${unit}` : result, abnormal },
        { label: "\u53C2\u8003\u8303\u56F4", value: str(item.referenceRange) },
        { label: "\u65F6\u95F4", value: str(item.labReportTime) }
      ].filter((r) => r.value !== "");
      return { kind, title, rows };
    }
    case "exam-report": {
      const rows = [
        { label: "\u7C7B\u578B", value: str(item.checkType) },
        { label: "\u63CF\u8FF0", value: str(item.checkDescription) },
        { label: "\u7ED3\u8BBA", value: str(item.checkConclusion) },
        { label: "\u65F6\u95F4", value: str(item.checkReportTime) }
      ].filter((r) => r.value !== "");
      return { kind, title, rows };
    }
    case "record-timeline": {
      const label = [str(item.recordDate), str(item.docTypeName)].filter(Boolean).join(" ");
      return {
        kind,
        title: label,
        rows: [{ label, value: str(item.content) }]
      };
    }
    case "diagnosis-list": {
      return {
        kind,
        title: str(item.diagnosisText),
        rows: [{ label: str(item.icd10Code), value: str(item.diagnosisText) }]
      };
    }
    case "order-groups": {
      const detail = [str(item.dosage), str(item.unit), str(item.frequency), str(item.route)].filter(Boolean).join(" ");
      return {
        kind,
        title: str(item.orderName),
        rows: [{ label: str(item.orderName), value: detail }]
      };
    }
    default:
      return { kind: "generic", title, rows: genericRows(item) };
  }
}

// src/toolNames.ts
var REPORT_TOOLS = {
  "mcp__medai__medai_patient_list_by_department": "PATIENT_LIST",
  "mcp__medai__medai_patient_basic_info": "PATIENT_BASIC",
  "mcp__medai__medai_patient_diagnoses": "DIAGNOSIS",
  "mcp__medai__medai_patient_orders": "ORDER",
  "mcp__medai__medai_medical_records": "MEDICAL_RECORD",
  "mcp__medai__medai_lab_results": "LAB_RESULT",
  "mcp__medai__medai_exam_results": "EXAM_RESULT"
};
var TOOL_NAMES = Object.keys(REPORT_TOOLS);
var TOOL_SECTION_KEYS = Object.values(REPORT_TOOLS);
function sectionKeyOf(toolName) {
  return REPORT_TOOLS[toolName];
}

// src/result.ts
function parseToolResult(block) {
  if (!block) return null;
  const raw = block.result;
  if (typeof raw === "string") {
    try {
      return parseEnvelope(JSON.parse(raw));
    } catch {
      return null;
    }
  }
  return parseEnvelope(raw);
}
function blockErrorView(block) {
  if (!block || block.isError !== true) return null;
  const text = typeof block.error === "string" ? block.error : "";
  return classifyError(void 0, text);
}

// src/ReportCard.tsx
function rowsView(kind, rows) {
  if (kind === "lab-report") {
    return (0, import_react.createElement)(
      "table",
      { className: "medai-card-table" },
      (0, import_react.createElement)(
        "tbody",
        null,
        rows.map(
          (row, i) => (0, import_react.createElement)(
            "tr",
            { key: i, className: row.abnormal ? "medai-row-abnormal" : void 0 },
            (0, import_react.createElement)("td", { className: "medai-cell-label" }, row.label),
            (0, import_react.createElement)("td", null, row.value)
          )
        )
      )
    );
  }
  return (0, import_react.createElement)(
    "dl",
    { className: "medai-card-rows" },
    rows.map(
      (row, i) => (0, import_react.createElement)(
        import_react.Fragment,
        { key: i },
        (0, import_react.createElement)("dt", null, row.label),
        (0, import_react.createElement)("dd", null, row.value)
      )
    )
  );
}
function ReportCard({ toolName, block }) {
  const errorKind = blockErrorView(block);
  if (errorKind) {
    return (0, import_react.createElement)("div", { className: "medai-card medai-card-error" }, ERROR_MESSAGES[errorKind]);
  }
  const env = parseToolResult(block);
  if (!env) {
    return null;
  }
  const sectionKey = sectionKeyOf(toolName);
  const truncated = truncationText(env);
  const items = Array.isArray(env.items) ? env.items : [];
  const sourceRefs = Array.isArray(env.sourceRefs) ? env.sourceRefs : [];
  return (0, import_react.createElement)(
    "div",
    { className: "medai-card" },
    env.patientLabel ? (0, import_react.createElement)("div", { className: "medai-card-head" }, env.patientLabel) : null,
    (0, import_react.createElement)(
      "div",
      { className: "medai-card-body" },
      items.map(
        (item, i) => (0, import_react.createElement)(
          "div",
          { key: i, className: "medai-card-section" },
          (0, import_react.createElement)(
            "h5",
            null,
            buildReportSection(sectionKey, item ?? {}).title
          ),
          rowsView(
            buildReportSection(sectionKey, item ?? {}).kind,
            buildReportSection(sectionKey, item ?? {}).rows
          )
        )
      )
    ),
    truncated ? (0, import_react.createElement)("div", { className: "medai-card-truncated" }, truncated) : null,
    sourceRefs.length > 0 ? (0, import_react.createElement)(
      "div",
      { className: "medai-card-refs" },
      "\u6EAF\u6E90\uFF1A",
      sourceRefs.map((ref, i) => (0, import_react.createElement)("span", { key: i, className: "medai-card-ref" }, ref))
    ) : null
  );
}

// src/client/index.ts
var name = "@medai/dsh-ui-report-card";
var inject = ["slots"];
function apply(ctx) {
  for (const toolName of TOOL_NAMES) {
    ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({ name: "tool.call.toolview", key: toolName }, ReportCard));
  }
}

    return module.exports;
  }
});
