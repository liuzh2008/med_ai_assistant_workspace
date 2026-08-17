window.__ModuleLoader__.load({
  id: "@medai/dsh-session-sync",
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

// src/client/browserAdapters.ts
var DEFAULT_KEY = "medai.dsh.session-map";
function createBrowserSessionMapStore(storage, key = DEFAULT_KEY) {
  return {
    async load() {
      try {
        const raw = storage.getItem(key);
        if (raw === null || raw === "") return {};
        const parsed = JSON.parse(raw);
        if (parsed === null || typeof parsed !== "object") return {};
        return parsed;
      } catch {
        return {};
      }
    },
    async save(map) {
      storage.setItem(key, JSON.stringify(map));
    }
  };
}
function createSessionsNavigator(opts) {
  return {
    async open(sessionId) {
      try {
        opts.sessions.open(sessionId);
        return true;
      } catch {
        return false;
      }
    },
    async create() {
      return opts.createSession();
    }
  };
}

// src/client/postMessageBridge.ts
var MESSAGE_TYPES = {
  IDENTITY: "identity",
  PATIENT_SELECT: "patient-select",
  PRE_LOGOUT: "pre-logout",
  PING: "ping",
  PONG: "pong",
  LOGOUT_READY: "logout-ready",
  ASSISTANT_UNAVAILABLE: "assistant-unavailable"
};
var TYPE_SET = new Set(Object.values(MESSAGE_TYPES));
function parseInbound(data) {
  if (data === null || typeof data !== "object") return null;
  const msg = data;
  if (typeof msg.type !== "string" || !TYPE_SET.has(msg.type)) return null;
  return { type: msg.type, payload: msg.payload };
}
function isAllowedOrigin(origin, allowedOrigins) {
  return allowedOrigins.includes(origin);
}
function isOutboundType(type) {
  return TYPE_SET.has(type);
}
function createPostMessageBridge(opts) {
  const origins = new Set(opts.allowedOrigins);
  function resolveTarget() {
    const t = typeof opts.targetWindow === "function" ? opts.targetWindow() : opts.targetWindow;
    return t ?? null;
  }
  function send(type, payload) {
    if (!isOutboundType(type)) throw new Error(`unknown message type: ${type}`);
    const target = resolveTarget();
    if (!target || typeof target.postMessage !== "function") return;
    target.postMessage({ type, payload }, opts.targetOrigin);
  }
  async function handleMessage(event) {
    if (!event || !isAllowedOrigin(event.origin, [...origins])) return;
    const message = parseInbound(event.data);
    if (message === null) return;
    try {
      switch (message.type) {
        case MESSAGE_TYPES.IDENTITY:
          await opts.handlers.onIdentity(message.payload);
          break;
        case MESSAGE_TYPES.PATIENT_SELECT:
          await opts.handlers.onPatientSelect(message.payload);
          break;
        case MESSAGE_TYPES.PRE_LOGOUT:
          await opts.handlers.onPreLogout(message.payload);
          break;
        case MESSAGE_TYPES.PING:
          await opts.handlers.onPing(message.payload);
          break;
        default:
          break;
      }
    } catch {
    }
  }
  const listener = (event) => {
    void handleMessage(event);
  };
  opts.windowLike?.addEventListener("message", listener);
  return {
    handleMessage: (event) => {
      void handleMessage(event);
    },
    send,
    dispose: () => {
      opts.windowLike?.removeEventListener("message", listener);
    }
  };
}

// src/identity.ts
var state = "absent";
var current = null;
var onSwitchAway = null;
async function setIdentity(payload) {
  const prev = current;
  if (prev && state === "active" && onSwitchAway) {
    try {
      await onSwitchAway(prev);
    } catch {
    }
  }
  current = { ...payload };
  state = "active";
  return current;
}
function beginLogout() {
  if (state === "absent") return;
  state = "logging-out";
}
function clearIdentity() {
  current = null;
  state = "absent";
}

// src/sessionMap.ts
async function createSessionMap(navigator, store) {
  const map = await store.load();
  async function persist() {
    try {
      await store.save({ ...map });
    } catch {
    }
  }
  return {
    async select(contextKey) {
      const existing = map[contextKey];
      if (existing !== void 0 && await navigator.open(existing)) {
        return { sessionId: existing, created: false };
      }
      const sessionId = await navigator.create();
      map[contextKey] = sessionId;
      await persist();
      return { sessionId, created: true };
    },
    get(contextKey) {
      return map[contextKey];
    },
    all() {
      return { ...map };
    },
    async remove(contextKey) {
      if (map[contextKey] === void 0) return;
      delete map[contextKey];
      await persist();
    },
    persist
  };
}

// src/client/index.ts
var name = "@medai/dsh-session-sync";
var inject = ["sessions"];
function memoryStorage() {
  const store = /* @__PURE__ */ new Map();
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    }
  };
}
function apply(ctx, options = {}) {
  const win = options.windowLike ?? (typeof window !== "undefined" ? window : void 0);
  const hostname = typeof window !== "undefined" && window.location ? window.location.hostname : "127.0.0.1";
  const allowedOrigins = options.allowedOrigins ?? [`http://${hostname}:8080`, "http://127.0.0.1:8080"];
  const targetOrigin = options.targetOrigin ?? allowedOrigins[0];
  let sessionMap;
  async function ensureSessionMap() {
    if (sessionMap) return sessionMap;
    try {
      const navigator = createSessionsNavigator({
        sessions: ctx.sessions,
        createSession: options.createSession ?? (() => Promise.reject(new Error("createSession not wired\uFF08S1 \u8054\u8C03\u63A5\u5165\u70B9\uFF0CT22 \u63A5\u5165 DSH \u4F1A\u8BDD\u521B\u5EFA API\uFF09")))
      });
      const storage = options.storage ?? (typeof localStorage !== "undefined" ? localStorage : memoryStorage());
      sessionMap = await createSessionMap(navigator, createBrowserSessionMapStore(storage));
      return sessionMap;
    } catch {
      return void 0;
    }
  }
  const bridge = createPostMessageBridge({
    allowedOrigins,
    targetOrigin,
    windowLike: win,
    targetWindow: () => {
      if (typeof window === "undefined" || !window.parent) return null;
      return window.parent;
    },
    handlers: {
      async onIdentity(payload) {
        await setIdentity(payload);
      },
      async onPatientSelect(payload) {
        options.onPatientContext?.(payload);
        if (payload.inHospital === false) {
          await sessionMap?.remove(payload.contextKey).catch(() => {
          });
          return;
        }
        const sm = await ensureSessionMap();
        if (!sm) return;
        await sm.select(payload.contextKey).catch(() => {
        });
      },
      async onPreLogout() {
        beginLogout();
        const ok = options.flushBeforeLogout ? await options.flushBeforeLogout().catch(() => false) : true;
        clearIdentity();
        bridge.send(MESSAGE_TYPES.LOGOUT_READY, { ok });
      },
      async onPing() {
        bridge.send(MESSAGE_TYPES.PONG, { ok: true });
      }
    }
  });
  apply.__bridge = bridge;
}

    return module.exports;
  }
});
