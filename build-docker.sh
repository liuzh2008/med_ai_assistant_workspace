#!/usr/bin/env bash
# ============================================================
# 前后端 Docker 镜像一键构建（Linux 本机环境）
#
# 用法：
#   ./build-docker.sh            # 前后端都构建
#   ./build-docker.sh backend    # 只构建后端
#   ./build-docker.sh frontend   # 只构建前端
#
# 说明：
#   - 后端：Maven 打包出 target/*.jar，再由 Dockerfile 打成 med-ai-main:latest
#   - 前端：npm 构建出 dist/，再由 Dockerfile 打成 med-ai-assistant-frontend:latest
#   - 后端 Dockerfile 用 COPY target/*.jar，target 下若残留多个历史 jar 会失败，
#     因此这里先 clean，并在构建前校验 jar 数量必须为 1。
# ============================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT/med_ai_assistant_1.0_bs_backend"
FRONTEND_DIR="$ROOT/med_ai_assistant_1.0_bs_vue"
TARGET="${1:-all}"

info() { printf '\033[1;34m[构建]\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m[成功]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[错误]\033[0m %s\n' "$*" >&2; exit 1; }

# docker 组权限：用户已加入 docker 组、但当前 shell 会话未刷新时会失败
if ! docker info >/dev/null 2>&1; then
  die "当前 shell 没有 docker 权限。请注销重新登录（或 newgrp docker）；也可临时执行：
      sg docker -c 'bash \"$0\" ${TARGET}'"
fi

build_backend() {
  local version jars
  version=$(grep -oP '(?<=<revision>)[^<]+' "$BACKEND_DIR/pom.xml" | head -1)
  [ -n "$version" ] || die "未能从 pom.xml 读取 <revision> 版本号"

  info "后端版本：$version —— Maven 打包（clean package，跳过测试）"
  ( cd "$BACKEND_DIR" && ./mvnw -B -DskipTests -Dmaven.test.skip=true clean package )

  jars=$(find "$BACKEND_DIR/target" -maxdepth 1 -name '*.jar' | wc -l)
  [ "$jars" -eq 1 ] || die "target 下有 $jars 个 jar，Dockerfile 的 COPY target/*.jar 会失败，请先清理 target"
  ls -lh "$BACKEND_DIR"/target/*.jar

  info "构建后端镜像：med-ai-main:latest"
  ( cd "$BACKEND_DIR" && docker build -t med-ai-main:latest \
      --build-arg APP_VERSION="$version" -f Dockerfile . )
  ok "后端镜像完成：med-ai-main:latest（$version）"
}

build_frontend() {
  info "前端 npm 构建（vue-cli-service build）"
  ( cd "$FRONTEND_DIR" && NODE_OPTIONS=--openssl-legacy-provider npm run build )
  [ -f "$FRONTEND_DIR/dist/index.html" ] || die "前端构建未产出 dist/index.html"

  info "构建前端镜像：med-ai-assistant-frontend:latest"
  ( cd "$FRONTEND_DIR" && docker build -t med-ai-assistant-frontend:latest -f Dockerfile . )
  ok "前端镜像完成：med-ai-assistant-frontend:latest"
}

case "$TARGET" in
  all)      build_backend; build_frontend ;;
  backend)  build_backend ;;
  frontend) build_frontend ;;
  *) die "参数只能是 all | backend | frontend，收到：$TARGET" ;;
esac

echo
info "当前镜像："
docker images --format 'table {{.Repository}}:{{.Tag}}\t{{.Size}}' | grep -E 'med-ai' || true
