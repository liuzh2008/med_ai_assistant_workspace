#!/usr/bin/env bash
# ============================================================
# sync-machines.sh —— llmproxy machines 注册自愈（防 git pull/还原漂移）
# 权威源: /srv/dsh-platform/gateway/.llmproxy-tokens（明文 token，600）
# 作用: 对 tokens 文件中的每个 key，若 execution properties 缺 machine-id 则补注册；
#       每次执行后重启 execution 容器使配置生效（~60s 模型不可用）。
# 用法: bash sync-machines.sh          # 补全并重启
#       bash sync-machines.sh --check  # 只检查不写不重启
# ============================================================
set -euo pipefail

EXEC_PROP=/home/liuzh2008/公共/med_ai_assistant_workspace/med_ai_assistant_1.0_bs_backend/deploy/execution-linux/config/execution/application-execution.properties
TOKENS_FILE=/srv/dsh-platform/gateway/.llmproxy-tokens
MODE="${1:-apply}"

[ -f "$EXEC_PROP" ] || { echo "[sync] ERROR: $EXEC_PROP 不存在"; exit 1; }
[ -f "$TOKENS_FILE" ] || { echo "[sync] ERROR: $TOKENS_FILE 不存在"; exit 1; }

NEED=()
while IFS='=' read -r KEY TOKEN; do
  [ -n "$KEY" ] || continue
  if grep -q "machine-id=$KEY\$" "$EXEC_PROP"; then
    echo "[sync] $KEY 已注册 ✓"
  else
    NEED+=("$KEY:$TOKEN")
    echo "[sync] $KEY 缺失，需补注册"
  fi
done < "$TOKENS_FILE"

if [ "${#NEED[@]}" -eq 0 ]; then
  echo "[sync] 全部已注册，无需变更"
  exit 0
fi

if [ "$MODE" = "--check" ]; then
  echo "[sync] --check 模式：不写入。缺失 ${#NEED[@]} 个"
  exit 1
fi

MAX_N=$(grep -oE 'medai\.llmproxy\.machines\[[0-9]+\]\.machine-id' "$EXEC_PROP" | grep -oE '[0-9]+' | sort -n | tail -1)
N=$(( ${MAX_N:-0} + 1 ))
cp "$EXEC_PROP" "$EXEC_PROP.bak-$(date +%Y%m%d%H%M%S)"
for entry in "${NEED[@]}"; do
  KEY="${entry%%:*}"
  TOKEN="${entry#*:}"
  HASH=$(printf '%s' "$TOKEN" | sha256sum | cut -d' ' -f1)
  printf '\nmedai.llmproxy.machines[%s].token-hash=%s\nmedai.llmproxy.machines[%s].machine-id=%s\n' "$N" "$HASH" "$N" "$KEY" >> "$EXEC_PROP"
  echo "[sync] machines[$N] 已补注册: $KEY (sha256前缀=${HASH:0:8})"
  N=$((N+1))
done

echo "[sync] 重启 execution 容器（~60s 模型不可用）..."
docker restart med-ai-execution-server >/dev/null
for i in $(seq 1 40); do
  code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8082/api/execute/health 2>/dev/null || echo 000)
  [ "$code" = "200" ] && break
  sleep 6
done
[ "$code" = "200" ] || { echo "[sync] ERROR: execution health 未恢复"; exit 1; }
echo "[sync] execution health 200 ✓"

# 验证（不回显 token）
while IFS='=' read -r KEY TOKEN; do
  [ -n "$KEY" ] || continue
  code=$(curl -s -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:8082/api/dsh-llm/chat/completions -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"model":"deepseek-v4-flash","messages":[{"role":"user","content":"hi"}]}' 2>/dev/null || echo 000)
  echo "[sync] verify $KEY -> HTTP $code"
done < "$TOKENS_FILE"
