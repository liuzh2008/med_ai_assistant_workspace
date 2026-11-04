#!/usr/bin/env bash
# =============================================================================
# gitee-speed-test.sh —— 测量服务器到 Gitee 的下载速度
#
# 背景：主服务器 / 执行服务器都部署在医院内网，出网经统一网关。Gitee 是
#       内网可达的代码托管平台（git.provider=gitee）。本脚本量化"到 Gitee
#       到底多快"，并判断是否触发业务客户端的超时阈值。
#
# 运行环境：Linux（服务器宿主机，或主服务器 / 执行服务器容器内）。
# 依赖：curl（必需）；python3（可选，仅用于目录遍历的 JSON 解析与路径编码）。
#
# 用法示例：
#   bash gitee-speed-test.sh                                  # 基线 + 公开带宽采样 + 私有整包
#   bash gitee-speed-test.sh --rounds 3 --sample-seconds 20   # 采样 3 轮、每轮 20s
#   bash gitee-speed-test.sh --modes baseline,archive,single  # 只跑这两项
#   bash gitee-speed-test.sh --modes baseline,archive,bulk    # 全量遍历（模拟真实同步）
#   bash gitee-speed-test.sh --json > report.json             # JSON 输出（人类报告转 stderr）
#   bash gitee-speed-test.sh --public-url <URL>               # 换公开带宽目标
#   bash gitee-speed-test.sh --url <URL> --rounds 3           # 只测自定义地址
#
# 退出码：0 至少一项成功；1 全部失败；2 参数/环境错误。
# =============================================================================
set -uo pipefail
export LC_ALL=C

# ---------------------------------------------------------------- 默认参数
OWNER="chengdu-qingzhou_0"
REPO="med_ai_assistant_1.0_bs_backend"
REF="main"
MODES="baseline,archive,single"
ROUNDS=2
SAMPLE_SECONDS=15
MAX_TIME=600
CONNECT_TIMEOUT=10
TOKEN="${GITEE_ACCESS_TOKEN:-}"
JSON=0
CUSTOM_URLS=""
SINGLE_FILES=""
BULK_DIRS="prompt-templates,clinical-rules,qc-standards"
BULK_MAX_FILES=0
PUBLIC_URL="https://gitee.com/openharmony/docs/repository/archive/master.zip"

# 判定阈值（字节/秒）
TH_EXCELLENT=$((5 * 1024 * 1024))
TH_GOOD=$((2 * 1024 * 1024))
TH_FAIR=$((512 * 1024))
TH_SLOW=$((128 * 1024))

# 结果收集
declare -a R_PUBLIC=() R_ARCHIVE=() R_SINGLE=() R_CUSTOM=() R_BULK=()
RES_SINGLE=""
BASELINE_JSON="null"
BULK_SUMMARY="null"
ENV_KIND="host"
ENV_DESC=""
TS=""
WFORMAT='%{http_code} %{size_download} %{time_starttransfer} %{time_total} %{speed_download}'

# ---------------------------------------------------------------- 小工具
if [ -t 1 ]; then c_r=$'\033[31m'; c_g=$'\033[32m'; c_y=$'\033[33m'; c_c=$'\033[36m'; c_0=$'\033[0m'; else c_r=""; c_g=""; c_y=""; c_c=""; c_0=""; fi
# JSON 模式下所有人类可读输出走 stderr，保证 stdout 只有 JSON
p() { if [ "$JSON" = 1 ]; then printf '%s\n' "$*" >&2; else printf '%s\n' "$*"; fi; }
head1() { p ""; p "${c_c}$*${c_0}"; }
ok()    { p "  ${c_g}[OK]${c_0} $*"; }
warn()  { p "  ${c_y}[!!]${c_0} $*"; }
err()   { p "  ${c_r}[XX]${c_0} $*"; }

human_bytes() { awk -v b="${1:-0}" 'BEGIN{ split("B KB MB GB TB",u," "); i=1; while (b>=1024 && i<5){ b/=1024; i++ } printf "%.2f %s", b, u[i] }'; }
human_speed() { awk -v b="${1:-0}" 'BEGIN{ split("B/s KB/s MB/s GB/s",u," "); i=1; while (b>=1024 && i<5){ b/=1024; i++ } printf "%.2f %s", b, u[i] }'; }
urlencode() {
  if command -v python3 >/dev/null 2>&1; then
    python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe="/"))' "$1"
  else
    printf '%s' "$1"
  fi
}
json_escape() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }

usage() {
  sed -n '3,26p' "$0" | sed 's/^# \{0,1\}//'
  cat <<'EOF'

参数：
  --owner <名>            仓库 owner，默认 chengdu-qingzhou_0
  --repo <名>             仓库名，默认 med_ai_assistant_1.0_bs_backend
  --ref <分支>            分支/标签，默认 main
  --modes <列表>          逗号分隔：baseline,archive,single,bulk；默认 baseline,archive,single
  --rounds <N>            各类测试重复轮数，默认 2
  --sample-seconds <秒>   公开带宽目标的单轮采样时长，默认 15
  --public-url <URL>      公开带宽目标，默认 OpenHarmony docs 归档（约 700MB，只采样不落盘）
  --max-time <秒>         单次请求最长耗时，默认 600（整包下载）
  --connect-timeout <秒>  连接超时，默认 10
  --token <串>            Gitee 令牌；缺省读环境变量 GITEE_ACCESS_TOKEN
  --file <路径>           追加单文件测速目标（可重复，逗号分隔）
  --url <URL>             追加自定义 URL 测速目标（可重复，逗号分隔）
  --bulk-dirs <列表>      bulk 遍历目录，默认 prompt-templates,clinical-rules,qc-standards
  --bulk-max-files <N>    bulk 最多测几个文件（0=不限）
  --json                  只向 stdout 输出 JSON，人类报告走 stderr
  -h, --help              显示帮助
EOF
}

# ---------------------------------------------------------------- 参数解析
while [ $# -gt 0 ]; do
  case "$1" in
    --owner) OWNER="$2"; shift 2 ;;
    --repo) REPO="$2"; shift 2 ;;
    --ref) REF="$2"; shift 2 ;;
    --modes) MODES="$2"; shift 2 ;;
    --rounds) ROUNDS="$2"; shift 2 ;;
    --sample-seconds) SAMPLE_SECONDS="$2"; shift 2 ;;
    --public-url) PUBLIC_URL="$2"; shift 2 ;;
    --max-time) MAX_TIME="$2"; shift 2 ;;
    --connect-timeout) CONNECT_TIMEOUT="$2"; shift 2 ;;
    --token) TOKEN="$2"; shift 2 ;;
    --file) SINGLE_FILES="${SINGLE_FILES}${SINGLE_FILES:+,}$2"; shift 2 ;;
    --url) CUSTOM_URLS="${CUSTOM_URLS}${CUSTOM_URLS:+,}$2"; shift 2 ;;
    --bulk-dirs) BULK_DIRS="$2"; shift 2 ;;
    --bulk-max-files) BULK_MAX_FILES="$2"; shift 2 ;;
    --json) JSON=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) err "未知参数：$1"; usage; exit 2 ;;
  esac
done

API_BASE="https://gitee.com/api/v5/repos/${OWNER}/${REPO}"
WEB_BASE="https://gitee.com/${OWNER}/${REPO}"

say() { p "$*"; }

# ---------------------------------------------------------------- 环境
resolve_env() {
  TS="$(date '+%Y-%m-%d %H:%M:%S %z')"
  if [ -f /.dockerenv ]; then ENV_KIND="container"; else ENV_KIND="host"; fi
  ENV_DESC="${ENV_KIND}:$(hostname)"
  if [ -z "$TOKEN" ] && [ -n "${GITEE_ACCESS_TOKEN:-}" ]; then TOKEN="${GITEE_ACCESS_TOKEN}"; fi
}

# 单次 HTTP 请求：输出 "code bytes ttfb total speed"；curl 失败或空输出返回空串
request() { # $1=url $2=max_time $3...=额外 curl 参数
  local url="$1" limit="$2"; shift 2
  local -a hdr=()
  [ -n "$TOKEN" ] && hdr=(-H "Authorization: Bearer ${TOKEN}")
  curl -sS -o /dev/null --connect-timeout "$CONNECT_TIMEOUT" --max-time "$limit" \
       "${hdr[@]}" -w "$WFORMAT" "$@" "$url" 2>/dev/null || true
}

stat_of() { # stdin: 行 "name,code,bytes,ttfb,total,speed,partial"（7 列）或 "code,bytes,ttfb,total,speed"（5 列）
  awk -F, '{
      v=(NF>=7)?$6+0:$5+0; n++; s+=v;
      if (n==1){ min=v; max=v }
      if (v<min) min=v; if (v>max) max=v;
    } END{ if(n==0){print "0 0 0 0"} else printf "%.0f %.0f %.0f %d\n", s/n, min, max, n }'
}

judge() {
  awk -v s="${1:-0}" -v e="$TH_EXCELLENT" -v g="$TH_GOOD" -v f="$TH_FAIR" -v l="$TH_SLOW" 'BEGIN{
    if (s>=e) print "优秀"; else if (s>=g) print "良好";
    else if (s>=f) print "一般"; else if (s>=l) print "偏慢"; else print "很慢" }'
}

# ---------------------------------------------------------------- 各项测试
run_baseline() {
  head1 "[1] 网络基线（DNS / TLS / 首包）"
  local ip code dns conn tls ttfb total
  ip="$(getent hosts gitee.com 2>/dev/null | head -1 | awk '{print $1}')"
  if [ -n "$ip" ]; then ok "DNS  gitee.com -> ${ip}"; else warn "DNS 解析 gitee.com 失败"; fi

  local out
  out="$(curl -sS -o /dev/null --connect-timeout "$CONNECT_TIMEOUT" --max-time "$CONNECT_TIMEOUT" \
        -w '%{http_code} %{time_namelookup} %{time_connect} %{time_appconnect} %{time_starttransfer} %{time_total}' \
        https://gitee.com/ 2>/dev/null || true)"
  if [ -z "$out" ]; then
    err "https://gitee.com/ 不可达（连接失败）"
    return 1
  fi
  read -r code dns conn tls ttfb total <<< "$out"
  ok "HTTPS 首页 code=${code}  DNS=${dns}s  连接=${conn}s  TLS=${tls}s  首包=${ttfb}s  总耗时=${total}s"
  BASELINE_JSON="$(printf '{"ip":"%s","http_code":%s,"dns_s":%s,"connect_s":%s,"tls_s":%s,"ttfb_s":%s,"total_s":%s}' \
    "${ip:-}" "${code:-0}" "${dns:-0}" "${conn:-0}" "${tls:-0}" "${ttfb:-0}" "${total:-0}")"
}

# 公开大文件带宽采样：限时下载，只统计已下载部分
run_public_bandwidth() {
  head1 "[2] 公开带宽采样（限时 ${SAMPLE_SECONDS}s，不落盘）"
  say "  目标：${PUBLIC_URL}"
  local i=1 out code bytes ttfb total speed avail
  while [ "$i" -le "$ROUNDS" ]; do
    out="$(request "$PUBLIC_URL" "$SAMPLE_SECONDS" -L)"
    if [ -z "$out" ]; then warn "#${i} 请求失败"; i=$((i + 1)); continue; fi
    read -r code bytes ttfb total speed <<< "$out"
    if [ "${code:-0}" != "200" ]; then warn "#${i} HTTP ${code}"; i=$((i + 1)); continue; fi
    # 采样被 max-time 截断时，curl 仍给出 -w 指标；标记 partial 便于汇总区分
    local partial=0
    [ "$(awk -v t="$total" -v l="$SAMPLE_SECONDS" 'BEGIN{print (t >= l-0.5) ? 1 : 0}')" = "1" ] && partial=1
    R_PUBLIC+=("public,${code},${bytes},${ttfb},${total},${speed},${partial}")
    if [ "$partial" = "1" ]; then
      say "  #${i} 200  已下载 $(human_bytes "$bytes") / ${total}s（限时截断）  速率 $(human_speed "$speed")"
    else
      say "  #${i} 200  $(human_bytes "$bytes") / ${total}s  速率 $(human_speed "$speed")"
    fi
    i=$((i + 1))
  done
  [ ${#R_PUBLIC[@]} -eq 0 ] && return 1
  return 0
}

# 私有仓库归档整包下载
run_archive() {
  head1 "[3] 私有仓库归档整包（真实同步目标）"
  if [ -z "$TOKEN" ]; then warn "未提供 token，跳过（私有仓库需鉴权）"; return 1; fi
  local url="${WEB_BASE}/repository/archive/${REF}.zip"
  say "  目标：${url}"
  local i=1 out code bytes ttfb total speed
  while [ "$i" -le "$ROUNDS" ]; do
    out="$(request "$url" "$MAX_TIME" -L)"
    if [ -z "$out" ]; then warn "#${i} 请求失败"; i=$((i + 1)); continue; fi
    read -r code bytes ttfb total speed <<< "$out"
    if [ "${code:-0}" != "200" ]; then
      warn "#${i} HTTP ${code}$([ "$code" = "403" ] && echo '（令牌无效或权限不足）')"
      i=$((i + 1)); continue
    fi
    R_ARCHIVE+=("archive,${code},${bytes},${ttfb},${total},${speed},0")
    say "  #${i} 200  $(human_bytes "$bytes")  TTFB ${ttfb}s  总 ${total}s  平均 $(human_speed "$speed")"
    i=$((i + 1))
  done
  [ ${#R_ARCHIVE[@]} -eq 0 ] && return 1
  return 0
}

run_single() {
  head1 "[4] 单文件下载（真实同步路径 /api/v5/contents）"
  if [ -z "$TOKEN" ]; then warn "未提供 token，跳过"; return 1; fi
  local -a files=()
  if [ -n "$SINGLE_FILES" ]; then IFS=',' read -ra files <<< "$SINGLE_FILES"; else files=("prompt-templates/manifest.json"); fi
  local p i out code bytes ttfb total speed enc rc=1
  for p in "${files[@]}"; do
    [ -z "$p" ] && continue
    enc="$(urlencode "$p")"
    i=1
    while [ "$i" -le "$ROUNDS" ]; do
      out="$(request "${API_BASE}/contents/${enc}?ref=${REF}" "$MAX_TIME")"
      if [ -z "$out" ]; then warn "${p} #${i} 请求失败"; i=$((i + 1)); continue; fi
      read -r code bytes ttfb total speed <<< "$out"
      if [ "${code:-0}" != "200" ]; then warn "${p} #${i} HTTP ${code}"; i=$((i + 1)); continue; fi
      R_SINGLE+=("${p},${code},${bytes},${ttfb},${total},${speed},0")
      say "  ${p}  $(human_bytes "$bytes")  TTFB ${ttfb}s  总 ${total}s"
      rc=0
      i=$((i + 1))
    done
  done
  return $rc
}

list_dir() { # $1=path -> 输出 "type<TAB>path"
  local p="$1" enc tmp code
  enc="$(urlencode "$p")"
  tmp="$(mktemp)" || return 1
  code="$(curl -sS -o "$tmp" --connect-timeout "$CONNECT_TIMEOUT" --max-time "$MAX_TIME" \
        -H "Authorization: Bearer ${TOKEN}" \
        -w '%{http_code}' "${API_BASE}/contents/${enc}?ref=${REF}" 2>/dev/null || true)"
  if [ "${code:-0}" != "200" ]; then rm -f "$tmp"; return 1; fi
  if command -v python3 >/dev/null 2>&1; then
    python3 - "$tmp" <<'PY'
import json, sys
try:
    d = json.load(open(sys.argv[1], encoding="utf-8"))
except Exception:
    sys.exit(1)
if not isinstance(d, list):
    sys.exit(1)
for x in d:
    print("%s\t%s" % (x.get("type"), x.get("path")))
PY
  else
    tr '{' '\n' < "$tmp" | sed -n 's/.*"type":"\([a-z]*\)".*"path":"\([^"]*\)".*/\1\t\2/p'
  fi
  rm -f "$tmp"
}

run_bulk() {
  head1 "[5] 全量目录遍历（模拟真实模板/规则同步）"
  if [ -z "$TOKEN" ]; then warn "未提供 token，跳过"; return 1; fi
  local -a queue=() files=()
  local d listing t p guard=0
  IFS=',' read -ra queue <<< "$BULK_DIRS"
  while [ ${#queue[@]} -gt 0 ] && [ "$guard" -lt 200 ]; do
    d="${queue[0]}"; queue=("${queue[@]:1}"); guard=$((guard + 1))
    listing="$(list_dir "$d")" || { warn "目录列表失败：$d"; continue; }
    while IFS=$'\t' read -r t p; do
      [ -z "${t:-}" ] && continue
      case "$t" in dir) queue+=("$p") ;; file) files+=("$p") ;; esac
    done <<< "$listing"
  done

  local n=${#files[@]}
  say "  扫描到 ${n} 个文件（目录：${BULK_DIRS}）"
  [ "$n" -eq 0 ] && { warn "无文件可测"; return 1; }
  if [ "$BULK_MAX_FILES" -gt 0 ] && [ "$n" -gt "$BULK_MAX_FILES" ]; then
    files=("${files[@]:0:$BULK_MAX_FILES}"); n=$BULK_MAX_FILES
    say "  按 --bulk-max-files 截断为 ${n} 个"
  fi

  local i=0 okc=0 failc=0 sum_bytes=0 sum_time=0 worst_time=0 worst_file="" out code bytes ttfb total speed enc
  local -a slow=()
  for p in "${files[@]}"; do
    i=$((i + 1))
    enc="$(urlencode "$p")"
    out="$(request "${API_BASE}/contents/${enc}?ref=${REF}" "$MAX_TIME")"
    if [ -z "$out" ]; then failc=$((failc + 1)); continue; fi
    read -r code bytes ttfb total speed <<< "$out"
    if [ "${code:-0}" != "200" ]; then failc=$((failc + 1)); continue; fi
    okc=$((okc + 1))
    sum_bytes=$(awk -v a="$sum_bytes" -v b="$bytes" 'BEGIN{printf "%.0f", a+b}')
    sum_time=$(awk -v a="$sum_time" -v b="$total" 'BEGIN{printf "%.3f", a+b}')
    R_BULK+=("${p},${code},${bytes},${ttfb},${total},${speed},0")
    slow+=("$(printf '%.3f %s' "$total" "$p")")
    if awk -v a="$worst_time" -v b="$total" 'BEGIN{exit !(b>a)}'; then worst_time="$total"; worst_file="$p"; fi
    [ $((i % 25)) -eq 0 ] && say "  ...已测 ${i}/${n}（成功 ${okc}，失败 ${failc}）"
  done

  local avg_speed=0
  [ "$okc" -gt 0 ] && avg_speed=$(awk -v b="$sum_bytes" -v t="$sum_time" 'BEGIN{ if(t>0) printf "%.0f", b/t; else print 0 }')
  ok "文件 ${n}：成功 ${okc}，失败 ${failc}"
  ok "总字节 $(human_bytes "$sum_bytes")，总耗时 ${sum_time}s，平均吞吐 $(human_speed "$avg_speed")"
  say "  最慢单文件：${worst_file} ${worst_time}s"
  if [ ${#slow[@]} -gt 0 ]; then
    say "  最慢 5 个："
    printf '%s\n' "${slow[@]}" | sort -k1 -n -r | head -5 | while read -r tt ff; do say "    ${tt}s  ${ff}"; done
  fi
  BULK_SUMMARY="$(printf '{"files":%d,"ok":%d,"failed":%d,"bytes":%s,"seconds":%s,"avg_speed":%s,"worst_file":"%s","worst_time":%s}' \
    "$n" "$okc" "$failc" "${sum_bytes:-0}" "${sum_time:-0}" "${avg_speed:-0}" "$(json_escape "$worst_file")" "${worst_time:-0}")"
  return 0
}

run_custom() {
  head1 "[6] 自定义 URL 测速"
  local -a urls=()
  IFS=',' read -ra urls <<< "$CUSTOM_URLS"
  local u i out code bytes ttfb total speed rc=1
  for u in "${urls[@]}"; do
    [ -z "$u" ] && continue
    i=1
    while [ "$i" -le "$ROUNDS" ]; do
      out="$(request "$u" "$MAX_TIME" -L)"
      if [ -z "$out" ]; then warn "${u} #${i} 请求失败"; i=$((i + 1)); continue; fi
      read -r code bytes ttfb total speed <<< "$out"
      R_CUSTOM+=("${u},${code},${bytes},${ttfb},${total},${speed},0")
      say "  ${u}"
      say "    #${i} code=${code} $(human_bytes "$bytes")  TTFB ${ttfb}s  总 ${total}s  速率 $(human_speed "$speed")"
      rc=0
      i=$((i + 1))
    done
  done
  return $rc
}

# ---------------------------------------------------------------- 汇总
rows_to_json() {
  local first=1 row
  printf '['
  for row in "$@"; do
    [ -n "$row" ] || continue
    [ $first -eq 1 ] || printf ','
    first=0
    awk -F, '{
      n=NF;
      if (n>=7) printf "{\"name\":\"%s\",\"http_code\":%s,\"bytes\":%s,\"ttfb_s\":%s,\"total_s\":%s,\"speed\":%s,\"partial\":%s}", $1,$2,$3,$4,$5,$6,$7;
      else if (n==6) printf "{\"http_code\":%s,\"bytes\":%s,\"ttfb_s\":%s,\"total_s\":%s,\"speed\":%s}", $2,$3,$4,$5,$6;
      else printf "{\"http_code\":%s,\"bytes\":%s,\"ttfb_s\":%s,\"total_s\":%s,\"speed\":%s}", $1,$2,$3,$4,$5;
    }' <<< "$row"
  done
  printf ']'
}

render_report() {
  local pn=0 pavg=0 pmin=0 pmax=0 an=0 aavg=0 amin=0 amax=0 sn=0 savg=0
  [ ${#R_PUBLIC[@]} -gt 0 ] && read -r pavg pmin pmax pn < <(printf '%s\n' "${R_PUBLIC[@]}" | stat_of)
  [ ${#R_ARCHIVE[@]} -gt 0 ] && read -r aavg amin amax an < <(printf '%s\n' "${R_ARCHIVE[@]}" | stat_of)
  [ ${#R_SINGLE[@]} -gt 0 ] && read -r savg _ _ sn < <(printf '%s\n' "${R_SINGLE[@]}" | stat_of)

  say ""
  say "============================== 结果汇总 =============================="
  say " 目标仓库 : ${OWNER}/${REPO}  (ref=${REF})"
  say " 执行环境 : ${ENV_DESC}   curl $(curl --version 2>/dev/null | head -1 | awk '{print $2}')"
  say " 时间     : ${TS}"
  say ""
  if [ "$pn" -gt 0 ]; then
    say " 公开带宽 : 均值 $(human_speed "$pavg")（最小 $(human_speed "$pmin")，最大 $(human_speed "$pmax")，${pn} 轮）"
  fi
  if [ "$an" -gt 0 ]; then
    say " 私有整包 : 均值 $(human_speed "$aavg")（${an} 轮）"
    local b0 t0 eta
    b0="$(printf '%s\n' "${R_ARCHIVE[@]}" | awk -F, 'NR==1{print $3}')"
    t0="$(printf '%s\n' "${R_ARCHIVE[@]}" | awk -F, 'NR==1{print $5}')"
    eta="$(awk -v b="$b0" -v s="$aavg" 'BEGIN{ if(s>0) printf "%.1f", b/s; else print "N/A" }')"
    say " 归档样本 : $(human_bytes "$b0") / ${t0}s，按均速整包约 ${eta}s"
  fi
  if [ "$sn" -gt 0 ]; then
    say " 单文件   : 均值 $(human_speed "$savg")（${sn} 次，小文件受 TLS/首包影响，仅供参考）"
  fi

  local key="${pavg:-0}"; [ "$key" -eq 0 ] && key="${aavg:-0}"; [ "$key" -eq 0 ] && key="${savg:-0}"
  say ""
  if [ "${pavg:-0}" -eq 0 ] && [ "${aavg:-0}" -eq 0 ]; then
    say " 速度判定 : 数据不足（本次未测大文件带宽；单文件速率不代表下载带宽）"
    key=0
  else
    say " 速度判定 : $(judge "$key")"
  fi
  say ""
  say " 判定阈值：≥$(human_speed "$TH_EXCELLENT") 优秀；≥$(human_speed "$TH_GOOD") 良好；"
  say "           ≥$(human_speed "$TH_FAIR") 一般；≥$(human_speed "$TH_SLOW") 偏慢；其余 很慢"
  say " 超时基线：GitHubContentClient 连接超时 ${CONNECT_TIMEOUT}s、响应超时 10s；"
  say "           单文件若超过 10s 会在应用侧判超时并触发重试。"
  say "====================================================================="

  R_PUB_N=$pn; R_PUB_AVG=$pavg; R_ARC_AVG=$aavg; R_SIN_AVG=$savg; R_KEY=$key
}

emit_json() {
  local pub_json='[]' arc_json='[]' sin_json='[]' cus_json='[]'
  [ ${#R_PUBLIC[@]} -gt 0 ] && pub_json="$(rows_to_json "${R_PUBLIC[@]}")"
  [ ${#R_ARCHIVE[@]} -gt 0 ] && arc_json="$(rows_to_json "${R_ARCHIVE[@]}")"
  [ ${#R_SINGLE[@]} -gt 0 ] && sin_json="$(rows_to_json "${R_SINGLE[@]}")"
  [ ${#R_CUSTOM[@]} -gt 0 ] && cus_json="$(rows_to_json "${R_CUSTOM[@]}")"
  printf '{"timestamp":"%s","env":"%s","host":"%s","owner":"%s","repo":"%s","ref":"%s",' \
    "$TS" "$ENV_KIND" "$(hostname)" "$OWNER" "$REPO" "$REF"
  printf '"baseline":%s,' "$BASELINE_JSON"
  printf '"public":{"target":"%s","samples":%s,"avg_speed":%s},' "$(json_escape "$PUBLIC_URL")" "$pub_json" "${R_PUB_AVG:-0}"
  printf '"archive":{"samples":%s,"avg_speed":%s},' "$arc_json" "${R_ARC_AVG:-0}"
  printf '"single":{"samples":%s,"avg_speed":%s},' "$sin_json" "${R_SIN_AVG:-0}"
  printf '"custom":{"samples":%s},' "$cus_json"
  printf '"bulk":%s,' "$BULK_SUMMARY"
  printf '"verdict":"%s"}\n' "$(judge "${R_KEY:-0}")"
}

# ---------------------------------------------------------------- 主流程
main() {
  command -v curl >/dev/null 2>&1 || { err "未找到 curl"; exit 2; }
  resolve_env

  say ""
  say "############### Gitee 下载速度测试 ###############"
  say " 环境: ${ENV_DESC}"
  say " 仓库: ${OWNER}/${REPO}  ref=${REF}"
  say " 模式: ${MODES}   轮数: ${ROUNDS}"
  if [ -n "$TOKEN" ]; then say " 令牌: 已提供（长度 ${#TOKEN}）"; else say " 令牌: 未提供（仅能测公开资源）"; fi
  say " 参数: 连接超时 ${CONNECT_TIMEOUT}s / 单次最长 ${MAX_TIME}s"

  local any_ok=0 m
  IFS=',' read -ra _modes <<< "$MODES"
  for m in "${_modes[@]}"; do
    case "$m" in
      baseline) run_baseline && any_ok=1 ;;
      archive)  run_public_bandwidth; run_archive; [ ${#R_PUBLIC[@]} -gt 0 ] && any_ok=1 ;;
      single)   run_single && any_ok=1 ;;
      bulk)     run_bulk && any_ok=1 ;;
      *) warn "未知模式：$m" ;;
    esac
  done
  if [ -n "$CUSTOM_URLS" ]; then run_custom && any_ok=1; fi

  render_report
  [ "$JSON" = 1 ] && emit_json
  [ "$any_ok" = 1 ] && return 0 || return 1
}

main "$@"
exit $?
