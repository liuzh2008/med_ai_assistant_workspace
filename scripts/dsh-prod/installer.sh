#!/usr/bin/env bash
# ============================================================
# MedAi 生产 DSH 一键安装包（自解压单文件）
#   目标：openEuler 22.03 x86_64 —— 主服务器 10.120.11.43（MCP 服务器同机 8081）
#   形态：headless 服务（无图形网页端），配置全自动，验证走 API
#   用法：sudo ./dsh-prod-install.run
#   可选：sudo ./dsh-prod-install.run --dir /opt --home /var/lib/dsh
#   环境变量：DSH_MACHINE_TOKEN / MEDAI_MCP_TOKEN（缺省用预注册 token，
#            与执行服务器 medai.llmproxy.machines[0] / 主服务器 medai.mcp.tokens[3] 一致）
#   测试模式：TEST_MODE=1 跳过 systemd，仅验证解包/配置/Node（构建机自测用）
# ============================================================
set -euo pipefail

# ---------- 参数 ----------
INSTALL_DIR=${INSTALL_DIR:-/opt}
DSH_HOME=${DSH_HOME:-/var/lib/dsh}
RUN_USER=${RUN_USER:-dsh}
TOKEN_DEFAULT='c09be4be13014eb094ffca1a'
TOKEN_LLM=${DSH_MACHINE_TOKEN:-$TOKEN_DEFAULT}
TOKEN_MCP=${MEDAI_MCP_TOKEN:-$TOKEN_LLM}
PORT=3080

# ---------- 工具函数 ----------
log()  { echo "[dsh-install] $*"; }
die()  { echo "[dsh-install][ERROR] $*" >&2; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }

# ---------- 前置检查 ----------
if [ "$(id -u)" != "0" ]; then
  die "请用 root 运行: sudo $0"
fi
for c in tar grep tail sed awk; do
  have "$c" || die "缺少系统命令: $c"
done
if [ "${TEST_MODE:-0}" != "1" ]; then
  have systemctl || die "缺少 systemctl（非 systemd 系统？）"
fi

# ---------- 自解压 ----------
SELF="$0"
MARKER='__ARCHIVE_BELOW__'
# -a：安装包含尾部二进制 tar 数据，grep 需按文本处理
LINE=$(grep -an "^${MARKER}$" "$SELF" | tail -1 | cut -d: -f1)
[ -n "$LINE" ] || die "安装包损坏：找不到数据标记"
TMP=$(mktemp -d /tmp/dsh-install.XXXXXX)
trap 'rm -rf "$TMP"' EXIT
log "解压安装数据（Node + DSH + 插件 + 预置配置）..."
tail -n +$((LINE+1)) "$SELF" | tar -xzf - -C "$TMP"

# ---------- 1. Node 24（自带 pnpm）----------
log "[1/7] 安装 Node 24 + pnpm → $INSTALL_DIR/node"
mkdir -p "$INSTALL_DIR/node"
tar -xzf "$TMP/node-with-pnpm.tar.gz" -C "$INSTALL_DIR/node" --strip-components=1
NODE_BIN="$INSTALL_DIR/node/bin"
PNPM_JS="$INSTALL_DIR/node/lib/node_modules/pnpm/bin/pnpm.cjs"
"$NODE_BIN/node" -v >/dev/null 2>&1 || die "Node 安装失败"
[ -f "$PNPM_JS" ] || die "pnpm 缺失：$PNPM_JS"
log "   Node $("$NODE_BIN/node" -v) / pnpm $("$NODE_BIN/node" "$PNPM_JS" -v)"

# ---------- 2. DSH 代码树 ----------
log "[2/7] 解压 DSH → $INSTALL_DIR/deepseek-harness"
mkdir -p "$INSTALL_DIR"
tar -xzf "$TMP/deepseek-harness.tar.gz" -C "$INSTALL_DIR"
[ -d "$INSTALL_DIR/deepseek-harness/packages" ] || die "DSH 代码树不完整"
# 插件源码保留备用
tar -xzf "$TMP/medai-plugins.tar.gz" -C "$INSTALL_DIR" 2>/dev/null || true
# headless 验证脚本
if [ -f "$TMP/verify-prod-headless.mjs" ]; then
  cp "$TMP/verify-prod-headless.mjs" "$INSTALL_DIR/verify-prod-headless.mjs"
  chmod 755 "$INSTALL_DIR/verify-prod-headless.mjs"
fi
log "   $(ls -d "$INSTALL_DIR"/deepseek-harness | wc -l) 个代码目录就位"

# ---------- 2.5 pnpm store + 离线重建 node_modules ----------
log "[2.5/7] 离线重建依赖（pnpm store + --offline，本地操作无网络）"
tar -xzf "$TMP/pnpm-store.tar.gz" -C "$INSTALL_DIR"     # → $INSTALL_DIR/store（含 v11/）
tar -xzf "$TMP/pnpm-cache.tar.gz" -C "$INSTALL_DIR"     # → $INSTALL_DIR/pnpm（metadata 缓存）
[ -d "$INSTALL_DIR/store" ] || die "pnpm store 解包失败"
cd "$INSTALL_DIR/deepseek-harness"
# pnpm 内部 spawn node 取自 PATH → 安装的 Node 必须放首位
# ★ store-dir/cache-dir 必须用 CLI 参数：pnpm 11 在 root 下不读 npm_config_* 环境变量与 .npmrc
export PATH="$NODE_BIN:$PATH"
CI=true "$NODE_BIN/node" "$PNPM_JS" install --offline --frozen-lockfile \
  --store-dir "$INSTALL_DIR/store" --cache-dir "$INSTALL_DIR/pnpm" \
  >/tmp/dsh-pnpm-install.log 2>&1 \
  || { tail -20 /tmp/dsh-pnpm-install.log; die "pnpm offline install 失败"; }
PKG_COUNT=$(ls node_modules/.pnpm 2>/dev/null | wc -l)
log "   node_modules 重建完成（.pnpm 包数：$PKG_COUNT）"

# ---------- 3. DSH_HOME 数据目录（预置配置）----------
log "[3/7] 部署 DSH_HOME → $DSH_HOME（profile/settings/workspace 预置）"
mkdir -p "$DSH_HOME"
tar -xzf "$TMP/dsh-home.tar.gz" -C "$DSH_HOME"
chmod 700 "$DSH_HOME"
[ -f "$DSH_HOME/settings.yaml" ] || die "settings.yaml 缺失"
[ -f "$DSH_HOME/profiles/web/cordis.patch.yml" ] || die "profile 缺失"
log "   profile: $(ls "$DSH_HOME"/profiles/web/cordis.patch.yml)"

# ---------- 4. 插件依赖 + profile 装配重建（离线）----------
log "[3.5/7] 重建 medai 插件依赖与 profile 装配（离线）"
if [ -d "$INSTALL_DIR/medai-plugins" ]; then
  cd "$INSTALL_DIR/medai-plugins"
  CI=true "$NODE_BIN/node" "$PNPM_JS" install --offline --frozen-lockfile \
    --store-dir "$INSTALL_DIR/store" --cache-dir "$INSTALL_DIR/pnpm" >/tmp/dsh-pnpm-medai.log 2>&1 \
    || { tail -10 /tmp/dsh-pnpm-medai.log; die "medai-plugins 依赖重建失败"; }
fi
# profile 的 link: 路径从构建机路径适配为安装目录（package.json 与 lockfile 都要改）
sed -i "s|/home/liuzh2008|$INSTALL_DIR|g" "$DSH_HOME/profiles/web/package.json" "$DSH_HOME/profiles/web/pnpm-lock.yaml"
cd "$DSH_HOME/profiles/web"
CI=true "$NODE_BIN/node" "$PNPM_JS" install --offline --frozen-lockfile \
  --store-dir "$INSTALL_DIR/store" --cache-dir "$INSTALL_DIR/pnpm" >/tmp/dsh-pnpm-profile.log 2>&1 \
  || { tail -10 /tmp/dsh-pnpm-profile.log; die "profile 装配重建失败"; }
# pnpm 生成的 link: 相对路径可能跨目录算错 → 用绝对路径强制重建 @medai 链接（可靠）
MEDAI_PLUGIN_DIR="$INSTALL_DIR/medai-plugins/packages/@medai"
if [ -d "$MEDAI_PLUGIN_DIR" ]; then
  mkdir -p "$DSH_HOME/profiles/web/node_modules/@medai"
  for pkg in "$MEDAI_PLUGIN_DIR"/*; do
    [ -d "$pkg" ] || continue
    ln -sfn "$pkg" "$DSH_HOME/profiles/web/node_modules/@medai/$(basename "$pkg")"
  done
fi
log "   @medai 链接（绝对路径）：$(ls "$DSH_HOME/profiles/web/node_modules/@medai" 2>/dev/null | tr '\n' ' ')"

# ---------- 4. 运行用户与工作区 ----------
log "[4/7] 创建运行用户 $RUN_USER 与工作区 /opt/medai-dsh-workspace"
if ! id "$RUN_USER" >/dev/null 2>&1; then
  useradd --system --home-dir "$DSH_HOME" --shell /usr/sbin/nologin "$RUN_USER" || die "创建用户失败"
fi
mkdir -p /opt/medai-dsh-workspace
chown -R "$RUN_USER:$RUN_USER" "$DSH_HOME" /opt/medai-dsh-workspace
chmod 700 /opt/medai-dsh-workspace

# ---------- 5. token 环境文件（root-only）----------
log "[5/7] 写入 token 环境文件 /etc/dsh-prod/env（600）"
mkdir -p /etc/dsh-prod
umask 077
cat > /etc/dsh-prod/env <<EOF
DSH_MACHINE_TOKEN=$TOKEN_LLM
MEDAI_MCP_TOKEN=$TOKEN_MCP
EOF
chown root:root /etc/dsh-prod/env
chmod 600 /etc/dsh-prod/env
if [ "$TOKEN_LLM" != "$TOKEN_DEFAULT" ]; then
  log "   ⚠ 使用自定义 token（$TOKEN_LLM）：须已在执行服务器 medai.llmproxy.machines[] 注册对应哈希！"
fi

# ---------- 6. systemd 服务 ----------
log "[6/7] 写入 systemd unit /etc/systemd/system/dsh.service"
sed -e "s|__INSTALL_DIR__|$INSTALL_DIR|g" \
    -e "s|__DSH_HOME__|$DSH_HOME|g" \
    -e "s|__PORT__|$PORT|g" \
    -e "s|__USER__|$RUN_USER|g" \
    "$TMP/dsh.service.tpl" > /etc/systemd/system/dsh.service
chmod 644 /etc/systemd/system/dsh.service

if [ "${TEST_MODE:-0}" = "1" ]; then
  log "   TEST_MODE=1：跳过 systemctl（构建机自测）"
else
  systemctl daemon-reload
  systemctl enable --now dsh.service
  log "   dsh.service 已 enable + start"
fi

# ---------- 7. 自检 ----------
log "[7/7] 自检"
WEB_OK=0
if [ "${TEST_MODE:-0}" = "1" ]; then
  log "   TEST_MODE：验证配置树合成（--dump-config）"
  cd "$INSTALL_DIR/deepseek-harness"
  # 直接调用 bin.ts（绕过 pnpm 的 deps-check，离线/解包目录下 pnpm 会尝试重装）
  if DSH_HOME="$DSH_HOME" MEDAI_MCP_TOKEN="$TOKEN_MCP" DSH_MACHINE_TOKEN="$TOKEN_LLM" "$NODE_BIN/node" --import tsx/esm apps/cli/src/bin.ts web --dump-config >/tmp/dsh-dump.txt 2>&1; then
    log "   dump-config OK（$(wc -l < /tmp/dsh-dump.txt) 行），mcp-medai 条目：$(grep -ac 'id: mcp-medai' /tmp/dsh-dump.txt || true)"
  else
    log "   ⚠ dump-config 异常（见 /tmp/dsh-dump.txt）"
  fi
else
  log "   等待 DSH 监听 127.0.0.1:$PORT ..."
  for i in $(seq 1 40); do
    if (exec 3<>"/dev/tcp/127.0.0.1/$PORT") 2>/dev/null; then exec 3>&- 3<&-; WEB_OK=1; break; fi
    sleep 2
  done
  if [ "$WEB_OK" = "1" ]; then
    log "   ✅ DSH Web 服务已监听 http://127.0.0.1:$PORT"
  else
    log "   ⚠ $PORT 未监听：journalctl -u dsh -n 50 排查（token 未注册/LLM 配置/端口占用）"
  fi
  # MCP 网关（同机主服务器 8081）探活
  if (exec 3<>"/dev/tcp/127.0.0.1/8081") 2>/dev/null; then exec 3>&- 3<&-; log "   ✅ MCP 网关 127.0.0.1:8081 在线"; else log "   ⚠ MCP 网关 127.0.0.1:8081 未响应（主服务器未启动时 DSH 仍可运行，工具降级提示）"; fi
fi

# ---------- 报告 ----------
echo
echo "======================================================"
echo "  MedAi 生产 DSH 安装完成"
echo "------------------------------------------------------"
echo "  安装目录     : $INSTALL_DIR/deepseek-harness"
echo "  数据目录     : $DSH_HOME"
echo "  工作区       : /opt/medai-dsh-workspace"
echo "  Web 监听     : 127.0.0.1:$PORT（headless，无 GUI）"
echo "  Node         : $INSTALL_DIR/node/bin/node"
echo "  token(LLM)   : $TOKEN_LLM  （哈希须与执行服务器 machines[0] 一致）"
echo "  token(MCP)   : $TOKEN_MCP  （哈希须与主服务器 medai.mcp.tokens[3] 一致）"
echo "------------------------------------------------------"
if [ "${TEST_MODE:-0}" != "1" ]; then
  echo "  服务状态     : systemctl status dsh"
  echo "  日志         : journalctl -u dsh -f"
  echo "  全链路验证   : $INSTALL_DIR/node/bin/node $INSTALL_DIR/verify-prod-headless.mjs http://127.0.0.1:3080/api 120000"
  echo "  医生站(Windows)  : 独立客户端，经主服务器业务集成调用 DSH 能力（DSH 为主服务器上的 headless 服务，无人工 GUI）"
fi
echo "======================================================"

exit 0

__ARCHIVE_BELOW__
