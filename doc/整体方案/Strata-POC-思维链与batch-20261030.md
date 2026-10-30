# POC 实测：思维链预算 与 batch 并发（Strata 本机）

> 日期：2026-10-30
> 目的：验证《Strata 本地模型-2000床医院硬件估算》里两个降本杠杆——①关掉隐藏思维链（预期 ÷3.5）、③开 `--batch`（预期 ×2）——是否成立
> 环境：RTX 5070 12 GB / 64 GB RAM / i7-14700KF（28 线程）/ Strata 0.1.50 引擎 + 0.1.51 服务层 / `qwen3.8-flash-next-q2_0`
> 复现脚本：`.dsh/tmp/diag-compare/run-thinking.mjs`、`check-thinking.mjs`、`bench-batch.mjs`

---

## 0. 结论（两句话）

1. **杠杆一成立，但要用 `reasoning_budget_tokens`，不是 `reasoning_effort`**：`budget=8000` 让 token **÷3.21**、耗时 **÷2.78**、字数反而 **+7.8%**、结构契约 **5/5 全过**。而 `reasoning_effort=none`（我以为的"关掉"）和 `low` 各有 2 例**正文完全为空或结构崩塌**，**绝不可用于生产**。
2. **杠杆三不成立，且在 12 GB 卡上是净亏**：同配置下 `--batch 2` 让单流 75.4→65.7 tok/s、两路聚合 83.0→74.6 tok/s（**降 10~13%**）；而为了塞进 batch 必须把上下文 131K→32K、`--kv-resident` 32768→8192，单流本身先掉 22%。**12 GB 卡不要开 batch，靠加卡/加副本，不靠批处理。**

---

## 1. 第 1 项：思维链预算

### 1.1 三档实测（同 5 例、同 prompt、同参数）

| 配置 | 请求参数 | token 合计 | 耗时合计 | 字数合计 | 结构契约 | 判定 |
|---|---|---|---|---|---|---|
| 基线 | 无（模型默认思考） | 226,912 | 1,981 s | 43,577 | 5/5 | 基准 |
| **budget8k** | `reasoning_budget_tokens: 8000` | **70,669** | **713 s** | **46,962** | **5/5** | ✅ **采用** |
| none | `reasoning_effort: "none"` | 47,295 | 532 s | 146,755 | 3/5 | ❌ 不可用 |
| low | `reasoning_effort: "low"` | 84,341 | 745 s | 20,141 | 3/5 | ❌ 不可用 |

**budget8k 相对基线**：token **÷3.21**、耗时 **÷2.78**、字数 **+7.8%**。

> 字数反增是关键证据：原来 70% 的算力烧在用户看不见的思维链上，关掉预算后同样的字数只需 1/3.2 的 token。

### 1.2 逐例明细

| 例 | 基线 | budget8k | none | low |
|---|---|---|---|---|
| P1 | 56,348 tok / 427 s | 14,245 / 132 s（×0.25） | 8,464 / 96 s / 30,774 字 | 9,057 / 76 s / **0 字** |
| P2 | 27,301 / 279 s | 13,670 / 142 s（×0.50） | 6,448 / 74 s / 19,442 字 | 12,325 / 113 s / 4,304 字 |
| P3 | 55,188 / 501 s | 14,016 / 142 s（×0.25） | 12,468 / 137 s / 37,295 字 | 16,896 / 164 s / 8,061 字 |
| P4 | 55,655 / 460 s | 14,773 / 149 s（×0.27） | 10,037 / 114 s / 30,131 字 | 26,066 / 228 s / 7,776 字 |
| P5 | 32,420 / 314 s | 13,965 / 148 s（×0.43） | 9,878 / 111 s / 29,113 字 | 19,997 / 164 s / **0 字** |

**budget8k 的稳定性**：五例 token 落在 13,670–14,773 的窄带（±4%），耗时 132–149 s（±6%）。这是**可预算**的行为——对容量规划极重要。

### 1.3 为什么 none 和 low 会坏（源码级解释）

Strata 的解析器把 `content` 与 `reasoning` 分开返回。关掉思考后，模型**并没有被训练成"直接作答"**，它仍然输出推理文本，只是没有 `<think>` 标签包裹——解析器于是把整段推理当正文返回。

`serve/dsml.py:172-175` 的官方注释写得很直接：

> "The 2-bit sets often write the whole answer after `<think>` and stop (EOS) without `</think>`: everything would be reasoning and the reply empty (P2003 install test, 4 of 4 prompts)."

实测完全对上：

- **P1 none**：正文是 30,774 字**英文**内心独白（` ```thinking Hmm, this is a complex case... ` 开头），四段结构一个都没有，诊断 0 条。
- **P4 none**：能出结构，但 18 条诊断里 3 条类别非法、9 条依据不足 3 条、8 条缺鉴别 —— 契约崩。
- **P1 / P5 low**：生成了 9,057 / 19,997 token，**返回正文是空字符串**（全部 token 进了 reasoning）。医院端看到的就是"AI 没反应"。
- **P4 low**：26,066 token / 228 s，比基线还慢，等于白改。

> 这是本项目一条新的踩坑判据：**"AI 回复为空"不一定是超时或服务挂，可能是 `reasoning_effort` 设成了 none/low，token 全进了 reasoning 通道。**

### 1.4 结构契约校验口径

| 检查项 | 口径 |
|---|---|
| 四段齐全 | `### 诊断列表` / `### 数据冲突点` / `### 下一步建议` / `### 删除建议` |
| 编号连续 | `诊断编号` 必须 1..n，不跳号不回退 |
| 类别合法 | 仅 `原诊断` / `修正诊断` / `补充诊断` |
| 依据 ≥3 | 每条诊断的「诊断依据」编号项 ≥3 |
| 鉴别非空 | 每条诊断「鉴别诊断」至少 1 条排除理由 |

budget8k：**5/5 全过**，诊断条目均 19.6（基线 20.2，基本持平）。

### 1.5 附带红利：前缀缓存已被验证（POC 第 4 项）

同一批请求的引擎日志：

```
prompt 18305 tokens = 18300 reused + 5 read in 3873 ms (774.6 tok/s)
```

- **缓存命中 18,300 / 18,305 = 99.97%**
- 预填只读 5 个 token，耗时 3.9 s（而非冷启动的 8.1 s）
- `/metrics` 的 `conversation_cache` 显示 30 次请求中 24 次复用，`reused_tokens 185,495 / prompt_tokens 465,282 = 40%`

**这意味着**：批量场景下（同 systemPrompt + 同模板），预填成本几乎消失，实际成本只剩 decode。容量估算里按"端到端 token/耗时"算是对的，但不必再为预填额外加机器。

---

## 2. 第 3 项：batch 并发

### 2.1 三组对照（同一台机、同一模型、同 600 token 输出）

| 配置 | c=1 聚合 | c=2 聚合 | c=4 聚合 | 说明 |
|---|---|---|---|---|
| **131K / `--parallel 1`**（原配置） | 96.7 tok/s | 99.5 | 99.5 | 基线；c≥2 时延迟线性叠加，吞吐不变 |
| **32K / `--parallel 1`** | 75.4 | 83.0 | — | 仅降上下文与 kv-resident 的代价 |
| **32K / `--parallel 2`**（batch 2） | **65.7** | **74.6** | 77.7 | 开了 batch 反而更低 |

> c=1 的 87.8→96.7 差异来自冷启动（首轮前缀缓存未命中），取 96.7 为真实单流。

### 2.2 三层次结论

**① 无 batch 时并发 = 排队，吞吐完全不变**
c=1/2/4 的聚合吞吐都是 88–100 tok/s，延迟线性叠加（c=4 时最长 16.4 s ≈ 4×4 s）。这是单序列引擎的必然行为，也印证了"2000 床必须多卡多引擎、不能靠单机多请求"。

**② 开 batch 必须付出上下文代价，且代价很大**
12 GB 卡只剩 494 MiB 空闲（`vram_free_mib: 494`），每个 slot 需要独立 session 显存。为塞进 2 个 slot，只能：
- `--max-context` 131072 → 32768
- `--kv-resident` 32768 → 8192（KV 更多走 PCIe 流式）
- `--conversation-cache-slots` 2 → 4、`--vram-reserve-mib` 900 → 600

结果单流 **96.7 → 75.4（-22%）**。

**③ batch 2 本身是负收益：-10~13%**

`batch_slots=2` 确实生效了（`/metrics` 的 `parallel: 2`、两个 slot 都 idle），但：

- c=1：75.4 → 65.7（**-13%**）
- c=2：83.0 → 74.6（**-10%**）
- c=4：77.7（排队，仍低于无 batch 的 99.5）

**原因**：这是 MoE 模型 + 2-bit 量化，decode 瓶颈是**专家权重读取带宽**（GPU util 已 99%），不是计算密度。两个请求路由到不同专家时，需要读的权重集合变大 → 带宽需求翻倍 → 每个 slot 变慢近一倍，聚合吞吐不升反降。通用 vLLM 的"batch 提吞吐"经验在这里不适用。

### 2.3 对硬件方案的修正

| 原假设（文档 v1） | 实测 | 修正 |
|---|---|---|
| 关思维链 ÷3.5 | **÷3.21** | 基本成立，略保守 |
| 开 batch ×2 | **×0.87~0.90**（负收益） | **删除该杠杆** |
| 每卡 1 副本线性叠加 | 未被证伪（batch 负收益反而支持它） | 保留，需 4 卡实机验证 |

**重算台数（B 档 181.3 M token/日，夜窗 9 h，单卡 3.40 M/夜）**：

| 档 | 日 token | 关思维链后 | 卡数 | 台数（4 卡/台 + 1 实时 + 1 容灾） |
|---|---|---|---|---|
| A 按需 | 74.9 M | 23.3 M | 6.9 | **3 台** |
| **B 常规** | 181.3 M | 56.5 M | 16.6 | **6 台** |
| C 全量 | 251.3 M | 78.3 M | 23.0 | **7 台** |

即：**原文档"3 台 55–75 万"只对 A 档成立；B 档需 6 台（100–140 万）。** 这个差别必须写进合同口径。

---

## 3. 落地建议

### 3.1 立即可做（不花钱）

1. **请求侧加 `reasoning_budget_tokens: 8000`**，同时把 `max_tokens` 从 65,536 压到 24,000（留足正文 14 k + 余量）。
2. **不要用 `reasoning_effort: none / low`**——会出空正文。
3. **监控面加一条判据**：`finish=stop` 但 `content` 为空 → 查 reasoning 预算配置，不要报"服务超时"。
4. **保持 `--parallel 1`**，不要为了"能并发"去开 batch。

### 3.2 需要再做一次 POC 才能定的

| 项 | 为什么必须做 | 怎么做 |
|---|---|---|
| 4 卡多副本线性度 | 决定 6 台还是 12 台 | 借一台 4×R9700，`--parallel 1` × 4 实例（或 `replicas`），测 4 路并发聚合吞吐是否 ≥3.2× 单卡 |
| batch 在 32 GB 卡上的表现 | 12 GB 的结论不能外推（大卡不必砍上下文） | 同上机器，48K 上下文 + `--parallel 4` |
| 关思维链后的临床质量 | 结构 5/5 不等于临床可用 | 20 例双盲，对照基线评分（基线 3.56/5） |
| 入院记录 / 诊疗计划 / 小结的单份 token | 占 B 档 40% 的估算靠外推 | 各测 3 例回填 |

---

## 4. 复现方法

```powershell
cd 'D:\MedAiAssistant 1.0 BS\.dsh\tmp\diag-compare'

# 第 1 项：三档对比（5 例 × 3 组，约 25 分钟）
node run-thinking.mjs --variants none,budget8k,low
node check-thinking.mjs none budget8k low

# 第 3 项：并发基准（需在 --parallel 1 / 2 两种配置下各跑一遍）
node bench-batch.mjs --c 1 --rounds 3 --tokens 600 --tag c1
node bench-batch.mjs --c 2 --rounds 3 --tokens 600 --tag c2
```

切换 batch 配置（`D:\medkb\tools\strata`）：

```powershell
# 改 q2_0-12g.json：max-context 32768 / kv-resident 8192 / conversation-cache-slots 4
# 然后用 --parallel 2 启动；改完记得从 q2_0-12g.bak-before-batch.json 恢复
```

---

## 附录：本轮实测的原始数据

| 文件 | 内容 |
|---|---|
| `.dsh/tmp/diag-compare/out/{pid}/{none,budget8k,low}.md` | 15 份输出原文 |
| `.dsh/tmp/diag-compare/out/{pid}/{none,budget8k,low}.meta.json` | 每份的 usage / 耗时 / finish_reason |
| `.dsh/tmp/diag-compare/batch-*.json` | 5 组并发基准的逐轮数据 |
| `thinking-run.log` | 采集过程日志 |
| `C:\Users\Administrator\AppData\Local\Strata\launch\q2_0-12g-batch2.engine.log` | batch 2 引擎日志 |
