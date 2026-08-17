window.__ModuleLoader__.load({
  id: "@medai/dsh-feature-guide",
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

// src/client/FeatureGuideCard.tsx
var import_react = require("react");

// src/tool.ts
var TOOL_NAME = "medai_feature_guide";
var GUIDE_RESULT_KEYS = {
  matched: "matched",
  features: "features",
  id: "id",
  name: "name",
  summary: "summary",
  description: "description",
  route: "route",
  permission: "permission",
  hint: "hint"
};

// src/client/result.ts
function isValidFeature(value) {
  if (typeof value !== "object" || value === null) return false;
  const f = value;
  for (const key of ["id", "name", "summary", "description", "route"]) {
    if (typeof f[key] !== "string" || f[key].length === 0) return false;
  }
  if (f.permission !== void 0 && typeof f.permission !== "string") return false;
  return true;
}
function isValidResult(value) {
  if (typeof value !== "object" || value === null) return false;
  const r = value;
  if (typeof r[GUIDE_RESULT_KEYS.matched] !== "boolean") return false;
  const features = r[GUIDE_RESULT_KEYS.features];
  if (!Array.isArray(features) || !features.every(isValidFeature)) return false;
  if (r[GUIDE_RESULT_KEYS.hint] !== void 0 && typeof r[GUIDE_RESULT_KEYS.hint] !== "string") return false;
  return true;
}
function tryParse(text) {
  try {
    const value = JSON.parse(text);
    return isValidResult(value) ? value : null;
  } catch {
    return null;
  }
}
function parseGuideResult(text) {
  if (typeof text !== "string" || text.trim() === "") return null;
  const first = tryParse(text);
  if (first !== null) return first;
  if (text.includes('\\"')) {
    return tryParse(text.replace(/\\"/g, '"'));
  }
  return null;
}
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
function parseBlockResult(block) {
  return parseGuideResult(blockTextOf(block));
}

// src/client/navigateBridge.ts
var NAVIGATE_TYPE = "navigate";
function resolveTargetOrigin(hostname) {
  return `http://${hostname}:8080`;
}
function isInternalPath(path) {
  return typeof path === "string" && path.startsWith("/") && !path.startsWith("//") && !path.includes("://");
}
function sendNavigate(win, path, targetOrigin) {
  if (!isInternalPath(path)) return;
  if (!win || typeof win.postMessage !== "function") return;
  try {
    win.postMessage({ type: NAVIGATE_TYPE, payload: { path } }, targetOrigin);
  } catch {
  }
}
function sendNavigateFromBrowser(path) {
  const parent = typeof window !== "undefined" ? window.parent : null;
  const hostname = typeof window !== "undefined" && window.location ? window.location.hostname : "127.0.0.1";
  sendNavigate(parent, path, resolveTargetOrigin(hostname));
}

// src/client/FeatureGuideCard.tsx
var nameStyle = {
  fontWeight: 600,
  marginBottom: 4,
  fontSize: 13
};
var summaryStyle = {
  opacity: 0.85,
  marginBottom: 4,
  fontSize: 13
};
var descStyle = {
  opacity: 0.7,
  marginBottom: 6,
  fontSize: 12,
  lineHeight: "18px"
};
var permStyle = {
  opacity: 0.6,
  fontSize: 12,
  marginBottom: 6
};
var buttonStyle = {
  padding: "4px 12px",
  fontSize: 12,
  borderRadius: 6,
  border: "1px solid #409eff",
  background: "#409eff",
  color: "#fff",
  cursor: "pointer",
  marginBottom: 8
};
var bodyStyle = {
  borderTop: "1px solid rgba(0,0,0,0.08)",
  padding: "8px 10px",
  fontSize: 13
};
var rowStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "6px 10px",
  cursor: "pointer",
  userSelect: "none",
  fontSize: 13,
  lineHeight: "20px",
  color: "var(--dsw-alias-label-primary, #222)",
  borderRadius: "6px"
};
var rowHoverStyle = {
  ...rowStyle,
  background: "rgba(0,0,0,0.04)"
};
function FeatureGuideBody({ result, onNavigate }) {
  if (result === null) {
    return (0, import_react.createElement)("div", { style: bodyStyle }, "\u7ED3\u679C\u4E0D\u53EF\u89E3\u6790");
  }
  if (!result.matched) {
    return (0, import_react.createElement)(
      "div",
      { style: bodyStyle },
      (0, import_react.createElement)("div", { style: { fontWeight: 600, marginBottom: 4 } }, "\u672A\u627E\u5230\u5BF9\u5E94\u529F\u80FD"),
      (0, import_react.createElement)("div", { style: descStyle }, result.hint ?? "\u7CFB\u7EDF\u6682\u672A\u6536\u5F55\u8BE5\u529F\u80FD\uFF0C\u53EF\u5C06\u9700\u6C42\u53CD\u9988\u7ED9\u4FE1\u606F\u79D1")
    );
  }
  return (0, import_react.createElement)(
    "div",
    { style: bodyStyle },
    result.features.map((feature) => (0, import_react.createElement)(
      "div",
      { key: feature.id, style: { marginBottom: 8 } },
      (0, import_react.createElement)("div", { style: nameStyle }, feature.name),
      (0, import_react.createElement)("div", { style: summaryStyle }, feature.summary),
      (0, import_react.createElement)("div", { style: descStyle }, feature.description),
      feature.permission ? (0, import_react.createElement)("div", { style: permStyle }, `\u9700 ${feature.permission} \u6743\u9650`) : null,
      (0, import_react.createElement)(
        "button",
        {
          type: "button",
          style: buttonStyle,
          onClick: () => {
            if (isInternalPath(feature.route)) onNavigate(feature.route);
          }
        },
        "\u8DF3\u8F6C\u5230\u8BE5\u9875\u9762"
      )
    ))
  );
}
function summaryOf(result) {
  if (result === null) return "\u7ED3\u679C\u4E0D\u53EF\u89E3\u6790";
  if (!result.matched) return "\u672A\u627E\u5230\u5BF9\u5E94\u529F\u80FD";
  return `\u53D1\u73B0 ${result.features.length} \u4E2A\u5DF2\u6709\u529F\u80FD`;
}
function FeatureGuideCard({ toolName, block, onNavigate }) {
  const [expanded, setExpanded] = (0, import_react.useState)(false);
  const result = parseBlockResult(block);
  const summary = summaryOf(result);
  const handleNavigate = onNavigate ?? sendNavigateFromBrowser;
  const toggle = () => setExpanded((v) => !v);
  return (0, import_react.createElement)(
    "div",
    { className: "medai-tool-row", "data-tool": toolName },
    (0, import_react.createElement)(
      "div",
      {
        className: "medai-tool-row-head",
        style: expanded ? rowHoverStyle : rowStyle,
        role: "button",
        tabIndex: 0,
        "aria-expanded": expanded,
        onClick: toggle,
        onKeyDown: (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle();
          }
        }
      },
      (0, import_react.createElement)("span", { style: { width: 14, textAlign: "center" } }, expanded ? "\u25BE" : "\u25B8"),
      (0, import_react.createElement)("span", { style: { fontWeight: 600, whiteSpace: "nowrap" } }, "\u529F\u80FD\u6307\u5F15"),
      (0, import_react.createElement)(
        "span",
        { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", opacity: 0.7 } },
        summary
      )
    ),
    expanded ? (0, import_react.createElement)(
      import_react.Fragment,
      null,
      (0, import_react.createElement)(FeatureGuideBody, { result, onNavigate: handleNavigate })
    ) : null
  );
}

// src/client/index.ts
var name = "@medai/dsh-feature-guide";
var inject = ["slots"];
function apply(ctx) {
  ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({ name: "tool.call.toolview", key: TOOL_NAME }, FeatureGuideCard));
}

    return module.exports;
  }
});
