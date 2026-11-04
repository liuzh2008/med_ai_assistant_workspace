# DeepSeek V4.1 Flash 在 Windows + R9700 的自编译实测（对照 Linux 官方栈）

**日期**：2026-11-04
**范围**：Windows 单卡 R9700（gfx1201）能否跑 DeepSeek-V4.1-Flash Q2、性能如何、与 Linux 官方栈差多少、能否靠配置追回
**模型**：DeepSeek-V4.1-Flash-1017-GSQ-RCO **IST-DAS 2.00 bpw**（≈Q2，256.8 GB 下载）
**结论**：**能跑（需自编译引擎），但性能远不如 Linux**——decode 8.1–8.5 tok/s、prefill ~51 tok/s（1.7K prompt），
约为 Linux 官方栈的 1/3（decode）与 1/8（prefill）；四条"配置层"假设全部验证失败，瓶颈在 WDDM 与编译期差异，**不可通过配置追回**。

---

## 一、结论摘要

| 项 | Windows 自编译 | Linux 官方栈（2026-11-03，2.25bpw） | 差距 |
|---|---|---|---|
| 能否跑通 | ✅（需自编译 `strata-dsv41.exe`） | ✅ 开箱 | — |
| decode（短输出） | **8.1–8.5 tok/s** | 27.1–30.2 tok/s | **约 3.5×** |
| decode（512 tok） | 未单独测 | 14.2–14.4 tok/s | — |
| prefill（1.7K prompt） | **51.3 tok/s** | 433.6（8.7K） | **约 8×** |
| 首 token（冷 / 热） | 1.8–2.05 s / 0.05–0.07 s | 0.034–0.073 s | 热态接近 |
| 进程启动 | 52.2 / 53.0 / 56.2 s | 32.0 s（冷）/ 25.4 s（热） | 1.7× |
| 2 并发 | **完全串行**（吞吐不变） | +58.1%（512 tok） | — |
| 显存占用 | 31.2 / 32 GB | 30.80 / 32 GB | 相当 |
| 显存中专家 | 2807 / 15360 | 2513 / 15360 | 相当 |

**一句话**：Windows 这条路证明了"RDNA4 能跑"，但它的性能数据不能用于容量规划，**应以 Linux 官方栈为准**。

---

## 二、为什么 Windows 必须自编译

1. strata 签名更新源 `strata-feed.json` 中，DeepSeek 引擎（`dsv41`）的 Windows 包只有：
   - `windows-x86_64-cuda-cuda13`（NVIDIA）
   - `windows-x86_64-hip-rdna3` → `BUILD.json` 中 `"archs": ["gfx1151"]`（Strix Halo）
   - **没有** `windows-x86_64-hip-rx9070`（覆盖 gfx1200/gfx1201）
2. 直接 `strata launch --family deepseek41` 报：
   `DeepSeek's engine is not available for this computer yet`
3. 官方 `docs/AMD_HIP.md` 也写明：DeepSeek V4.1-Flash 在 Radeon AI PRO R9700 上**仅 Linux** 可用。
4. 但 CMake 层支持该组合：`option(STRATA_ENABLE_HIP "... gfx1100, gfx1201")`，且 `CMakeLists.txt` 有 `if(WIN32 AND STRATA_ENABLE_HIP)` 分支。
   因此可以自编译。

**验证方法（本次采用）**：解开 rdna3 包看 `BUILD.json` 的 `archs`，并用字符串搜索确认 `strata-dsv41.exe` 内只有 gfx11xx 的 kernel code。

---

## 三、自编译步骤（可复现）

```bat
:: 1. 源码（GitHub 直连在 Windows 上被重置，用 gh-proxy 镜像）
::    https://gh-proxy.com/https://github.com/Niko1221/Strata/archive/refs/heads/main.zip
:: 2. pinned llama.cpp（CMake 默认 FetchContent 拉 GitHub，同样不通）
::    https://gh-proxy.com/https://github.com/ggml-org/llama.cpp/archive/3cf03257f219afbe7334045ff7c6a06ac68c627d.zip
:: 3. CMake
winget install Kitware.CMake
:: 4. VS Build Tools（务必带 --noUpdateInstaller）
winget install Microsoft.VisualStudio.2022.BuildTools --override "--quiet --wait --norestart --nocache --noUpdateInstaller --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
:: 5. ROCm（TheRock pip 源，含 gfx1201 device 包；AMD 官网下载超时）
py -3 -m venv F:\Temp\rocm-venv
F:\Temp\rocm-venv\Scripts\python.exe -m pip install --timeout 900 --retries 30 ^
  --index-url https://nightly.repo.amd.com/rocm/whl-next/ "rocm[libraries,devel,device-gfx1201]==10.2.0a20260930"
F:\Temp\rocm-venv\Scripts\rocm-sdk.exe init
:: 6. 配置
::    -DSTRATA_ENABLE_HIP=ON -DSTRATA_BUILD_DSV41=ON -DCMAKE_HIP_ARCHITECTURES=gfx1201
::    -DCMAKE_HIP_COMPILER=<rocm>/lib/llvm/bin/clang++.exe -DCMAKE_PREFIX_PATH=<rocm>
::    -DSTRATA_GGML_DIR=<llamacpp checkout> -DSTRATA_PORTABLE=ON -DSTRATA_PREFILL_MMQ=ON
:: 7. 编译
cmake --build F:\Temp\build-dsv41 --target strata-dsv41 --parallel 16
:: 8. 运行（引擎目录需带 BUILD.json + rocblas/hipblaslt 库）
set STRATA_DSV41_EXE=F:\Temp\build-dsv41\strata-dsv41.exe
strata launch --model ist-das-2.00bpw --family deepseek41 --context 32k --vision off --port 5080 --yes --no-tui
```

产物 `strata-dsv41.exe` 23.1 MB，二进制内含 `gfx1201`（官方 Windows 包完全没有）。

**引擎目录必须补齐**（否则启动报 rocBLAS/Tensile 错）：

| 文件/目录 | 来源 |
|---|---|
| `amdhip64_7.dll`、`amd_comgr.dll`、`hipblas.dll`、`libhipblaslt.dll`、`rocblas.dll`、`libtensilelite-host.dll`、`origami.dll`、`rocm_kpack.dll` | `_rocm_sdk_devel\bin` |
| `rocblas\library\`（110 文件，含 `Kernels.so-000-gfx1201.hsaco`、`TensileLibrary_lazy_gfx1201.dat`） | `_rocm_sdk_devel\bin\rocblas` |
| `hipblaslt\library\`（165 MB） | `_rocm_sdk_devel\bin\hipblaslt` |
| `BUILD.json`（`"archs": ["gfx1201"]`，`"dsv41": true`） | 手写，供 `dsv41_engine.package_archs()` 识别 |

---

## 四、测试数据

### 4.1 短 prompt（43 tokens 输入，decode 主导）

| 样本 | 输出 tokens | 耗时 | decode |
|---|---|---|---|
| 第 1 次（冷） | 128 | 29.11 s | 4.40 tok/s |
| 第 2 次 | 128 | 15.83 s | **8.08 tok/s** |
| 第 3 次 | 243 | 28.44 s | **8.54 tok/s** |
| 第 4 次 | 309 | 36.25 s | **8.52 tok/s** |

### 4.2 长 prompt（prefill 主导，唯一前缀避免 prefix cache）

| 输入 tokens | 耗时 | prefill | ms/token |
|---|---|---|---|
| 463 | 28.15 s | 16.5 tok/s | 60.8 |
| 872 | 31.94 s | 27.3 tok/s | 36.6 |
| 1689 | 31.71 s | **53.3 tok/s** | 18.8 |

> **方法学教训**：早期测量用 `para*12` 这类重复文本，后一段会命中前一段的 prefix cache，
> 测出过 1663 tokens = 59.9 tok/s 甚至 3080 tok/s 的假值。**prefill 必须每轮换唯一前缀。**

### 4.3 冷/热启动

| 场景 | 耗时 |
|---|---|
| 进程启动 → `/v1/models` = loaded | 52.2 / 53.0 / 56.2 s（三次） |
| 冷首请求（新 prompt，TTFT） | 1.8–2.05 s |
| 热重复请求（完全相同 prompt） | 0.05–0.07 s（prefix cache 命中） |

> `NtSetSystemInformation` 清 standby 缓存返回 False，真正的"磁盘缓存全空"冷启动未测成，上表三次为同条件重复性数据。

### 4.4 并发（每请求 128 tokens）

| 并发 | 墙钟 | 聚合吞吐 | 首个完成 | 最后完成 |
|---|---|---|---|---|
| 1 | 12.95 s | 9.88 tok/s | 12.78 s | 12.78 s |
| 2 | 26.38 s | 9.70 tok/s | 13.10 s | 26.16 s |
| 4 | 45.75 s | 11.19 tok/s | 13.23 s | 45.41 s |

**完全串行排队**：总吞吐恒定，延迟线性叠加。原因是启动参数里没有 `--parallel`（默认一次一个会话）。

---

## 五、四条"配置层"修复假设，全部失败

| # | 假设 | 做法 | 结果 |
|---|---|---|---|
| 1 | rocBLAS Tensile 缺失拖慢 prefill | 把 `rocblas\library`（110 文件）复制进引擎目录 | 报错归零，**0% 提升** |
| 2 | hipBLASLt 调优表不对 | 用 `tune_hipblaslt.exe` 在本机实测生成表（与预置表 solution ID 不同） | **0% 提升**，引擎不读表 |
| 3 | Windows WMMA matrix cores 默认关闭 | `STRATA_HIP_WMMA=1` | 引擎不认，**0% 提升** |
| 4 | context 太长挤占显存 | `--context 8k` | 显存专家 2807→2812（仅 +5），prefill 无差异 |

**关键证据（第 4 条）**：32K→8K 只腾出 5 个专家槽，说明 KV cache 本来只占极小一块显存。
WDDM 的显存压力不是由上下文造成的，而是"257 GB 模型只有 24.5 GB 能进显存"这个结构性事实。

### 5.1 实测调优表 vs 源码预置表

| 形状 | 预置 solution_id | 实测 solution_id |
|---|---|---|
| `bf16 10240 2560 10240 8192` | 110428 | **110434** |
| `bf16 320 10240 320 8192` | 110420 | **110416** |
| `bf16 2560 320 2560 8192` | 110428 | 110428 |

表的内容确实不同，但换用后性能仍在噪声区间——所以不是表的问题，是引擎不消费这张表。

---

## 六、与 Linux 官方栈的对比结论

| 维度 | Windows 自编译 | Linux 官方 `strata-dsv41-0.1.56-linux-x86_64-hip-rx9070` |
|---|---|---|
| 引擎来源 | 自编译（23.1 MB） | 官方签名包（367 MB 含 ROCm） |
| 模型 | 2.00 bpw（132 GB 专家） | 2.25 bpw（149 GB 专家） |
| 启动 | 52–56 s | 32 s（冷）/ 25.4 s（热） |
| decode 短 | 8.1–8.5 tok/s | 27.1–30.2 tok/s |
| prefill | 51 tok/s @ 1.7K | 433 tok/s @ 8.7K |
| 并发 | 串行 | `--parallel 2` 可 +58% |
| 显存预算 | 被限 `31767/32624 MiB` | 无此限制 |

**差距归因（按可能性排序）**：

1. **WDDM 的 GPU 内存管理**——Windows 显示驱动模型把显存预算卡在 31767 MiB，专家页在系统内存与显存之间搬运，
   Linux 的 GTT/VRAM 直通没有这一层。这是**无法通过配置绕过**的。
2. **自编译 vs 官方构建的编译期差异**——官方包 24.6 MB / 本地 23.1 MB，可能带额外内核特化、LTO 或调优；这一条尚可继续查。
3. **模型不同**——2.00 bpw 更小（本该更快），却更慢，说明差异不在模型，而在软件栈。

---

## 七、最终建议

1. **Windows 这条路定位为"可行性验证"，不作为性能基准**，也不用于容量规划。
2. **要可用的 DeepSeek 服务，回到 Linux 那台机器**（有官方 `rx9070` 包，prefill 快 8 倍，支持并发）。
3. 若官方将来发布 `windows-x86_64-hip-rx9070` 的 `dsv41` 包，可直接 `--dsv41-package` 安装，无需自编译；
   届时 Windows 侧值得重测一次，看性能是否接近 Linux。
4. Windows 侧若必须使用，限制在：短对话（≤300 tokens 上下文，8 tok/s 可用）、单用户、不接受并发排队。
5. 长上下文（>600 tokens 累积）decode 掉到 1.6 tok/s 甚至 0.56 tok/s，**不可用**。

---

## 附：关键产物路径

| 产物 | 路径 |
|---|---|
| 自编译引擎 | `F:\Temp\build-dsv41\strata-dsv41.exe`（+ ROCm DLL、`BUILD.json`、`rocblas\library`、`hipblaslt\library`） |
| 配置脚本 | `F:\Temp\build-dsv41.bat`、`F:\Temp\compile-dsv41.bat`、`F:\Temp\compile-tune.bat` |
| 实测调优表 | `F:\Temp\tuning-generated.txt`、`F:\Temp\build-dsv41\tuning\gfx1201-hipblaslt-100500.txt` |
| 完整原始报告 | `F:\Temp\deepseek-v4.1-flash-Q2-test-report.md` |
| 引擎日志 | `C:\Users\Administrator\AppData\Local\Strata\launch\ist-das-2-00bpw-32k.engine.log` |
| 模型（分片） | `E:\Strata\Models\models\deepseek-v4.1-flash-IST-DAS-2.00bpw\` |
| 模型（共享） | `E:\Strata\Models\models\deepseek-v4.1-flash-shared\`（Engram 110.6 GB 等） |
