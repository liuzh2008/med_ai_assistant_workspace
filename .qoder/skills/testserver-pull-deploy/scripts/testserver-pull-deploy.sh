#!/usr/bin/env bash
# ==============================================================================
# MedAiAssistant - Test server: pull latest code -> build -> deploy -> verify
# ==============================================================================
# Prerequisite: local commits MUST be pushed to GitHub first (server pulls from
# GitHub over SSH; verified reachable 0.88s on 2026-10-01).
#
# Usage:
#   bash testserver-pull-deploy.sh backend
#   bash testserver-pull-deploy.sh frontend
#   bash testserver-pull-deploy.sh all
#
# Env overrides:
#   WORKSPACE   default /home/liuzh2008/public/med_ai_assistant_workspace
#   ROLLBACK    default /home/liuzh2008/medai/rollback-<date>
#
# Design notes (hard-won, see SKILL.md):
#   - script is pure ASCII to avoid encoding breaking quotes
#   - server build is used (no local jar/dist upload)
#   - container network is inherited from the existing container to dodge the
#     compose subnet conflict (172.20.0.0/16 already taken)
# ==============================================================================
set -uo pipefail

TARGET="${1:-all}"
WORKSPACE="${WORKSPACE:-/home/liuzh2008/public/med_ai_assistant_workspace}"
BACKEND_SRC="$WORKSPACE/med_ai_assistant_1.0_bs_backend"
FRONTEND_SRC="$WORKSPACE/med_ai_assistant_1.0_bs_vue"
FRONTEND_DEPLOY="/home/liuzh2008/medai/frontend-deploy-test"
ROLLBACK="${ROLLBACK:-/home/liuzh2008/medai/rollback-$(date +%Y%m%d-%H%M%S)}"
LOG_DIR="${LOG_DIR:-/tmp/medai-deploy-logs}"
mkdir -p "$LOG_DIR" "$ROLLBACK"

OK=0
FAIL=0
declare -a SUMMARY=()

log()  { echo "[$(date +%H:%M:%S)] $*"; }
ok()   { echo "[$(date +%H:%M:%S)]   OK   $*"; OK=$((OK+1)); SUMMARY+=("OK   $*"); }
bad()  { echo "[$(date +%H:%M:%S)]   FAIL $*"; FAIL=$((FAIL+1)); SUMMARY+=("FAIL $*"); }

need_sudo() {
  if [ "$(id -u)" = "0" ]; then echo ""; else echo "sudo"; fi
}
SUDO="$(need_sudo)"

# ------------------------------------------------------------------ pull ------
pull_repo() {
  local name="$1" path="$2"
  log "PULL $name"
  if [ ! -d "$path/.git" ]; then
    bad "$name: not a git repo at $path"
    return 1
  fi
  local before after
  before="$(git -C "$path" rev-parse --short HEAD)"
  local remote_url
  remote_url="$(git -C "$path" remote get-url origin 2>/dev/null || echo unknown)"
  log "  repo=$path"
  log "  origin=$remote_url"
  log "  before=$before"

  if ! git -C "$path" pull --ff-only >"$LOG_DIR/pull-$name.log" 2>&1; then
    bad "$name: git pull failed (see $LOG_DIR/pull-$name.log)"
    tail -5 "$LOG_DIR/pull-$name.log"
    return 1
  fi
  after="$(git -C "$path" rev-parse --short HEAD)"
  log "  after =$after"
  if [ "$before" = "$after" ]; then
    ok "$name: already up to date ($after)"
  else
    ok "$name: $before -> $after"
  fi
  return 0
}

# --------------------------------------------------------------- backend ------
build_backend() {
  log "BUILD backend"
  local start end
  start=$(date +%s)
  if ! (cd "$BACKEND_SRC" && mvn -B -DskipTests -Dmaven.test.skip=true package) \
        >"$LOG_DIR/build-backend.log" 2>&1; then
    bad "backend: maven package failed (see $LOG_DIR/build-backend.log)"
    tail -25 "$LOG_DIR/build-backend.log"
    return 1
  fi
  end=$(date +%s)
  local jar
  jar=$(ls -t "$BACKEND_SRC"/target/*.jar 2>/dev/null | grep -v '\.original$' | head -1)
  if [ -z "$jar" ]; then
    bad "backend: no jar produced"
    return 1
  fi
  echo "$jar" > "$LOG_DIR/backend-jar.path"
  ok "backend: built in $((end-start))s -> $(basename "$jar") ($(du -h "$jar" | cut -f1))"
  return 0
}

deploy_backend() {
  log "DEPLOY backend"
  local jar container="med-ai-main"
  jar=$(cat "$LOG_DIR/backend-jar.path" 2>/dev/null)
  if [ -z "$jar" ] || [ ! -f "$jar" ]; then
    bad "backend: jar path missing (run build first)"
    return 1
  fi
  if ! $SUDO docker ps --format '{{.Names}}' | grep -qx "$container"; then
    bad "backend: container $container not running"
    return 1
  fi
  if ! $SUDO docker cp "$container:/app/app.jar" "$ROLLBACK/app.jar.bak" 2>/dev/null; then
    bad "backend: rollback copy failed"
    return 1
  fi
  ok "backend: rollback saved -> $ROLLBACK/app.jar.bak"

  if ! $SUDO docker cp "$jar" "$container:/app/app.jar"; then
    bad "backend: jar copy into container failed"
    return 1
  fi
  log "  restarting $container (takes ~60-90s) ..."
  $SUDO docker restart "$container" >/dev/null 2>&1

  local i status
  for i in $(seq 1 24); do
    sleep 5
    status="$($SUDO docker ps --filter "name=$container" --format '{{.Status}}')"
    case "$status" in
      *"(healthy)"*) break ;;
    esac
  done
  case "$status" in
    *"(healthy)"*) ok "backend: container healthy" ;;
    *) bad "backend: container not healthy after wait: $status"; \
       log "  last log lines:"; $SUDO docker logs "$container" --tail 15 2>&1 | tail -15; return 1 ;;
  esac

  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8081/api/ai/health/ping || echo 000)
  if [ "$code" = "200" ]; then ok "backend: health endpoint 200"; else bad "backend: health endpoint=$code"; return 1; fi
  return 0
}

# -------------------------------------------------------------- frontend ------
build_frontend() {
  log "BUILD frontend"
  local start end
  start=$(date +%s)
  if ! (cd "$FRONTEND_SRC" && npm run build) >"$LOG_DIR/build-frontend.log" 2>&1; then
    bad "frontend: npm run build failed (see $LOG_DIR/build-frontend.log)"
    tail -25 "$LOG_DIR/build-frontend.log"
    return 1
  fi
  end=$(date +%s)
  if [ ! -d "$FRONTEND_SRC/dist" ]; then
    bad "frontend: dist not produced"
    return 1
  fi
  tar -czf "$LOG_DIR/frontend-dist.tar.gz" -C "$FRONTEND_SRC/dist" .
  local appjs
  appjs=$(ls "$FRONTEND_SRC/dist/js/" 2>/dev/null | grep -E '^app\.' | head -1)
  ok "frontend: built in $((end-start))s -> dist ($(du -h "$LOG_DIR/frontend-dist.tar.gz" | cut -f1)), asset=$appjs"
  return 0
}

deploy_frontend() {
  log "DEPLOY frontend"
  local pkg="$LOG_DIR/frontend-dist.tar.gz"
  local container="med-ai-assistant-frontend"
  if [ ! -f "$pkg" ]; then
    bad "frontend: package missing (run build first)"
    return 1
  fi
  if [ ! -d "$FRONTEND_DEPLOY/dist" ]; then
    bad "frontend: deploy dir missing: $FRONTEND_DEPLOY"
    return 1
  fi
  # 1) rollback current dist
  $SUDO rm -rf "$ROLLBACK/dist.bak"
  if ! $SUDO cp -r "$FRONTEND_DEPLOY/dist" "$ROLLBACK/dist.bak"; then
    bad "frontend: rollback copy failed"
    return 1
  fi
  ok "frontend: rollback saved -> $ROLLBACK/dist.bak"

  # 2) replace dist
  $SUDO rm -rf "$FRONTEND_DEPLOY/dist"
  $SUDO mkdir -p "$FRONTEND_DEPLOY/dist"
  if ! $SUDO tar -xzf "$pkg" -C "$FRONTEND_DEPLOY/dist"; then
    bad "frontend: extract new dist failed"
    return 1
  fi
  local count
  count=$($SUDO find "$FRONTEND_DEPLOY/dist" -type f | wc -l)
  ok "frontend: dist replaced ($count files)"

  # 3) build image
  if ! (cd "$FRONTEND_DEPLOY" && $SUDO docker build -t med-ai-assistant-frontend:latest .) \
        >"$LOG_DIR/build-frontend-image.log" 2>&1; then
    bad "frontend: docker build failed (see $LOG_DIR/build-frontend-image.log)"
    tail -20 "$LOG_DIR/build-frontend-image.log"
    return 1
  fi
  ok "frontend: image rebuilt"

  # 4) recreate container, INHERITING current network (dodges compose subnet clash)
  local net
  net="$($SUDO docker inspect "$container" --format '{{.HostConfig.NetworkMode}}' 2>/dev/null || echo bridge)"
  log "  reusing network: $net"
  $SUDO docker rm -f "$container" >/dev/null 2>&1
  if ! $SUDO docker run -d \
        --name "$container" \
        --network "$net" \
        -p 8080:80 -p 8443:443 \
        -e NODE_ENV=production -e TZ=Asia/Shanghai \
        --add-host host.docker.internal:host-gateway \
        --restart unless-stopped \
        --label com.medai.service=frontend \
        --label com.medai.version=1.0 \
        -v nginx_logs:/var/log/nginx \
        med-ai-assistant-frontend:latest >/dev/null; then
    bad "frontend: docker run failed"
    return 1
  fi

  local i status
  for i in $(seq 1 12); do
    sleep 5
    status="$($SUDO docker ps --filter "name=$container" --format '{{.Status}}')"
    case "$status" in
      *"(healthy)"*) break ;;
    esac
  done
  ok "frontend: container status=$status"

  # 5) verify served asset matches freshly built one
  local served built
  served=$(curl -s http://127.0.0.1:8080/ | grep -oE 'js/app[^"]*\.js' | head -1)
  built=$(ls "$FRONTEND_DEPLOY/dist/js/" 2>/dev/null | grep -E '^app\.' | head -1)
  if [ -n "$served" ] && echo "$served" | grep -q "${built}"; then
    ok "frontend: served asset matches build ($served)"
  else
    bad "frontend: served=$served built=$built (mismatch)"
    return 1
  fi
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/ || echo 000)
  if [ "$code" = "200" ]; then ok "frontend: http 200"; else bad "frontend: http=$code"; return 1; fi
  return 0
}

# ------------------------------------------------------------------ main ------
echo "=============================================================="
echo " MedAiAssistant test-server pull/build/deploy"
echo " target   : $TARGET"
echo " workspace: $WORKSPACE"
echo " rollback : $ROLLBACK"
echo " logs     : $LOG_DIR"
echo "=============================================================="

case "$TARGET" in
  backend|all)
    if pull_repo backend "$BACKEND_SRC" && build_backend; then
      deploy_backend || true
    fi
    ;;
esac

case "$TARGET" in
  frontend|all)
    if pull_repo frontend "$FRONTEND_SRC" && build_frontend; then
      deploy_frontend || true
    fi
    ;;
esac

echo "=============================================================="
echo " SUMMARY (ok=$OK fail=$FAIL)"
for line in "${SUMMARY[@]}"; do echo "  $line"; done
echo " rollback dir: $ROLLBACK"
echo "=============================================================="
[ "$FAIL" -eq 0 ] || exit 1
