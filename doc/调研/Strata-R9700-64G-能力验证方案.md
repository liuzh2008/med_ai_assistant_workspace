# Strata + R9700 + 64G 内存：Q2_0 实际效果验证方案

> 目标：在 **Radeon AI PRO R9700 32GB + 64GB 内存** 的固定硬件上，测出
> `qwen3.8-flash-next-q2_0` 的单路能力、并发扩展性与内存安全边界。
> 文档版本：2026-10-31。配套脚本：`scripts/strata-bench.py`。

---

## 一、先认清一件事：这个组合没有公开数据可抄

| 来源 | 覆盖情况 | 对本配置的可用性 |
|---|---|---|
| 官方 R9700 单卡报告（IQ3_S） | 并发 1，32GB，503GiB RAM | **可作单路对照基线**，但模型和内存都不同 |
| 官方 BATCHING.md | 有 2×/4×R9700 数据 | 单卡 8 路 **无数据** |
| 社区帖（lcz.me 等） | 个人折腾、双卡跑 27B | 非 Strata + 非 Q2_0 + 非 64G |

结论：**必须自测。** 本方案的价值是把"自测"做成可复现、可对照、结论可判定的流程。

## 二、测试环境怎么拿到

国内公有云与云电脑均不提供 R9700（已核实阿里云、腾讯云、火山引擎的在售卡型，
均为 NVIDIA 系）。可选路径：

| 路径 | 成本（2026-10 参考） | 适用性 |
|---|---|---|
| **自购单卡 + 64G 主机** | 卡 ¥10,999（瀚铠）～¥17,999（讯景）；整机另计约 ¥5,000–8,000 | 最可控，可反复测，结论可直接迁移到采购决策 |
| **R9700 GPU 独服租用** | 见算力.ai 比价 | 短期验证；须确认 amdgpu 驱动、`/dev/kfd` 直通、memlock 上限 |
| **厂商/渠道借测** | 免费 | 时间不可控，不如前两条 |

> 若长期要落地，自购更划算；若只做一次性验证，独服足够。
> **云电脑（云桌面）这条路走不通**：无 root、无 GPU 直通、无法 `--ulimit memlock`、
> 无法装 Docker，Strata 引擎检测不到卡。

## 三、环境锁定清单（不记录这些，数据不可比）

测试前把下列信息抄进结果文件，缺一项结论就不可复现：

```bash
uname -r                                   # 内核，须 >= 6.8（amdgpu）
cat /etc/os-release | head -3              # 发行版
rocminfo | grep -E "Marketing Name|gfx"    # 卡型号应为 gfx1201
rocm-smi --showmeminfo vram                # 显存 32GB
rocm-smi --showproductname                 # 驱动的卡名
ls -l /dev/kfd /dev/dri/renderD*           # 直通设备与权限
ulimit -l                                  # memlock，应为 unlimited
free -g                                    # 内存 64GB
df -h /mnt/nvme                            # 模型盘 NVMe 剩余空间（>=150G）
docker exec strata strata --version        # 引擎版本
```

**硬件固定项**：R9700 单卡、64GB DDR5、PCIe 4.0/5.0 x16（若主板降速到 x8，
prefill 会明显掉，必须记录链路宽度 `lspci -vv | grep LnkSta`）。

## 四、测试矩阵

分 **三组**，组间不要混跑，否则质量与性能互相污染。

### A 组：单路能力基线（`PARALLEL=1`）

| 项 | 设置 | 记录 |
|---|---|---|
| 短 prompt（~200 token）生成 | max_tokens=256，temperature=0 | decode tok/s、TTFT |
| 4K prompt | 同上 | prefill tok/s、TTFT |
| 32K prompt | 同上 | prefill tok/s、TTFT |
| 输出质量抽查 | 10 题固定题库，人工/规则判分 | 正确率、格式遵循率 |

**对照**：官方 R9700 IQ3_S 单卡为 1K→101.9、4K→96.4、32K→95.6 tok/s。
Q2_0 更小，单路 decode **不应低于 90 tok/s**；若明显更低，先查链路宽度和
`--pool-workers` 配置，别急着下结论。

### B 组：并发扩展（`PARALLEL=1,2,4,8`）

用配套脚本跑阶梯：

```bash
python scripts/strata-bench.py \
  --base-url http://127.0.0.1:8080 --api-key "$KEY" \
  --model qwen3.8-flash-next-q2_0 \
  --concurrency 1,2,4,8 --rounds 3 --max-tokens 256 \
  --out /tmp/strata-r9700-concurrency.json
```

同时另开一个终端采采样资源：

```bash
# 显存与占用，每秒一行
rocm-smi --showuse --showmemuse --showtemp
# CPU 与内存
vmstat 1 | awk '{print strftime("%H:%M:%S"), $0}'
```

**判定阈值**（基于官方扩展数据推算，须用实测校准）：

| 指标 | 合格线 | 说明 |
|---|---|---|
| 4 路总吞吐 / 单路 | ≥ 2.5× | 官方 A6000 4 路为 1.69×，R9700 架构更新，应更好 |
| **8 路总吞吐 / 4 路** | **≥ 1.15×** | 低于此说明 CPU 专家计算已饱和，8 路只是排更多队 |
| 8 路 TTFT p95 | ≤ 单路 10× | 超过则排队不可接受 |
| 失败率 | 0 | 任何失败都记为缺陷 |

### C 组：内存安全边界（重点，64G 是这套配置的薄弱环节）

Q2_0 官方内存账：experts 34GB 进 RAM，另需 ~10GB 给系统，即 **≈44GB 底线**。
R9700 32GB 显存装不下 34GB experts，**约 7GB 专家必须留在 RAM 走 CPU**，
所以 64GB 的余量比"44G 就够"看起来紧张得多。

按下列顺序加压，每档观察 `vmstat` 的 `si/so`（swap 进出）：

| 档 | CONTEXT | PARALLEL | 关注点 |
|---|---|---|---|
| C1 | 32k | 4 | 基线，应无 swap |
| C2 | 32k | 8 | slots 挤占 expert cache 后的表现 |
| C3 | 64k | 8 | pinned RAM 增长 |
| C4 | 128k + `--kv-resident` | 8 | **最危险档**，每 slot 约 1.6GB pinned RAM |

**判定**：任一档出现 `si/so` 持续 > 0，或 `dmesg` 有 OOM，即判定该档不可用，
回退到上一档。Strata 启动日志里的 `free-memory` 与
`FileExpertSource: N of M ... lendable slots` 两行是重要旁证。

## 五、指标定义（口径统一才叫"准确"）

- **TTFT**：从发出请求到收到第一个**输出 token**（含 `reasoning_content`）的时间。
- **decode tok/s**：`(输出 token 数) / (末 token 时间 − 首 token 时间)`，**不含 prefill**。
- **prefill tok/s**：`prompt token 数 / TTFT 中的 prefill 部分`。若服务端不分开报，
  用长度差异法：`(L2 − L1) / (TTFT2 − TTFT1)`。
- **总吞吐**：`Σ 输出 token / 墙钟时间`（并发下的关键指标）。
- **扩展效率**：`N 路总吞吐 / 单路总吞吐 × 100%`。

> 所有数值取 **中位数**，每档至少 3 轮，首轮作废（时钟爬坡、页缓存未热）。

## 六、必须先排除的六个陷阱

1. **MTP 开关不一致**。带 `--mtp` 与不带，单路能差 15–30%。跨组对比前确认两边一致。
2. **自适应专家缓存会自己动**。默认 `--expert-cache auto` 会在轮次之间挪专家，
   导致同一 prompt 两次结果不同。要对比时加 `--adapt-every 1000000 --pcie-frac 0`。
3. **prompt cache 复用**。第二轮起 prompt 可能命中缓存，TTFT 虚低。脚本已内置冷启动请求，
   但长 prompt 测试仍建议每轮换同长度不同内容。
4. **首次请求不是测量值**。模型加载后的第一个请求要丢弃。
5. **量化噪声**。同配置两次跑差 5% 属正常；差 20% 才是问题。
6. **桌面占用显存**。若这台机器同时跑桌面，`--vram-reserve-mib` 要给足（官方建议 ≥3072），
   否则 amdgpu 会把显存换出，杀进程。

## 七、执行顺序（约半天）

```
1. 环境锁定清单抄录                    15 min
2. 部署 + 健康检查（PARALLEL=1）        30 min（含 76GB 模型下载）
3. A 组单路基线                        60 min
4. B 组并发阶梯（1/2/4/8 × 3 轮）      90 min
5. C 组内存加压（C1→C4）               45 min
6. 汇总：扩展效率表 + 内存红线           30 min
```

## 八、结论怎么下

拿到数据后，按这三问收口：

1. **8 路是否值得？** 看"8 路/4 路总吞吐"。≥1.15× 才有意义；否则生产上应限 4 路，
   或用 2 张 R9700 做 layer split（官方 4×R9700 的 serving profile 就是为多卡写的）。
2. **64G 够不够？** 看 C 组的 swap 与 OOM。若 128K+8 路触发 swap，生产上锁 64k 或降并发。
3. **单路能力是否达标？** 对照 A 组与官方 IQ3_S 基线，若显著偏低，先排查链路宽度、
   `--pool-workers`（与物理核数相关）、是否误开了 `--kv q4_0` 等降精度选项。

---

## 附：与"换卡"方案的对照成本

如果实测结论是"32GB 装不下 experts、8 路不划算"，替代路径是 **2×R9700（64GB 显存）**
或换单卡 48GB 的 A6000。前者卡成本约翻倍但显存翻倍；后者 Strata 白名单明确支持，
但国内云同样租不到，仍需自建或独服。**先测再买，别反过来。**
