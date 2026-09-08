#!/usr/bin/env bash
# ============================================================
# dsh-platform.sh —— DSH 平台服务管理（网关 + 全部用户实例）
# 用法: dsh-platform.sh {start|stop|status}
#   start: 前台监督模式（systemd 用）：拉起网关与 config 内全部实例，
#          监视循环每 15s 检查，挂掉的实例自动拉起；SIGTERM 时清理退出。
# ============================================================
set -uo pipefail

BASE=/srv/dsh-platform
GW_DIR=$BASE/gateway
STATE_DIR=$BASE/state
LOGS=$BASE/logs
CONFIG=$GW_DIR/gateway.config.json
TOKENS=$GW_DIR/.llmproxy-tokens
DSH_BIN=$(which dsh)
NODE_BIN=$(which node)

log() { echo "[platform] $(date '+%F %T') $1"; }

read_port() { node -e "const c=require('$CONFIG');console.log((c.instances||{})['$1']?c.instances['$1'].port:'')" 2>/dev/null; }
read_keys() { node -e "const c=require('$CONFIG');for(const k of Object.keys(c.instances||{}))console.log(k)" 2>/dev/null; }
key_token() { grep "^$1=" "$TOKENS" 2>/dev/null | cut -d= -f2-; }

# 实例(重)启动后调用：刷新 bootstrap token 文件 + 清网关 instAuth（实例重启 token 轮换，旧 dsh-auth cookie 失效）
refresh_instance_auth() {
  local KEY=$1 PORT=$2
  # 轮询新 bootstrap token
  local NEW_TOKEN="" i
  for i in $(seq 1 20); do
    NEW_TOKEN=$(grep -oE 'token=[A-Za-z0-9_-]+' "$LOGS/$KEY.log" 2>/dev/null | tail -1 | cut -d= -f2)
    [ -n "$NEW_TOKEN" ] && break
    sleep 1
  done
  if [ -n "$NEW_TOKEN" ]; then
    printf '%s' "$NEW_TOKEN" > "$STATE_DIR/$KEY.token"
    chmod 600 "$STATE_DIR/$KEY.token"
    log "实例 $KEY: bootstrap token 已刷新"
  fi
  # 清网关 instAuth（网关下次转发该用户时自动用新 token 重新引导）
  if [ -f "$GW_DIR/state.json" ]; then
    node -e "const fs=require('fs');const p='$GW_DIR/state.json';try{const s=JSON.parse(fs.readFileSync(p,'utf8'));s.instAuth=(s.instAuth||[]).filter(([k])=>k!=='$KEY');fs.writeFileSync(p,JSON.stringify(s),{mode:0o600});console.log('instAuth $KEY cleared')}catch(e){console.log('state skip:',e.message)}"
  fi
}

pids_of() { pgrep -f "dsh web --port $1" 2>/dev/null || true; }

start_all() {
  # 网关
  if pgrep -f 'node gateway.js' >/dev/null 2>&1; then
    log "网关已在运行"
  else
    log "启动网关"
    (cd "$GW_DIR" && nohup "$NODE_BIN" gateway.js >> "$LOGS/gateway.log" 2>&1 &)
    sleep 2
  fi
  # 实例
  for KEY in $(read_keys); do
    PORT=$(read_port "$KEY")
    [ -n "$PORT" ] || { log "key=$KEY 无端口，跳过"; continue; }
    if [ -n "$(pids_of "$PORT")" ]; then
      log "实例 $KEY($PORT) 已在运行"
    else
      TOKEN=$(key_token "$KEY")
      HOME_DIR=$BASE/users/$KEY/dsh-home
      [ -d "$HOME_DIR" ] || { log "实例 $KEY: 无 DSH_HOME，跳过"; continue; }
      log "启动实例 $KEY(port=$PORT)"
      (cd "$BASE/users/$KEY/workspace" && MEDAI_LLMPROXY_TOKEN="$TOKEN" nohup env DSH_HOME="$HOME_DIR" "$DSH_BIN" web --port "$PORT" --trusted-host 127.0.0.1 >> "$LOGS/$KEY.log" 2>&1 &)
      sleep 1
      refresh_instance_auth "$KEY" "$PORT"
    fi
  done
}

stop_all() {
  log "停止全部实例与网关"
  for KEY in $(read_keys); do
    PORT=$(read_port "$KEY")
    [ -n "$PORT" ] && pkill -f "dsh web --port $PORT" 2>/dev/null || true
  done
  pkill -f 'node gateway.js' 2>/dev/null || true
  sleep 2
}

status_all() {
  echo "网关: $(pgrep -fc 'node gateway.js' 2>/dev/null || echo 0) 进程"
  for KEY in $(read_keys); do
    PORT=$(read_port "$KEY")
    N=$(pids_of "$PORT" | wc -l)
    echo "实例 $KEY(port=$PORT): $N 进程"
  done
}

case "${1:-start}" in
  start)
    start_all
    log "监督循环启动（Ctrl-C/SIGTERM 退出）"
    trap 'log "收到退出信号，清理"; stop_all; exit 0' TERM INT
    while true; do
      # 网关守护
      pgrep -f 'node gateway.js' >/dev/null 2>&1 || { log "网关挂了，重启"; (cd "$GW_DIR" && nohup "$NODE_BIN" gateway.js >> "$LOGS/gateway.log" 2>&1 &); }
      # 实例守护
      for KEY in $(read_keys); do
        PORT=$(read_port "$KEY")
        [ -n "$PORT" ] || continue
        if [ -z "$(pids_of "$PORT")" ]; then
          TOKEN=$(key_token "$KEY")
          HOME_DIR=$BASE/users/$KEY/dsh-home
          log "实例 $KEY(port=$PORT) 挂了，拉起"
          (cd "$BASE/users/$KEY/workspace" && MEDAI_LLMPROXY_TOKEN="$TOKEN" nohup env DSH_HOME="$HOME_DIR" "$DSH_BIN" web --port "$PORT" --trusted-host 127.0.0.1 >> "$LOGS/$KEY.log" 2>&1 &)
          refresh_instance_auth "$KEY" "$PORT"
        fi
      done
      sleep 15
    done
    ;;
  stop) stop_all ;;
  status) status_all ;;
  *) echo "用法: $0 {start|stop|status}"; exit 1 ;;
esac
