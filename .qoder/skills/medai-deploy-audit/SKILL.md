---
name: medai-deploy-audit
description: MedAI 前后端与执行服务器 deploy 目录"部署包版本"与 doc/部署清单 的对账体检。判定五医院（cdwyy）、盐亭（yanting）、测试服（testserver）三端部署包是否最新，输出需要部署的服务器、SQL 脚本、配置文件清单与现场核实点；核对后询问是否运行构建 bat（build-and-export.bat / build-and-package.bat）重建部署包，用户确认才执行并回读校验版本与 dist hash。触发词：检查部署包、deploy 目录版本、五医院部署文件、部署清单对比、这次上线要部署什么、三端版本对账、部署包是不是最新、重新构建部署包、构建 bat、重建 tar、重建前端包。
---

# MedAI 部署包 × 部署清单 对账

> **只读体检**：本 skill 只做核对与产出清单，不构建、不部署、不连生产、不写文件
> （用户明确要求生成上线单时才转 `deploy-order-doc`）。
> 五医院内网隔离、本机/测试服均不可直连，所有结论以仓库产物 + 清单为准，必须标出"现场核实项"。

## 加载即执行

1. 确认工作区根：`pwd`（预期 `D:\MedAiAssistant 1.0 BS`）。
2. 读 `doc/部署清单.md`（用 read 工具，禁止 `Get-Content`）。
3. 按 §1 流程逐端核对，按 §2 格式输出四段结论。
4. 结论输出后按 **Step 7** 询问是否运行构建 bat 重建部署包（默认不构建，用户选择"是"才执行，并回读校验）。
5. 用户未指定医院时默认 `cdwyy`（五医院）；提到盐亭用 `yanting`、测试服 `testserver`。

## 0. 参数

| 参数 | 取值 | 含义 |
|---|---|---|
| `hospital` | `cdwyy`（默认）/ `yanting` / `testserver` | 目标医院；决定 deploy 子目录 |
| `env` | 生产 / 测试服 | 决定"已部署"判据 |

医院 → deploy 目录映射：

| 端 | cdwyy（五医院生产） | yanting（盐亭） | testserver（测试服） |
|---|---|---|---|
| 主服务器 | `med_ai_assistant_1.0_bs_backend/deploy/main-linux-oracle/` | `.../main-linux-oracle-yanting/` | `.../main-linux-testServer/` |
| 执行服务器 | `med_ai_assistant_1.0_bs_backend/deploy/execution-linux/`（+ `execution-linux.zip`） | `.../execution-linux-yanting/` | `.../execution-linux-test/` |
| 前端 | `med_ai_assistant_1.0_bs_vue/deploy/med_ai_assistant_1.0_bs_vue.zip` + `.../med_ai_assistant_1.0_bs_vue/` | `.../med_ai_assistant_1.0_bs_vue-yanting/` | `.../med_ai_assistant_1.0_bs_vue_test/` |
| 配置文件 | `main-linux-oracle/config/application.properties` | 同结构 | `main-linux-testServer/config/application.properties` |

五医院环境事实：主服务器 `10.120.11.43`（8081）、前端 8080/8443、执行服务器 `10.120.10.251:8082`、主库 `10.120.11.18:1521/orcl`（schema `medai`）、执行库 `172.16.11.43:1521/freepdb1`；内网隔离，人工拷包。

## 1. 流程

### Step 1 取三端最新产物（时间戳）

```powershell
$ROOT='D:\MedAiAssistant 1.0 BS'
Get-ChildItem "$ROOT\med_ai_assistant_1.0_bs_backend\deploy\main-linux-oracle\med-ai-main.tar",
              "$ROOT\med_ai_assistant_1.0_bs_backend\deploy\execution-linux\med-ai-execution.tar",
              "$ROOT\med_ai_assistant_1.0_bs_backend\deploy\execution-linux.zip",
              "$ROOT\med_ai_assistant_1.0_bs_vue\deploy\med_ai_assistant_1.0_bs_vue.zip" |
  Select-Object LastWriteTime, Length, Name
```

**判据：产物时间戳 ≠ 本次改动时间 → 未重新构建**（历史教训：10-18 曾拿 10-17 的旧 tar 当本次包）。

### Step 2 反推包版本（不要信包内 version 文件）

后端：用"构建时间点之前的 HEAD"推断 pom revision：

```powershell
cd "$ROOT\med_ai_assistant_1.0_bs_backend"
$sha = (git log --before='2026-10-25 16:00' -1 --format='%h')
git show "${sha}:pom.xml" | Select-String '<revision>'
```

前端：同理取 package.json 版本，并核对 **dist 入口 hash**（唯一可靠判据）：

```powershell
node -e "const fs=require('fs');
const d='D:/MedAiAssistant 1.0 BS/med_ai_assistant_1.0_bs_vue';
const read=p=>[...new Set((fs.readFileSync(p,'utf8').match(/app\.[a-z0-9]+\.js/g)||[]))].join(',');
console.log('包内 dist:', read(d+'/deploy/med_ai_assistant_1.0_bs_vue/dist/index.html'));
console.log('工作区 dist:', read(d+'/dist/index.html'));
console.log('包内 package.json:', JSON.parse(fs.readFileSync(d+'/deploy/med_ai_assistant_1.0_bs_vue/package.json','utf8')).version);"
```

**判据：`包内 dist hash` == `工作区 dist hash` 才算最新；package.json 版本可能已被提前 bump（2026-11-01 实例：包内 0.9.302、dist 仍 0.9.301）。**

### Step 3 读部署清单（倒序，最新在上）

用 **read 工具**读 `doc/部署清单.md`（禁止 `Get-Content`，中文会乱码），按条目提取：
日期 / 涉及端（前端·主服务器·执行服务器·AiMed 前后端）/ SQL / 配置文件 / 部署状态。

**判据：**
- 状态只写"已部署"且备注是"测试服务器" → **生产（五医院/盐亭）不算已部署**。
- 清单条目时间 > 包构建时间 → 该条目未进包。

### Step 4 定量确认"包之后改了什么"

```powershell
cd "$ROOT\med_ai_assistant_1.0_bs_backend"
git log --since=2026-10-24 --date=format:'%m-%d %H:%M' --pretty='%h %ad %s'   # 看清单外的漏登条目
git diff <包对应HEAD> HEAD --name-only                                        # 与包版本的差异
```

判执行服务器是否需要重建：

```powershell
git diff <包对应HEAD> HEAD --name-only | Where-Object { $_ -match 'execution|Execution|template|Template|GitProvider|llm|Llm' }
```

**判据：只出现 `prompt-templates/*` → 执行服镜像不必重建，只需模板同步；出现 Java 类 → 必须重建。**

### Step 5 SQL 判定

```powershell
Get-ChildItem "$ROOT\med_ai_assistant_1.0_bs_backend\sql-scripts" -File | Sort-Object LastWriteTime -Descending | Select-Object -First 15 LastWriteTime, Name
Get-ChildItem "$ROOT\med_ai_assistant_1.0_bs_backend\src\main\resources\db\migration\oracle" | Select-Object Name
```

判据速查：

| 脚本 | 五医院是否需要 | 依据 |
|---|---|---|
| `sql-scripts/create-diagnosis-item-state-table.sql` | 缺则必做（表+序列+唯一索引） | 10-25 体检 0/0/0；缺则疑诊处置 ORA-00942 |
| `db/migration/oracle/V0_9_192/193（+194）` | 先体检，缺则建 | 11-02 后 `FlowDelayTaskRegistry.restoreScheduled()` 仍在启动读 `FLOW_DELAY_TASK`（无 try/catch） |
| `sql-scripts/flow-instance-cancel-before-upgrade.sql` | **不适用** | 未部署过 v8、无 FLOW_INSTANCE 存量；11-02 后不依赖状态机 |
| `sql-scripts/add-promptresult-promptid-index.sql` | 不需要 | 2026-10-25 体检索引已存在 |
| `sql-scripts/accounts-*.sql` / `tr_demo_init.sql` | 不需要 | 测试数据 |

补充：`db/migration/*` 不随启动执行（`ddl-auto=none` + Flyway 关闭）→ 必须手工执行；脚本不是幂等写法时先体检 `user_tables` / `user_sequences`。

### Step 6 配置判定

```powershell
# 1) 主服外部配置 vs 源码默认值
Select-String -Path "$ROOT\med_ai_assistant_1.0_bs_backend\deploy\main-linux-oracle\config\application.properties" -Pattern 'medai\.flow'
Select-String -Path "$ROOT\med_ai_assistant_1.0_bs_backend\src\main\resources\application.properties" -Pattern 'medai\.flow'

# 2) 前端生产环境变量（是否被包收录：看包内 .env.production 时间 vs zip 时间）
# 3) 模板库版本
node -e "console.log(JSON.parse(require('fs').readFileSync('D:/MedAiAssistant 1.0 BS/med_ai_assistant_1.0_bs_backend/prompt-templates/manifest.json','utf8')).version)"
```

判据：
- 源码里 `@Value("${medai.flow.xxx:默认值}")` → 外部配置缺省不阻塞，登记为"可选"；无默认值 → 必改。
- 外部 `config/application.properties` 会覆盖 jar 内同名键；**已有键必须按目标环境值合并，不可整文件覆盖**。
- 前端 `.env.production` 改了但 zip 生成时间早于改动 → 新包才生效（例：`VUE_APP_DSH_ASSISTANT_ENABLED=false` 未进 0.9.301 包）。
- `prompt-templates/manifest.json` 版本不递增 → 同步按"版本一致"静默跳过（2026-11-01 已踩坑）。

### Step 7 构建（必须经用户确认，默认不做）

核对与四段结论输出完毕后，**先用 `ask_user_question` 询问**，不要擅自构建：

> 问题：三端部署包落后于仓库，是否现在运行构建脚本重建？
> 选项（推荐项放第一，按 Step 2/4 的判定动态生成）：
> - **全部重建（后端主服 + 执行服 + 前端）** —— 三端都落后时推荐
> - **只重建后端（主服 + 执行服）** —— 仅后端有改动
> - **只重建前端** —— 仅前端有改动
> - **不构建，只保留清单**（默认）

用户选"是"后按端执行（**全部在 PowerShell 中 `cmd /c` 调用，bat 含 `pause` 必须喂 stdin，否则永久挂起**）：

**① 主服务器（用非交互三步，不要调菜单脚本）**

```powershell
cd "$ROOT\med_ai_assistant_1.0_bs_backend"
mvn package -DskipTests
if ($LASTEXITCODE -ne 0) { throw "JAR 构建失败" }
docker build --build-arg APP_VERSION=0.9.302 -t med-ai-main:latest -f Dockerfile .
if ($LASTEXITCODE -ne 0) { throw "主服镜像构建失败" }
docker save -o deploy/main-linux-oracle/med-ai-main.tar med-ai-main:latest
# 产出：deploy\main-linux-oracle\med-ai-main.tar
```

- **`build-and-export.bat` 是 `set /p` 交互菜单，后台/管道执行读不到输入 → 死循环刷 `[ERROR] Invalid option`（2026-11-02 实测）**。需要人工前台运行时才用，且只能选 2（选项 1/3 会 `taskkill` 占用 8081 的进程）。
- `--build-arg APP_VERSION` **必须显式传**（主服 Dockerfile 默认 `0.9.281`）；版本取 `pom.xml <revision>`。
- 用 `mvn package` 而非 `-Pexecution`：主服走默认 `main` profile。

**② 执行服务器（不要用 `build-and-export-execution.bat`：它漏了 `-Pexecution`）**

```powershell
cd "$ROOT\med_ai_assistant_1.0_bs_backend"
mvn package -Pexecution -DskipTests
if ($LASTEXITCODE -ne 0) { throw "JAR 构建失败" }
docker build -t med-ai-execution:latest -f deploy/execution-linux/Dockerfile.execution.linux .
if ($LASTEXITCODE -ne 0) { throw "执行服镜像构建失败" }
docker save -o deploy/execution-linux/med-ai-execution.tar med-ai-execution:latest
# 产出：deploy\execution-linux\med-ai-execution.tar
```

**③ 前端（会重建 dist + 镜像 + zip）**

```powershell
cd "$ROOT\med_ai_assistant_1.0_bs_vue"
cmd /c "echo.|build-and-package.bat"
# 产出：dist\、deploy\med_ai_assistant_1.0_bs_vue\（含 medai-images.tar）、deploy\med_ai_assistant_1.0_bs_vue.zip
```

构建前检查（缺一即停）：

```powershell
docker --version; mvn -v; node -v; npm -v          # 工具链
git -C "$ROOT\med_ai_assistant_1.0_bs_backend" status --short   # 源码应干净，避免把调试改动打进包
```

构建前建议备份旧产物（覆盖前留回滚点）：

```powershell
$ts = Get-Date -Format 'yyyyMMdd-HHmm'
$bak = "$ROOT\deploy-backup-$ts"; New-Item -ItemType Directory -Force $bak | Out-Null
Copy-Item "$ROOT\med_ai_assistant_1.0_bs_backend\deploy\main-linux-oracle\med-ai-main.tar" $bak -ErrorAction SilentlyContinue
Copy-Item "$ROOT\med_ai_assistant_1.0_bs_backend\deploy\execution-linux\med-ai-execution.tar" $bak -ErrorAction SilentlyContinue
Copy-Item "$ROOT\med_ai_assistant_1.0_bs_vue\deploy\med_ai_assistant_1.0_bs_vue.zip" $bak -ErrorAction SilentlyContinue
```

**构建后强制校验（不回读就宣布成功）**

```powershell
# 后端版本：必须等于 pom <revision>（当前 0.9.302），否则说明 APP_VERSION 没传进去
# 必须 --entrypoint cat：镜像默认 entrypoint 会去连生产 Oracle 并挂住（2026-11-02 实测）
docker run --rm --entrypoint cat med-ai-main:latest /app/version.txt
docker inspect --format '{{.Config.Labels.version}}' med-ai-main:latest

# 执行服（无 version.txt，用 LABEL/构建时间判断）
docker inspect --format '{{.Created}} {{index .Config.Labels "version"}}' med-ai-execution:latest

# 前端：包内 dist 入口 hash 必须等于工作区最新 dist
node -e "const fs=require('fs');const d='D:/MedAiAssistant 1.0 BS/med_ai_assistant_1.0_bs_vue';
const r=p=>[...new Set((fs.readFileSync(p,'utf8').match(/app\.[a-z0-9]+\.js/g)||[]))].join(',');
console.log('包内:',r(d+'/deploy/med_ai_assistant_1.0_bs_vue/dist/index.html'));
console.log('工作区:',r(d+'/dist/index.html'));"
docker run --rm --entrypoint sh med-ai-assistant-frontend:latest -c 'grep -o "app\.[a-z0-9]*\.js" /usr/share/nginx/html/index.html'

# 产物时间戳/大小（tar 约 237MB，zip 约 42MB）
Get-ChildItem "$ROOT\med_ai_assistant_1.0_bs_backend\deploy\main-linux-oracle\med-ai-main.tar",
              "$ROOT\med_ai_assistant_1.0_bs_backend\deploy\execution-linux\med-ai-execution.tar",
              "$ROOT\med_ai_assistant_1.0_bs_vue\deploy\med_ai_assistant_1.0_bs_vue.zip" |
  Select-Object LastWriteTime, Length, Name
```

**判定：任一校验不符 → 报告失败点并停止，不进入部署、不宣布"包已就绪"。** 校验通过后回到 §2 输出格式，把"版本/HEAD/是否最新"三列更新为构建后的真实值。

## 2. 输出格式（固定四段）

```markdown
## 一、deploy 目录现状
| 端 | 最新文件 | 时间 | 版本/HEAD | 是否最新 |

## 二、与部署清单对比
| 清单条目 | 涉及端 | 五医院是否已具备 |
（列出包时间之后的所有条目 + 清单漏登条目）

## 三、需要部署
### 1）服务器
| 主服务器 / 前端 / 执行服务器 | 必须 / 可不重建 | 版本跨度与内容 |
### 2）SQL 文件
| 脚本 | 是否执行 | 依据 |
### 3）配置文件
| 文件 | 需改项 |

## 四、现场核实与风险
- 三端 version.txt / dist hash
- 表是否存在（DIAGNOSIS_ITEM_STATE / FLOW_DELAY_TASK）
- 前后端 breaking change 是否同版本
```

## 3. 坑清单（必查）

1. **包内版本号漂移**：`deploy/.../package.json` 被 bump 但 `dist` / `medai-images.tar` 未重建 → 只认 dist 入口 hash。
2. **旧包当新包**：只按"目录里有个 tar"判断 → 必须看时间戳 + 反推 HEAD + 核对 hash。
3. **清单"已部署"默认指测试服**：生产需单独对账，不能外推。
4. **清单漏登**：10-29 教学病例聚合、10-30 前端诊断图标两次都未登记 → 用 `git log --since` 兜底。
5. **执行服误判**：模板变更 ≠ 代码变更；只改 `prompt-templates/*` 时不重建镜像，但要 `POST /api/execute/templates/sync` + 主服 `POST /api/ai/templates/sync`。
6. **前后端契约**：11-02 起删 `/flow/cancel`·`/flow/resume`·`/flow/skip-orders`·`/flow/trigger`，`flow-status` 改四步事实推导 → **必须同版本同时上线**。
7. **前端部署脚本**：`deploy-linux.sh` 用目录名当 compose 项目名（`med_ai_assistant_1.0_bs_vue` ≠ 现网 `med_ai_assistant_10_bs_vue`），会 `rm -f` healthy 容器后另起一套；低风险可 `docker cp dist/. med-ai-assistant-frontend:/usr/share/nginx/html/`。
8. **绝不覆盖** `.env.main` / `.env.execution`（Oracle 账号、DeepSeek key、加密盐）。
9. **编码**：文件内容一律用 read / node 处理；`Get-Content` 在 5.1 下按 GBK 解码 UTF-8 会乱码。
10. **安全**：不输出 API key、不下发生产凭据；五医院不可达时明确写"待现场核实"。
11. **`build-prod-both.bat` 不能直接用于主服出包**：它没有 `--build-arg APP_VERSION`，主服 Dockerfile 的 `ARG APP_VERSION=0.9.281` 会让镜像 `version.txt`/LABEL 停在旧版本（10-23、11-01 两次踩过）。主服走 Step 7 ① 的非交互三步并显式传版本。
12. **`build-and-export.bat` 的菜单选项 1/3 会杀 8081 进程**（本机可能正是 dev 实例）→ 构建只选 2，且实际上不要用该菜单（见坑 14）。
13. **`build-and-export-execution.bat` 漏 `-Pexecution`**（仅 `mvn package -DskipTests`，默认激活 main profile）→ 执行服按 Step 7 ② 手工三步构建。
14. **批处理不能靠"喂 stdin"非交互运行**：`build-and-export.bat` 用 `set /p` 读菜单，后台/管道执行时读不到输入 → 无限 `[ERROR] Invalid option`（2026-11-02 实测，只能 kill）。主服改为非交互三步；`build-and-package.bat` 可用 `cmd /c "(echo. & echo.) | ..."`，但**管道方式退出码可能为 1（产物其实正常）**——成功判据必须看产物/镜像校验，不看 exit code。
15. **`docker run --rm <image> cat /app/version.txt` 会挂住**：镜像默认 entrypoint 是启动脚本，`cat` 被当参数忽略 → 实际去连生产 Oracle 并超时（2026-11-02 实测，`--rm` 也没能立刻回收容器）。读版本必须 `--entrypoint cat`；事后 `docker ps -a` 查残留容器并 `docker rm -f`。
16. **前端脚本 docker 不可用时会 `SKIP_DOCKER=1` 继续出包** → 包内没有新镜像，部署后仍是旧前端（2026-10-26 事故同型）。构建前 `docker --version` 失败必须中止。
17. **前端构建依赖网络**：`npm install`（失败分支走 `--force` 重装）、首次 `docker pull nginx:1.25-alpine`；离线机器需预热镜像/缓存。
18. **构建成功 ≠ 包正确**：必须回读 `docker run --rm --entrypoint cat med-ai-main:latest /app/version.txt`（== pom revision）与包内 dist hash；否则会重复"包内 package.json 已 bump、产物仍是旧版"的漂移。

## 4. 边界

- 不 `git push`、不 `git init`；**未经 Step 7 用户确认不运行构建脚本**；构建仅重建本地 deploy 产物，**不部署、不触碰生产**。
- 不连五医院/盐亭生产（网络隔离）；核实项交给现场。
- 需要出上线单时，转 `deploy-order-doc` skill，产物落 `doc/部署说明/部署说明<YYYY-MM-DD>-<HHmm>.md`。
