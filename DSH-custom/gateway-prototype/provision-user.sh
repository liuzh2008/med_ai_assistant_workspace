#!/usr/bin/env bash
# ============================================================
# provision-user.sh —— DSH 平台开户自动化（阶段 1 试点版）
# 用法: sudo -u liuzh2008 bash provision-user.sh <medai-userId> <key> [port]
#   例: bash provision-user.sh 1658 u3        # 端口自动分配(自 3103 起)
#        bash provision-user.sh 1659 u4 3110   # 指定端口
# 幂等: key 已开户则跳过目录/实例，仅补齐缺失部分。
# 注意: 注册 llmproxy token 后会重启 execution 容器（~60s 模型不可用）。
# ============================================================
set -euo pipefail

# ---------- 常量 ----------
BASE=/srv/dsh-platform
USERS_DIR=$BASE/users
STATE_DIR=$BASE/state
GATEWAY_DIR=$BASE/gateway
GW_CONFIG=$GATEWAY_DIR/gateway.config.json
GW_LOG=$BASE/logs/gateway.log
TOKENS_FILE=$GATEWAY_DIR/.llmproxy-tokens
EXEC_PROP=/home/liuzh2008/公共/med_ai_assistant_workspace/med_ai_assistant_1.0_bs_backend/deploy/execution-linux/config/execution/application-execution.properties
NEXT_PORT_FILE=$STATE_DIR/next-port
DEFAULT_NEXT_PORT=3103
SETTINGS_TEMPLATE='agent-default-model:
  provider: medai-llmproxy
  model: deepseek-v4-flash
llm-pi-ai:
  providers:
    medai-llmproxy:
      apiKeyEnv: MEDAI_LLMPROXY_TOKEN
      api: openai-completions
      baseURL: http://127.0.0.1:8082/api/dsh-llm
      compat:
        supportsDeveloperRole: false
        maxTokensField: max_tokens
      models:
        - id: deepseek-v4-flash
'

log() { echo "[provision] $1"; }
die() { echo "[provision][ERROR] $1" >&2; exit 1; }

# ---------- 参数 ----------
USER_ID="${1:-}"
KEY="${2:-}"
PORT="${3:-}"
[ -n "$USER_ID" ] || die "用法: provision-user.sh <medai-userId> <key> [port]"
[ -n "$KEY" ] || die "缺少 key"
echo "$KEY" | grep -qE '^[a-z0-9][a-z0-9-]{0,19}$' || die "key 非法（小写字母/数字/连字符，≤20）"
echo "$USER_ID" | grep -qE '^[0-9A-Za-z_-]{1,32}$' || die "userId 非法"

# ---------- 1. 目录 ----------
HOME_DIR=$USERS_DIR/$KEY/dsh-home
WORKSPACE=$USERS_DIR/$KEY/workspace
if [ -d "$HOME_DIR" ]; then
  log "key=$KEY 已开户（跳过目录创建）"
else
  mkdir -p "$HOME_DIR" "$WORKSPACE"
  log "创建目录: $USERS_DIR/$KEY/{dsh-home,workspace}"
fi

# ---------- 2. 端口 ----------
if [ -z "$PORT" ]; then
  PORT=$(( $(cat "$NEXT_PORT_FILE" 2>/dev/null || echo $((DEFAULT_NEXT_PORT-1))) + 1 ))
fi
if ss -tln 2>/dev/null | grep -q ":$PORT "; then die "端口 $PORT 已被占用"; fi
echo "$PORT" > "$NEXT_PORT_FILE"

# ---------- 3. 注册 llmproxy machines（幂等：machine-id 存在则跳过） ----------
if grep -q "machine-id=$KEY\$" "$EXEC_PROP" 2>/dev/null; then
  log "llmproxy machine-id=$KEY 已注册（跳过）"
else
  [ -f "$EXEC_PROP" ] || die "找不到 execution 配置: $EXEC_PROP"
  # 找到当前最大 machines 下标
  MAX_N=$(grep -oE 'medai\.llmproxy\.machines\[[0-9]+\]\.machine-id' "$EXEC_PROP" | grep -oE '[0-9]+' | sort -n | tail -1)
  N=$(( ${MAX_N:-0} + 1 ))
  # 生成明文 token + sha256（不回显）
  TOKEN=$(openssl rand -hex 24)
  HASH=$(printf '%s' "$TOKEN" | sha256sum | cut -d' ' -f1)
  cp "$EXEC_PROP" "$EXEC_PROP.bak-$(date +%Y%m%d%H%M%S)"
  printf '\nmedai.llmproxy.machines[%s].token-hash=%s\nmedai.llmproxy.machines[%s].machine-id=%s\n' "$N" "$HASH" "$N" "$KEY" >> "$EXEC_PROP"
  # 明文 token 落盘（600）
  touch "$TOKENS_FILE"; chmod 600 "$TOKENS_FILE"
  grep -q "^$KEY=" "$TOKENS_FILE" 2>/dev/null || printf '%s=%s\n' "$KEY" "$TOKEN" >> "$TOKENS_FILE"
  log "llmproxy machines[$N] 已注册 ($KEY, sha256前缀=${HASH:0:8})"
  if [ "${PROVISION_NO_EXEC_RESTART:-0}" != "1" ]; then
    log "重启 execution 容器（模型 ~60s 不可用）..."
    docker restart med-ai-execution-server >/dev/null
    for i in $(seq 1 40); do
      code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8082/api/execute/health 2>/dev/null || echo 000)
      [ "$code" = "200" ] && break
      sleep 6
    done
    [ "$code" = "200" ] || die "execution health 未恢复"
    log "execution health 200 ✓"
  else
    log "PROVISION_NO_EXEC_RESTART=1：跳过 execution 重启（批量模式，最后统一重启）"
  fi
fi

# ---------- 4. 启动实例（env 注入 llmproxy token） ----------
KEY_TOKEN=$(grep "^$KEY=" "$TOKENS_FILE" 2>/dev/null | cut -d= -f2- || true)
pkill -f "dsh web --port $PORT" 2>/dev/null || true
sleep 1
cd "$WORKSPACE"
export MEDAI_LLMPROXY_TOKEN="$KEY_TOKEN"
nohup env DSH_HOME="$HOME_DIR" dsh web --port "$PORT" --trusted-host 127.0.0.1 \
  > "$BASE/logs/$KEY.log" 2>&1 &
log "实例启动 pid=$! (port=$PORT)"

# ---------- 5. 写 settings.yaml ----------
[ -f "$HOME_DIR/settings.yaml" ] || printf '%s' "$SETTINGS_TEMPLATE" > "$HOME_DIR/settings.yaml"
log "settings.yaml 就绪"

# ---------- 6. 落盘 bootstrap token（等实例打印引导 URL） ----------
BOOT_TOKEN=""
for i in $(seq 1 30); do
  BOOT_TOKEN=$(grep -oE 'token=[A-Za-z0-9_-]+' "$BASE/logs/$KEY.log" 2>/dev/null | tail -1 | cut -d= -f2 || true)
  [ -n "$BOOT_TOKEN" ] && break
  sleep 1
done
if [ -n "$BOOT_TOKEN" ]; then
  mkdir -p "$STATE_DIR"; chmod 700 "$STATE_DIR"
  printf '%s' "$BOOT_TOKEN" > "$STATE_DIR/$KEY.token"
  chmod 600 "$STATE_DIR/$KEY.token"
  log "bootstrap token 已落盘 state/$KEY.token"
else
  log "警告: 未取到 bootstrap token（实例可能未就绪，稍后手动: grep token= $BASE/logs/$KEY.log > state/$KEY.token）"
fi

# ---------- 7. 更新网关配置 + 重启网关 ----------
node -e '
const fs=require("fs");
const p=process.argv[1];
const cfg=JSON.parse(fs.readFileSync(p,"utf8"));
const userId=process.argv[2], key=process.argv[3], port=Number(process.argv[4]);
cfg.instances=cfg.instances||{};
cfg.userMap=cfg.userMap||{};
cfg.instances[key]=cfg.instances[key]||{};
cfg.instances[key].port=port;
cfg.userMap[userId]=key;
fs.writeFileSync(p, JSON.stringify(cfg,null,2)+"\n", {mode:0o600});
console.log("gateway.config.json updated:", userId+"->"+key, "port", port);
' "$GW_CONFIG" "$USER_ID" "$KEY" "$PORT"
pkill -f 'node gateway.js' 2>/dev/null || true
sleep 1
cd "$GATEWAY_DIR"
nohup node gateway.js > "$GW_LOG" 2>&1 &
log "网关已重启 pid=$!"

# ---------- 摘要 ----------
log "======================================================"
log "开户完成: MedAi userId=$USER_ID → 实例 key=$KEY (127.0.0.1:$PORT)"
log "  DSH_HOME: $HOME_DIR"
log "  workspace: $WORKSPACE"
log "  llmproxy machine: $KEY (token 存 $TOKENS_FILE 0600)"
log "  bootstrap token: $STATE_DIR/$KEY.token"
log "  浏览器经网关 http://100.66.1.4:3200 用 $USER_ID 登录即可路由到此实例"
log "======================================================"
