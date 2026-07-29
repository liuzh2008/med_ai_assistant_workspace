#!/usr/bin/env bash
# =============================================================================
# Git Poll Auto Deploy Script
# Checks Git repos every N minutes, pulls new commits, builds and deploys.
#
# Target: Test server 100.66.1.4
# Cron: */10 * * * * /home/liuzh2008/medai/deploy-wrappers/git-poll-deploy.sh
# =============================================================================
set -euo pipefail

# ---- Config ----
LOG_DIR="/home/liuzh2008/medai/logs"
LOCK_FILE="/tmp/git-poll-deploy.lock"
WORKSPACE_BASE="/home/liuzh2008/公共/med_ai_assistant_workspace"
BACKEND_DIR="$WORKSPACE_BASE/med_ai_assistant_1.0_bs_backend"
FRONTEND_DIR="$WORKSPACE_BASE/med_ai_assistant_1.0_bs_vue"

MAIN_COMPOSE_DIR="$BACKEND_DIR/deploy/main-linux-testServer"
MAIN_COMPOSE_FILE="docker-compose-main-linux-oracle-image.yml"
EXEC_COMPOSE_DIR="$BACKEND_DIR/deploy/execution-linux"
EXEC_COMPOSE_FILE="docker-compose-execution-image.yml"
FRONTEND_COMPOSE_DIR="$FRONTEND_DIR"

mkdir -p "$LOG_DIR"

# ---- Prevent concurrent runs ----
exec 200>"$LOCK_FILE"
if ! flock -n 200; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Another instance is running, skipping" >> "$LOG_DIR/git-poll-deploy.log"
    exit 0
fi

log() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $*"
    echo "$msg" | tee -a "$LOG_DIR/git-poll-deploy.log"
}

# ---- Check Git for new commits ----
check_git_changes() {
    local dir="$1" name="$2"
    cd "$dir" || return 1

    git fetch origin 2>/dev/null || { log "[$name] git fetch failed"; return 1; }

    local local_hash
    local_hash=$(git rev-parse HEAD 2>/dev/null) || { log "[$name] git rev-parse failed"; return 1; }

    local remote_hash
    remote_hash=$(git rev-parse origin/main 2>/dev/null) || { log "[$name] cannot get origin/main"; return 1; }

    if [ "$local_hash" != "$remote_hash" ]; then
        local count
        count=$(git rev-list --count "$local_hash..$remote_hash" 2>/dev/null || echo "?")
        log "[$name] $count new commits: ${local_hash:0:8} -> ${remote_hash:0:8}"
        return 0
    fi
    return 1
}

# ---- Git Pull ----
git_pull() {
    local dir="$1" name="$2"
    cd "$dir" || return 1
    if git pull origin main 2>&1; then
        log "[$name] git pull success"
        return 0
    else
        log "[$name] git pull FAILED"
        return 1
    fi
}

# ---- Build Backend (Main + Execution) ----
build_backend() {
    log "[backend] Starting build..."

    cd "$BACKEND_DIR"

    log "[backend] Maven build main profile..."
    if mvn package -Pmain -DskipTests -q 2>&1; then
        log "[backend] Main JAR build success"
    else
        log "[backend] Main JAR build FAILED"
        return 1
    fi

    log "[backend] Maven build execution profile..."
    if mvn package -Pexecution -DskipTests -q 2>&1; then
        log "[backend] Execution JAR build success"
    else
        log "[backend] Execution JAR build FAILED"
        return 1
    fi

    log "[backend] Build main Docker image..."
    if docker build -t med-ai-main:latest . 2>&1; then
        log "[backend] Main Docker image build success"
    else
        log "[backend] Main Docker image build FAILED"
        return 1
    fi

    log "[backend] Build execution Docker image..."
    if docker build -f deploy/execution-linux/Dockerfile.execution.linux -t med-ai-execution:latest . 2>&1; then
        log "[backend] Execution Docker image build success"
    else
        log "[backend] Execution Docker image build FAILED"
        return 1
    fi

    return 0
}

# ---- Build Frontend ----
build_frontend() {
    log "[frontend] Starting build..."

    cd "$FRONTEND_DIR"

    log "[frontend] npm install..."
    if npm install --silent 2>&1; then
        log "[frontend] npm install success"
    else
        log "[frontend] npm install FAILED"
        return 1
    fi

    log "[frontend] npm run build..."
    if npm run build 2>&1; then
        log "[frontend] npm build success"
    else
        log "[frontend] npm build FAILED"
        return 1
    fi

    log "[frontend] Build Docker image..."
    if docker build -t med-ai-assistant-frontend:latest . 2>&1; then
        log "[frontend] Docker image build success"
    else
        log "[frontend] Docker image build FAILED"
        return 1
    fi

    return 0
}

# ---- Restart Services ----
restart_main_server() {
    log "[main] Restarting container..."
    cd "$MAIN_COMPOSE_DIR"
    docker compose -f "$MAIN_COMPOSE_FILE" --env-file .env.main up -d 2>&1
    log "[main] Restart done"
}

restart_execution_server() {
    log "[exec] Restarting container..."
    cd "$EXEC_COMPOSE_DIR"
    docker compose -f "$EXEC_COMPOSE_FILE" --env-file .env.execution up -d 2>&1
    log "[exec] Restart done"
}

restart_frontend() {
    log "[frontend] Restarting container..."
    cd "$FRONTEND_COMPOSE_DIR"
    docker compose up -d 2>&1
    log "[frontend] Restart done"
}

# ---- Health Check ----
wait_healthy() {
    local url="$1" name="$2" max_wait="${3:-120}"
    log "[$name] Waiting for health check (max ${max_wait}s)..."
    local start
    start=$(date +%s)
    while true; do
        if curl -fsS --connect-timeout 5 --max-time 10 "$url" > /dev/null 2>&1; then
            local elapsed
            elapsed=$(($(date +%s) - start))
            log "[$name] Health check OK (${elapsed}s)"
            return 0
        fi
        local now
        now=$(date +%s)
        if [ $((now - start)) -ge "$max_wait" ]; then
            log "[$name] Health check TIMEOUT"
            return 1
        fi
        sleep 5
    done
}

# ==================== Main Flow ====================

log "======== Git poll check start ========"

CHANGED=false
BACKEND_CHANGED=false
FRONTEND_CHANGED=false

# ---- Check backend repo ----
if check_git_changes "$BACKEND_DIR" "backend"; then
    CHANGED=true
    BACKEND_CHANGED=true
fi

# ---- Check frontend repo ----
if check_git_changes "$FRONTEND_DIR" "frontend"; then
    CHANGED=true
    FRONTEND_CHANGED=true
fi

if ! $CHANGED; then
    log "No new commits, skipping deploy"
    exit 0
fi

log "Changes detected, starting auto deploy..."

# 1. Backend changes
if $BACKEND_CHANGED; then
    git_pull "$BACKEND_DIR" "backend"

    if build_backend; then
        restart_main_server
        restart_execution_server
        wait_healthy "http://localhost:8081/api/health" "main" 120
        wait_healthy "http://localhost:8082/api/execute/health" "exec" 120
    else
        log "[backend] Build failed, skipping deploy. Check logs."
    fi
fi

# 2. Frontend changes
if $FRONTEND_CHANGED; then
    git_pull "$FRONTEND_DIR" "frontend"

    if build_frontend; then
        restart_frontend
        wait_healthy "http://localhost:8080/api/health" "frontend" 60
    else
        log "[frontend] Build failed, skipping deploy. Check logs."
    fi
fi

# 3. Final verification
log "======== Final health check ========"
for svc in "8081:main" "8082:exec" "8080:frontend"; do
    port="${svc%%:*}"
    name="${svc##*:}"
    if curl -fsS --connect-timeout 5 --max-time 10 "http://localhost:$port/api/health" > /dev/null 2>&1; then
        log "[$name:$port] HEALTHY"
    else
        log "[$name:$port] UNHEALTHY"
    fi
done

log "======== Git poll check end ========"
