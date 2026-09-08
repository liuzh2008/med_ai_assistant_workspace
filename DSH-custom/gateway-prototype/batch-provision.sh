#!/usr/bin/env bash
# ============================================================
# batch-provision.sh —— 批量开户（试点扩员）
# 用法: bash batch-provision.sh <list-file>
#   list-file 每行一个 MedAi userId（# 开头为注释，可空行）；key 自动分配 u<序号>
#   例:  1657
#        0001
#   （已开户的 userId 自动跳过；全部注册后统一重启一次 execution，避免每户 60s）
# 要求: /srv/dsh-platform/gateway/provision-user.sh 在旁（复用其单户逻辑，PROVISION_NO_EXEC_RESTART=1）
# ============================================================
set -euo pipefail

LIST_FILE="${1:-}"
[ -f "$LIST_FILE" ] || { echo "[batch] ERROR: 清单文件不存在: $LIST_FILE"; echo "用法: bash batch-provision.sh <list-file>"; exit 1; }

GW_DIR=/srv/dsh-platform/gateway
PROVISION=$GW_DIR/provision-user.sh
[ -f "$PROVISION" ] || { echo "[batch] ERROR: $PROVISION 不存在"; exit 1; }

# 收集待开户 userId（去重、跳过已开户——已开户由 provision 幂等处理）
mapfile -t USERS < <(grep -vE '^\s*(#|$)' "$LIST_FILE" | tr -d ' \r' | sort -u)
[ "${#USERS[@]}" -gt 0 ] || { echo "[batch] 清单为空"; exit 0; }
echo "[batch] 待开户 ${#USERS[@]} 个: ${USERS[*]}"

# 自动分配 key：u<序号>（从已有实例数+1 起）
EXISTING=$(node -e "const c=require('$GW_DIR/gateway.config.json');console.log(Object.keys(c.instances||{}).length)" 2>/dev/null || echo 0)
IDX=$((EXISTING + 1))

echo "[batch] 阶段1: 注册 llmproxy machines（不重启）..."
for USERID in "${USERS[@]}"; do
  # 跳过已在网关配置中的 userId
  if node -e "const c=require('$GW_DIR/gateway.config.json');process.exit(c.userMap && c.userMap['$USERID']?0:1)" 2>/dev/null; then
    echo "[batch] $USERID 已开户（跳过）"
    continue
  fi
  KEY=$(printf 'u%d' "$IDX")
  echo "[batch] 开户 $USERID -> $KEY"
  PROVISION_NO_EXEC_RESTART=1 bash "$PROVISION" "$USERID" "$KEY" || { echo "[batch] $USERID 开户失败"; exit 1; }
  IDX=$((IDX + 1))
done

echo "[batch] 阶段2: 统一重启 execution 并验证全部 token..."
bash "$GW_DIR/sync-machines.sh" || { echo "[batch] sync-machines 失败"; exit 1; }

echo "[batch] 完成。网关配置当前映射："
node -e "const c=require('$GW_DIR/gateway.config.json');for(const [u,k] of Object.entries(c.userMap||{}))console.log('  '+u+' -> '+k+' (port '+((c.instances||{})[k]||{}).port+')')"
