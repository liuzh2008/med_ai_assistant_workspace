#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
strata-bench.py — Strata / OpenAI 兼容接口的并发阶梯压测（零第三方依赖）

目的：在指定并发梯度（1/2/4/8）下测量 TTFT、总吞吐、每路吞吐与失败率，
      用于判断 R9700 单卡 + 64G 内存跑 Q2_0 时，8 路并发是否真的比 4 路划算。

用法示例：
  python strata-bench.py \
      --base-url http://127.0.0.1:8080 \
      --api-key  <YOUR_KEY> \
      --model    qwen3.8-flash-next-q2_0 \
      --concurrency 1,2,4,8 --rounds 3 \
      --max-tokens 256 \
      --out result.json

关键约定（保证可比性）：
  * temperature=0，greedy；stream=True 才能准确取 TTFT。
  * 每轮都用同一个 prompt，且每轮换新 prompt 会污染 prompt cache —— 本脚本
    默认在每轮开始前发一次“冷启动”请求，让缓存状态一致。
  * 每个并发档跑 --rounds 轮，取中位数，避免首轮抖动。

退出码：0 全部成功；1 有失败请求；2 参数/连接错误。
"""

import argparse
import asyncio
import json
import statistics
import sys
import time
import urllib.error
import urllib.request

DEFAULT_PROMPT = (
    "请写一段约 400 字的说明，解释为什么在长上下文中，线性注意力（如 Gated DeltaNet）"
    "还需要与稀疏全注意力（如 QSA）交替使用。要求条理清晰，不要使用列表符号。"
)


def stream_chat(base_url, api_key, model, prompt, max_tokens, timeout):
    """发一次流式请求，返回首 token 延迟、末 token 延迟与 token 计数。"""
    url = base_url.rstrip("/") + "/v1/chat/completions"
    body = json.dumps(
        {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": max_tokens,
            "temperature": 0,
            "stream": True,
            "stream_options": {"include_usage": True},
        }
    ).encode("utf-8")

    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("Authorization", "Bearer " + api_key)

    t0 = time.perf_counter()
    t_first = None
    chunks = 0
    completion_tokens = None

    with urllib.request.urlopen(req, timeout=timeout) as resp:
        for raw in resp:
            line = raw.decode("utf-8", "replace").strip()
            if not line or not line.startswith("data:"):
                continue
            payload = line[5:].strip()
            if payload == "[DONE]":
                break
            try:
                obj = json.loads(payload)
            except json.JSONDecodeError:
                continue

            usage = obj.get("usage")
            if usage and usage.get("completion_tokens"):
                completion_tokens = usage["completion_tokens"]

            choices = obj.get("choices") or []
            if not choices:
                continue
            delta = choices[0].get("delta") or {}
            piece = delta.get("content") or delta.get("reasoning_content") or ""
            if piece:
                if t_first is None:
                    t_first = time.perf_counter()
                chunks += 1

    t_end = time.perf_counter()
    if t_first is None:
        raise RuntimeError("未收到任何输出 token")

    tokens = completion_tokens if completion_tokens else chunks
    return {
        "ttft_ms": (t_first - t0) * 1000.0,
        "latency_ms": (t_end - t0) * 1000.0,
        "tokens": tokens,
        "chunks": chunks,
        "decode_s": max(t_end - t_first, 1e-6),
    }


async def one(args, prompt):
    return await asyncio.to_thread(
        stream_chat,
        args.base_url,
        args.api_key,
        args.model,
        prompt,
        args.max_tokens,
        args.timeout,
    )


async def run_burst(args, n, prompt):
    """同时发 n 个请求，返回 (成功列表, 失败列表, 墙钟秒)。"""
    t0 = time.perf_counter()
    tasks = [asyncio.create_task(one(args, prompt)) for _ in range(n)]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    wall = time.perf_counter() - t0

    ok, bad = [], []
    for r in results:
        if isinstance(r, Exception):
            bad.append(repr(r))
        else:
            ok.append(r)
    return ok, bad, wall


def pct(values, p):
    if not values:
        return float("nan")
    if len(values) == 1:
        return values[0]
    ordered = sorted(values)
    k = (len(ordered) - 1) * (p / 100.0)
    lo = int(k)
    hi = min(lo + 1, len(ordered) - 1)
    return ordered[lo] + (ordered[hi] - ordered[lo]) * (k - lo)


async def main_async(args):
    # 1) 连接自检 + 模型名确认
    try:
        req = urllib.request.Request(args.base_url.rstrip("/") + "/v1/models")
        req.add_header("Authorization", "Bearer " + args.api_key)
        with urllib.request.urlopen(req, timeout=30) as resp:
            models = json.loads(resp.read().decode("utf-8", "replace"))
        ids = [m.get("id") for m in models.get("data", [])]
        print(f"[自检] 服务端模型: {ids}")
        if args.model not in ids:
            print(f"[警告] 请求的 model={args.model} 不在 /v1/models 列表里，仍继续")
    except Exception as exc:  # noqa: BLE001
        print(f"[错误] 无法连接 {args.base_url}/v1/models: {exc}", file=sys.stderr)
        return 2

    prompt = DEFAULT_PROMPT
    if args.prompt_file:
        with open(args.prompt_file, "r", encoding="utf-8") as fh:
            prompt = fh.read()
    print(f"[配置] prompt 字符数={len(prompt)} max_tokens={args.max_tokens} "
          f"rounds={args.rounds}")

    report = {"endpoint": args.base_url, "model": args.model, "levels": []}

    for n in args.concurrency:
        rounds = []
        for r in range(args.rounds):
            # 冷启动：每次正式测量前先发一个单请求，让 prompt cache 状态一致
            try:
                await one(args, args.cold_prompt)
            except Exception:  # noqa: BLE001
                pass
            ok, bad, wall = await run_burst(args, n, prompt)
            if not ok:
                print(f"[失败] 并发={n} 第{r+1}轮 全部请求失败: {bad[0] if bad else 'n/a'}")
                rounds.append({"ok": 0, "bad": len(bad), "wall_s": wall})
                continue
            total_tokens = sum(x["tokens"] for x in ok)
            ttfts = [x["ttft_ms"] for x in ok]
            per_path = [x["tokens"] / x["decode_s"] for x in ok]
            rounds.append(
                {
                    "ok": len(ok),
                    "bad": len(bad),
                    "wall_s": wall,
                    "total_tps": total_tokens / wall,
                    "per_path_tps_median": statistics.median(per_path),
                    "ttft_p50_ms": pct(ttfts, 50),
                    "ttft_p95_ms": pct(ttfts, 95),
                }
            )
            print(f"  并发={n} 轮{r+1}: 成功={len(ok)}/{n} "
                  f"总吞吐={rounds[-1]['total_tps']:.1f} tok/s "
                  f"TTFT_p50={rounds[-1]['ttft_p50_ms']:.0f}ms "
                  f"墙钟={wall:.1f}s")

        good = [x for x in rounds if x.get("ok")]
        if good:
            agg = {
                "concurrency": n,
                "total_tps": statistics.median([x["total_tps"] for x in good]),
                "per_path_tps": statistics.median([x["per_path_tps_median"] for x in good]),
                "ttft_p50_ms": statistics.median([x["ttft_p50_ms"] for x in good]),
                "ttft_p95_ms": statistics.median([x["ttft_p95_ms"] for x in good]),
                "failures": sum(x["bad"] for x in rounds),
            }
            report["levels"].append(agg)

    # 汇总表 + 扩展效率
    print("\n并发  总吞吐(tok/s)  每路(tok/s)  TTFT_p50  TTFT_p95  扩展效率")
    base = None
    for lv in report["levels"]:
        if lv["concurrency"] == 1:
            base = lv["total_tps"]
        eff = "--"
        if base:
            eff = f'{lv["total_tps"] / base * 100:.0f}%'
        print(f'{lv["concurrency"]:>4}  {lv["total_tps"]:>13.1f}  '
              f'{lv["per_path_tps"]:>10.1f}  {lv["ttft_p50_ms"]:>8.0f}ms  '
              f'{lv["ttft_p95_ms"]:>8.0f}ms  {eff:>8}')

    if args.out:
        with open(args.out, "w", encoding="utf-8") as fh:
            json.dump(report, fh, ensure_ascii=False, indent=2)
        print(f"\n[输出] 明细已写入 {args.out}")

    any_fail = any(lv.get("failures") for lv in report["levels"])
    return 1 if any_fail else 0


def parse_args():
    p = argparse.ArgumentParser(description="Strata 并发阶梯压测")
    p.add_argument("--base-url", default="http://127.0.0.1:8080")
    p.add_argument("--api-key", default="", help="Strata 的 API_KEY")
    p.add_argument("--model", default="qwen3.8-flash-next-q2_0")
    p.add_argument("--concurrency", default="1,2,4,8",
                   help="逗号分隔的并发档位，默认 1,2,4,8")
    p.add_argument("--rounds", type=int, default=3, help="每档轮数，取中位数")
    p.add_argument("--max-tokens", type=int, default=256)
    p.add_argument("--timeout", type=float, default=600.0)
    p.add_argument("--prompt-file", default=None, help="用文件内容替换默认 prompt")
    p.add_argument("--out", default=None, help="结果 JSON 路径")
    args = p.parse_args()
    args.concurrency = [int(x) for x in args.concurrency.split(",") if x.strip()]
    args.cold_prompt = "热身：请只回复“就绪”两个字。"
    return args


if __name__ == "__main__":
    parsed = parse_args()
    try:
        sys.exit(asyncio.run(main_async(parsed)))
    except KeyboardInterrupt:
        print("\n[中断]", file=sys.stderr)
        sys.exit(130)
