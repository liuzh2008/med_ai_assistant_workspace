window.__ModuleLoader__.load({
  id: "@medai/dsh-ui-draft-card",
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
  TOOL_KEYS: () => TOOL_KEYS,
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(index_exports);

// src/client/DraftCard.tsx
var import_react = require("react");

// src/client/draftApi.ts
var DRAFT_ENDPOINT_BASE = "http://127.0.0.1:8081/api/mcp/draft";
var jwtProvider = null;
function getCredentials() {
  return jwtProvider ? jwtProvider() : null;
}
async function fetchDraft(promptId, options = {}) {
  const base = options.baseUrl ?? DRAFT_ENDPOINT_BASE;
  const jwt = options.jwt ?? getCredentials();
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const url = `${base}/${encodeURIComponent(promptId)}`;
  let response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...jwt ? { Authorization: `Bearer ${jwt}` } : {}
      }
    });
  } catch {
    return { kind: "error" };
  }
  if (response.status === 401 || response.status === 403) {
    return { kind: "unauthorized", status: response.status };
  }
  if (!response.ok) {
    return { kind: "error", status: response.status };
  }
  try {
    const payload = await response.json();
    if (typeof payload.content === "string" && payload.content !== "") {
      return { kind: "ok", text: payload.content };
    }
    return { kind: "error", status: response.status };
  } catch {
    return { kind: "error", status: response.status };
  }
}

// src/client/draftResult.ts
function isSettled(block) {
  return Array.isArray(block?.content) && block.content.some((c) => typeof c?.text === "string" && c.text !== "");
}
function blockTextOf(block) {
  if (!isSettled(block)) return null;
  const parts = [];
  for (const c of block.content ?? []) {
    if (typeof c?.text === "string" && c.text !== "") parts.push(c.text);
  }
  return parts.length > 0 ? parts.join("\n") : null;
}
function parseDraftResult(text) {
  if (typeof text !== "string" || text.trim() === "") return null;
  const first = tryParse(text);
  if (first !== null) return first;
  if (text.includes('\\"')) return tryParse(text.replace(/\\"/g, '"'));
  return null;
}
function tryParse(text) {
  try {
    const value = JSON.parse(text);
    if (typeof value !== "object" || value === null) return null;
    const v = value;
    if (typeof v.status !== "string") return null;
    const view = { status: v.status };
    if (typeof v.promptId === "string" && v.promptId !== "") view.promptId = v.promptId;
    if (typeof v.summary === "string" && v.summary !== "") view.summary = v.summary;
    if (typeof v.message === "string" && v.message !== "") view.message = v.message;
    if (typeof v.viewHint === "string" && v.viewHint !== "") view.viewHint = v.viewHint;
    return view;
  } catch {
    return null;
  }
}
function parseBlockResult(block) {
  return parseDraftResult(blockTextOf(block));
}
function errorTextOf(block) {
  if (!block || block.isError !== true) return null;
  const e = block.error;
  if (typeof e === "string") return e === "" ? null : e;
  if (e && typeof e === "object") {
    const msg = e.message ?? e.code ?? e.name;
    return typeof msg === "string" && msg !== "" ? msg : null;
  }
  return null;
}

// src/client/DraftCard.tsx
var rowStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "6px 10px",
  cursor: "pointer",
  userSelect: "none",
  fontSize: "13px",
  lineHeight: "20px",
  color: "var(--dsw-alias-label-primary, #222)",
  borderRadius: "6px"
};
var rowHoverStyle = {
  ...rowStyle,
  background: "rgba(0,0,0,0.04)"
};
var titleStyle = {
  fontWeight: 600,
  whiteSpace: "nowrap"
};
var summaryStyle = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  opacity: 0.7
};
var cardStyle = {
  borderTop: "1px solid rgba(0,0,0,0.08)",
  padding: "8px 10px",
  fontSize: "13px"
};
var preStyle = {
  margin: 0,
  padding: "8px",
  maxHeight: 320,
  overflowY: "auto",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  background: "rgba(0,0,0,0.03)",
  borderRadius: 6,
  lineHeight: "20px",
  fontFamily: "inherit"
};
var noticeStyle = {
  marginTop: 6,
  fontSize: 12,
  opacity: 0.7
};
var stateStyle = {
  opacity: 0.7,
  padding: "4px 0"
};
function summaryOf(view, errorText) {
  if (errorText) return errorText;
  if (view === null) return "\u7ED3\u679C\u4E0D\u53EF\u89E3\u6790";
  if (view.promptId) return "\u8349\u7A3F\u5DF2\u751F\u6210\uFF0C\u70B9\u51FB\u5C55\u5F00\u67E5\u770B";
  if (view.status === "TIMEOUT") return view.message ?? "\u4ECD\u5728\u751F\u6210\u4E2D\uFF0C\u53EF\u7A0D\u540E\u7528 medai_record_status \u67E5\u8BE2";
  return view.summary ?? view.message ?? "\u751F\u6210\u5B8C\u6210";
}
function DraftBody({ view, draftState, draftText }) {
  if (view === null) {
    return (0, import_react.createElement)("div", { style: stateStyle }, "\u7ED3\u679C\u4E0D\u53EF\u89E3\u6790");
  }
  if (!view.promptId) {
    const text = view.summary ?? view.message ?? "\u751F\u6210\u5B8C\u6210";
    return (0, import_react.createElement)("div", { style: stateStyle }, text);
  }
  if (draftState === "loading" || draftState === "idle") {
    return (0, import_react.createElement)("div", { style: stateStyle }, "\u6B63\u5728\u52A0\u8F7D\u8349\u7A3F\u2026");
  }
  if (draftState === "unauthorized") {
    return (0, import_react.createElement)("div", { style: stateStyle }, "\u65E0\u6743\u9650\u67E5\u770B\u8349\u7A3F");
  }
  if (draftState === "error") {
    return (0, import_react.createElement)("div", { style: stateStyle }, "\u8349\u7A3F\u83B7\u53D6\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5");
  }
  return (0, import_react.createElement)(
    "div",
    { style: cardStyle },
    (0, import_react.createElement)("pre", { style: preStyle }, draftText ?? ""),
    (0, import_react.createElement)("div", { style: noticeStyle }, "\u4EE5\u4E0A\u4E3A AI \u8349\u7A3F\uFF0C\u8BF7\u5BA1\u6838")
  );
}
function DraftCard({ toolName, block, defaultExpanded, draftOptions }) {
  const [expanded, setExpanded] = (0, import_react.useState)(defaultExpanded ?? false);
  const [draftState, setDraftState] = (0, import_react.useState)("idle");
  const [draftText, setDraftText] = (0, import_react.useState)("");
  const view = parseBlockResult(block);
  const errorText = errorTextOf(block);
  const summary = summaryOf(view, errorText);
  const canExpand = view !== null || errorText !== null;
  (0, import_react.useEffect)(() => {
    if (!expanded || !view?.promptId) return;
    let cancelled = false;
    setDraftState("loading");
    fetchDraft(view.promptId, draftOptions).then((res) => {
      if (cancelled) return;
      if (res.kind === "ok") {
        setDraftText(res.text);
        setDraftState("ok");
      } else if (res.kind === "unauthorized") {
        setDraftState("unauthorized");
      } else {
        setDraftState("error");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [expanded, view?.promptId]);
  const toggle = () => {
    if (canExpand) setExpanded((v) => !v);
  };
  const chevron = canExpand ? expanded ? "\u25BE" : "\u25B8" : "\xB7";
  return (0, import_react.createElement)(
    "div",
    { className: "medai-tool-row", "data-tool": toolName },
    (0, import_react.createElement)(
      "div",
      {
        className: "medai-tool-row-head",
        style: expanded ? rowHoverStyle : rowStyle,
        role: canExpand ? "button" : void 0,
        tabIndex: canExpand ? 0 : void 0,
        "aria-expanded": canExpand ? expanded : void 0,
        onClick: toggle,
        onKeyDown: (e) => {
          if (canExpand && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            toggle();
          }
        }
      },
      (0, import_react.createElement)("span", { style: { width: 14, textAlign: "center" } }, chevron),
      (0, import_react.createElement)("span", { style: titleStyle }, "AI \u8349\u7A3F"),
      (0, import_react.createElement)("span", { style: summaryStyle }, summary)
    ),
    expanded ? (0, import_react.createElement)(import_react.Fragment, null, (0, import_react.createElement)(DraftBody, { view, draftState, draftText })) : null
  );
}

// src/client/index.ts
var name = "@medai/dsh-ui-draft-card";
var inject = ["slots"];
var TOOL_KEYS = [
  "medai_record_generate_sync",
  "mcp__medai__medai_record_generate_sync"
];
function apply(ctx) {
  for (const key of TOOL_KEYS) {
    ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({ name: "tool.call.toolview", key }, DraftCard));
  }
}

    return module.exports;
  }
});
