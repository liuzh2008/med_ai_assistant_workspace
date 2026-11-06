# Avalon 推理引擎跑 Qwen3.8-Flash-Next 的表现调研

**日期**：2026-11-06　**用途**：判断 Avalon（与 Strata 同类的本地 LLM 推理引擎）跑 Qwen3.8-Flash-Next 是否值得替换本机现有 Strata 部署
**方法**：公开实测数据（第三方可复现 benchmark）+ 引擎机制分析 + 本机平台适配性核对
**数据前提**：本文所有性能数字均来自 **AMD RX 7900 XTX（RDNA3 / gfx1100）+ Linux + ROCm** 环境，**不是本机（Windows + NVIDIA）实测**。本机没有跑过 Avalon。

**结论先行**：
1. **Avalon 强在 decode，弱在 prefill**：生成比 Strata 快 14–26%，但 prefill 只有 Strata 的 **53–58%**，投机解码接受率低 15–25 个百分点。所谓"比 Strata 快 40%"只在"短提示 + 纯生成"这一种情形下成立。
2. **跑的不是同一个模型文件**：Strata 侧是 GSQ-RCO IQ3_S 原生 pack（77.9 GiB / 2 分片），Avalon 侧是 IQ3KS（89.7 GiB / 33 分片）。严格说这不是同条件 A/B，量化点不同。
3. **本机用不上**：可查到的 Avalon 实测与配置全部是 Linux + ROCm + RDNA3，二进制 `avalon-server` 依赖 `taskset` 绑核。本机是 Windows + NVIDIA（5080 / 5070），另有 R9700（RDNA4），**没有一条能直接套用**。
4. **对本项目的结论**：现有机型不值得为此换引擎；若哪天在 Linux + RDNA3 机上试，必须先测 **prefill**，因为本项目的负载形状（数万 token 输入 + 数万 token 输出）恰好压在 Avalon 的短板上。

---

## 一、Avalon 是什么

| 项 | 事实 | 出处 |
|---|---|---|
| 身份 | **llama.cpp 的 fork**，针对 RDNA3 与本机 CPU 重调 | Strata issue #5113 原文 |
| 二进制 / 版本 | `avalon-server`，构建号 `a91372e` | 同上（复现命令段） |
| 启动特征 | 需 `-t 16`、`taskset 0-19` 绑核，MTP draft 2 | 同上 |
| 宣称优势 | "专门支持 RDNA3，特别优化过"，同版本比 Strata 快 40% 以上 | 抡锤者论坛 post #31092（2026-11-04） |
| 公开仓库 | **未检索到** GitHub 仓库或发行页；可查证据只有论坛帖与 Strata 仓库里的第三方 benchmark | 本轮检索 |
| 机制差异（社区口径） | **Strata 串行、Avalon 并行**，多进程并发调用时 Avalon 占优 | 论坛 post #31277 |

> 这意味着：Avalon 目前是**小圈子分发的产物**，没有可审计的发布链路、没有 changelog、没有平台支持声明。把它放进生产链路前，这个风险要单独记账。

---

## 二、唯一一份可复现的第三方实测

来源：[Niko1221/Strata issue #5113](https://github.com/Niko1221/Strata/issues/5113)（作者 ditupao，2026-11-03，已被 Strata 官方收进 benchmarks 页后关闭）。

**测试条件**：RX 7900 XTX 24 GB（gfx1100）、Ubuntu 24.04 / ROCm 7.2.4、i7-14700K（8 P 核）、128 GB DDR4-2666；模型 Qwen3.8-Flash-Next，262,144 上下文；greedy 采样（temperature 0 / top_k 1 / presence_penalty 0），输出上限 512 token，**thinking 关闭**，每场景 2 次取中位数；语料为《War and Peace》原文，长上下文加随机前缀防 KV 命中。

### 2.1 Prefill（t/s，越高越好）

| 场景 | Strata RDNA3 fork 0.1.49.1 | Strata 官方 0.1.55 | Avalon | Avalon ÷ fork |
|---|---:|---:|---:|---:|
| 32K | **3,484** | 3,198 | 2,044 | **59%** |
| 64K | **3,514** | 3,261 | 1,981 | 56% |
| 131K | **3,332** | 3,220 | 1,861 | 56% |
| 250K | **3,174** | 3,060 | 1,675 | **53%** |

### 2.2 生成（t/s，越高越好）

| 场景 | fork 0.1.49.1 | 官方 0.1.55 | Avalon | Avalon vs fork |
|---|---:|---:|---:|---:|
| 短提示 | 103.2 | 82.8 | **117.5** | **+14%** |
| 32K | 88.5 | 72.7 | **105.9** | **+20%** |
| 64K | 81.3 | 72.0 | **102.2** | +26% |
| 131K | 84.3 | 70.5 | **96.5** | +14% |
| 250K | 82.7 | 68.4 | **95.7** | +16% |

### 2.3 投机解码（MTP）接受率

| 场景 | fork | 官方 0.1.55 | Avalon |
|---|---:|---:|---:|
| 32K | 81% | 77% | **66%** |
| 64K | 81% | 81% | **61%** |
| 131K | 84% | 79% | **57%** |
| 250K | 86% | 83% | **63%** |

### 2.4 怎么读这组数

- **论坛"快 40%"的算法**：用 Avalon 的短提示生成 117.5 去比官方版的 82.8，得 +42%。这个数字**只在 decode、只对官方版、只在短提示**下成立。对上 fork 版是 +14%。
- **代价写在接受率里**：Avalon 生成快，是因为 draft 更激进（draft 2 token、接受率 57–66%）；Strata fork 接受率 81–86%。draft 多、接受少，每步实际产出没涨那么快，**表面 t/s 与真实有效吞吐的差距被拉大了**。
- **prefill 是硬伤**：长上下文场景 Avalon 只有一半速度。131K 的 prefill 时间：Strata fork 39 秒，Avalon 70 秒——首字节延迟直接翻倍。
- **不是同条件 A/B**：两边加载的模型文件不同（IQ3_S 77.9 GiB vs IQ3KS 89.7 GiB），量化位宽与打包方式都不一样。**任何"引擎快慢"的结论都要打这个折扣。**

### 2.5 与本机实测对照（口径不同，必须先换算）

本机两组现成数据（`doc/服务器环境/R9700-vs-5070-真实病例吞吐对比-20261104.md`）：

| 平台 | 引擎 | 模型 | 口径 | tok/s（均值或区间） | 区间 | 输出长度 |
|---|---|---|---|---:|---|---|
| RTX 5070 12GB | Strata 0.1.55 CUDA | Q2_0 | **端到端（含 prefill）** | 102.9 | 95.0–112.2 | 4.3k–13.6k |
| R9700 32GB | Strata 0.1.55 HIP | Q2_0 | **端到端（含 prefill）** | 105.9 | 100.8–113.3 | 4.3k–13.6k |
| RX 7900 XTX 24GB | Avalon | IQ3KS | **纯 decode** | 95.7–117.5 | — | 512 上限 |

**口径差 15–30%**——这是本项目 2026-11-04 那次对比明确记录的经验值（"引擎自报的纯 decode 比端到端高 15–30%"）。不做换算直接比，等于拿本机的"含 prefill 端到端"去比 Avalon 的"纯 decode"，会系统性地贬低本机。换算后：

| 换算方向 | 计算 | 结果 |
|---|---|---|
| 本机 5070 的纯 decode（估） | 102.9 × (1.15–1.30) | **118–134 tok/s** |
| R9700 的纯 decode（估） | 105.9 × (1.15–1.30) | **122–138 tok/s** |
| Avalon 的端到端（32K 进 / 10K 出，估） | 32K÷2,044 + 10K÷105.9 | 15.7 s + 94.4 s = **110 s → 91 tok/s** |

**读法：同口径下 Avalon 对本机没有速度优势。** 纯 decode 的 95.7–117.5 低于本机换算的 118–134；反算成端到端 91 tok/s，也低于本机实测 102.9。

三个方向性事实（不是给本机找补，是解释为什么会出现这种"反直觉"）：

1. **量化位宽差 1 bit**：本机是 Q2（2-bit），Avalon 是 IQ3KS（3-bit）。每 token 的反量化与矩阵计算量更大，Avalon 先背这个包袱。
2. **Avalon 用的是 greedy**（temperature 0），本机是 temperature 0.7 随机采样。greedy 下 draft 命中本该更容易、接受率更高——它仍然只有 57–66%，反过来印证了"draft 激进、接受率被牺牲"这一判断。
3. **12 GB 的卡跑出 102.9，24 GB 的卡跑出 105.9**：这说明跨机对比测的是"整套方案"，不是"引擎能力"。同卡同文件的严格引擎对比只有 issue #5113 里的 fork 88.5 vs Avalon 105.9（32K 档）——**那个 +20% 才是 Avalon 作为引擎的真实增益**，其余差距都来自硬件与量化。

---

## 三、把它换算成本项目的体感

本项目的负载形状（来自本机既有实测，见 `记忆库/会话记忆.md` 与 `doc/调研/AI诊断分析-本地小模型vs官方DeepSeek-5例对比-20261030.md`）：**单份诊断分析输入数万 token、输出 45,000–56,000 token**；文书类输入 13K–32K、输出数 K 字。也就是**长输入 + 长输出**。

按 issue #5113 的 32K 档数据估算（仅示意量级，不是本机实测）：

| 任务 | Strata fork | Avalon | 变化 |
|---|---|---|---|
| 32K 输入 prefill | ~9.2 s | **~15.7 s** | 首字节慢 70% |
| 10,000 token 输出 | ~113 s | **~94 s** | 快 17% |
| 端到端（32K 进 / 10K 出） | ~122 s | ~110 s | 约快 10% |

结论：**长输出能赚回来，长输入先亏掉**。项目里"诊断分析 45k token 输出"这种任务 Avalon 有理论优势；"查房/病程"这种输入为主、输出几千字的任务基本无感甚至变慢。

---

## 四、本机能不能上：不能直接上

| 本机资产 | 与 Avalon 的关系 |
|---|---|
| Windows + RTX 5080 / 5070（NVIDIA） | Avalon 可查证据全部是 Linux + ROCm + AMD；未检索到 Windows 构建或 NVIDIA 后端 |
| Radeon R9700（RDNA4 / gfx1201） | Avalon 明确针对 **RDNA3（gfx1100 系列）** 优化；RDNA4 上是否生效、是否有 Kernel 适配，无任何公开数据 |
| 现有 Strata 0.1.55 + `qwen3.8-flash-next-q2_0` | 已跑通、已接进 MedAI 执行服务器；端到端基线 5070 **102.9** / R9700 **105.9** tok/s |
| 要上 Avalon 的最小成本 | 一台 Linux + ROCm 机器、单独准备 IQ3KS（89.7 GiB / 33 分片）、`taskset` 绑核调优、没有官方支持 |

一个值得注意的对照：**7900 XTX（24 GB，RDNA3）上 Avalon 的 32K 生成是 105.9 t/s**，与本机 5070（12 GB，Q2 量化）Strata 的 ~105 t/s **数值相当**。也就是说，Avalon 的"快"是相对同卡 Strata 而言的，跨硬件没有可比性——不必因为论坛的 40% 产生"本机也能提速 40%"的预期。

---

## 五、结论与建议

1. **现有部署不动**。Avalon 的平台前提（Linux / ROCm / RDNA3）与本机（Windows / NVIDIA / RDNA4）不重合，替换的工程量与收益不成比例。
2. **如果要在 R9700 Linux 机上试，先测 prefill 再测 decode**。本项目所有高价值生成都是长输入，prefill 是决定体感的第一项；只测 decode 会被"快 40%"误导。
3. **要做对比就做同模型同量化的对比**。issue #5113 用 IQ3_S 对 IQ3KS，这一条就足以让结论打对折；我们要做，必须两边加载同一个文件（同一 hash）。
4. **Avalon 的并行架构值得单独评估**。Strata 串行、Avalon 并行（社区口径，未验证）——如果将来走"单机多用户"路线（500 用户方案），这条比 decode 快 14% 重要得多，但目前没有任何并发实测数据支撑。
5. **质量维度不受引擎影响**。引擎不改变权重；换引擎只改变速度、上下文、量化支持。真正的质量变量仍是量化位宽（本机 Q2 vs IQ3 的 3-bit 是另一件事，见 `doc/调研/Qwen3-32B-Q6-vs-当前模型-能力对比-20261031.md` §三）。

---

## 六、待验证（本轮没查到的）

- Avalon 是否有 Windows 构建、是否支持 CUDA / NVIDIA 后端。
- Avalon 在 RDNA4（R9700 / gfx1201）上的实际表现。
- 多进程并发下的吞吐与显存行为（"并行"架构的实证）。
- 同模型同量化、thinking 开启条件下的 A/B（issue #5113 关掉了 thinking，而本项目的医疗文书全部开 thinking）。
- Avalon 的维护状态与发布渠道（无公开仓库，无法审计）。

---

## 七、出处

| 内容 | 链接 |
|---|---|
| 四引擎完整实测（本表数据来源） | [Strata issue #5113](https://github.com/Niko1221/Strata/issues/5113) |
| "快 40% / 专门优化 RDNA3"论坛原帖 | [抡锤者论坛 post #31092](https://lcz.me/topic/2842/4) |
| "Strata 串行、Avalon 并行" | 同上，post #31277 |
| Strata RDNA3 fork | [nicejunjie/Strata-rdna3](https://github.com/nicejunjie/Strata-rdna3) |
| Strata 上游 | [Niko1221/Strata](https://github.com/Niko1221/Strata) |
| 模型规格与官方基准（GPQA 91.7 / SWE-bench Pro 62.5 / Toolathlon 73.5） | [AvalAI 模型通告](https://docs.avalai.ir:8443/en/news/2026-08-29-qwen3-8-27b-and-qwen3-8-flash-added)、[Artificial Analysis](https://artificialanalysis.ai/models/qwen3-8-flash-next) |
