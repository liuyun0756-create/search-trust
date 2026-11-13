# P1-01 第二次冒烟缺陷：本地修复与取证

状态：A 已复现并完成本地修复；B 已用负责人提供的231个Redis key完成真实离线恢复、定位和本地修复。以下早期“待补输入”段保留取证过程，最终结论以末尾为准。未提交、push、部署或执行生产迁移。开关由负责人决定，本轮未读取后修改任何开关；没有采集、扣费或冒烟。

## A：40001 导致 PostgREST 无界重试

### 复现证据

使用独立 Docker network、PostgreSQL 17.6（1 CPU / 768 MB）和现有 PostgREST 14.5 镜像，加载仓库完整迁移链、合成用户/Case和 planning revision=2，以旧 revision=1 调用真实 `start_v22_prospect_discovery_with_keywords`。没有使用生产账号、余额或来源数据。原函数保持不变，只在本地 PostgREST pre-request 中用非事务序列统计执行次数，附加5ms限速；序列计数不会随异常回滚。

实际命令：`python3 scripts/test-v22-keyword-postgrest.py`。

```text
baseline_http_requests = 1
baseline_attempts = 196
baseline_attempts_after_client_disconnect = 236
patched_http_status = 400
patched_error.code = P0001
patched_error.message = PLANNING_SETTINGS_CONFLICT
patched_attempts = 1
frontend_handler_status = 409
handler_rpc_attempts = 1
local balance = 3; charges = 0; ledger = 0; discovery tasks = 0
provider_calls = 0; production_calls = 0
```

基准只发1次HTTP请求，1.2s后客户端超时，再观察0.2s计数继续增加；随后销毁该本地PostgREST容器终止循环。修复后同一真实RPC立即返回，前端真实repository/handler映射为409，未调用submitDiscovery。PostgREST自身的默认P0001映射是HTTP 400，产品API映射才是409，不能混淆两层。脚本最后清理所有测试容器和网络。

独立最小探针也复现1次请求执行202次、客户端超时后243次，作为交叉证据。两者均未向生产发送测试RPC。[Supabase官方说明](https://supabase.com/kb/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b)解释了PostgREST 14的该行为及P0001规避方式。本文实测版本是14.5，不冒称已核对生产PostgREST精确版本。

### 修复范围与diff

新增 `supabase/migrations/20261113100000_stop_keyword_conflict_retries.sql`，只替换目标函数的这一片段：

```diff
-raise exception 'PLANNING_SETTINGS_CONFLICT' using errcode='40001'
+raise exception 'PLANNING_SETTINGS_CONFLICT'
```

以生产只读导出的定义为基准：prosrc MD5 `4888849736c04473d5277757a0794dcd`，完整定义 MD5 `8e5f39ef6284fdd5406a1b6d29b559a5`。迁移检查两项哈希、目标必须且只能出现一次，再以pg_get_functiondef + replace执行；不符即raise。不改reservation/debit、函数ACL或其它业务条件。回滚依据为本轮私有导出的 `start-keywords-before.sql`。未在生产执行。

真实全迁移链测试对照所有public函数定义/ACL，确认只改变该函数，且其余函数完全不变。前端产品代码无需修改，repository原本就按message中的PLANNING_SETTINGS_CONFLICT分类。

### 40001风险清单

生产只读查询确认303个public函数，其中43个prosrc含40001；38个service_role直接RPC、4个私有helper经安全定义者RPC间接可达、1个通过job_cost_summaries触发器可达。逐项条件、错误名、调用路径与判断见 [43项清单](P1-01-40001-risk-2026-11-13.md)。原始定义/ACL保存在私有目录，摘要在output；未运行这43项生产RPC。

不能把所有自定义40001都判成同一种永久冲突：部分函数同时包含固定输入冲突和可随外部状态改变的busy/竞态分支，legacy financial bridge的连接锁序检查可能在新事务中恢复。清单已分别标明，本轮其它42函数均未修改。迁移也不会终止已进入旧函数的会话；本轮未终止任何生产连接，负责人提供的Claude紧急处置不冒称为本轮操作。

## B：V22_CAPABILITY_INPUT_INVALID

### 已实际取得的证据

只读导出任务 `19367a12-c123-4837-930a-f0d49b6ac5a8` 的analysis_jobs、capability_acquisition_preparations及关联business scope，原始内容保存到工作区根目录 `.release-private/p1-01-smoke-defects-20261113/`（目录700、文件600），不提交。

- job状态failed / error_code=V22_CAPABILITY_INPUT_INVALID / run_generation=1。
- preparation存在；analysis_input_manifests为0行、关联capability_generation_recipes也为0行。故不存在可直接拿来generation_recipe重放的完整冻结manifest/request。
- 实际服务是Tour operator，市场为US / HI / Keaau，不能将“非US”当作本样本事实。
- 该任务已有台账为Firecrawl attempts=3、failures=3、successes=0；这是历史调用，不是本轮新增调用。
- preparation仅保存最初analyze_request及discovery/keyword绑定，不含site/serp/competitor/public_gbp/rendered的完整已采集payload。没有伪造这些来源或修改checksum来凑成输入。

Redis的Worker连接为内网，两个Redis服务均无已配置TCP proxy或REDIS_PUBLIC_URL。本轮只读远程checkpoint导出未成功（SSH等待超时；后续最小连接检查也未完成并停止），没有为取证开放网络、添加key、修改服务配置或重新采集。已向负责人询问Claude保存的本任务完整输入/checkpoint本地路径。**在取得这些内容之前，尚不能确定prepare里是哪一种异常，也不能声称已完成B的根因修复或真实形状回归。**

原始job-evidence.json SHA-256：`4f89ff793c319e4b3c2f03ba6ca4ae1d473142a70dd086379a508fb2acd6eb10`。脱离敏感内容的形状记录在output/p1-01/smoke-defects-20261113/job-shape-and-blocker.json。

### 可独立完成的安全诊断

`app/jobs_v22/capability_input_repository.py` 的prepare异常分支在保持原DeterministicJobError错误码、user_message及from None行为不变的前提下，记录：

```text
error_code=V22_CAPABILITY_INPUT_INVALID
exception_type=<异常类名>
exception_location=<最后一个app模块:函数名:行号>
job_id_suffix=<后8位>
```

这些日志由Worker进程的repository logger输出，同时提供结构化extra字段。不记录异常message、完整traceback、locals、payload、完整job ID、URL、姓名、电话或令牌；不记录新的客户limitations。当前任务发生在旧代码上，新增日志不能反向恢复其已被吞掉的异常。

新增7项诊断测试覆盖5种捕获异常、真实generation validation中的最内层app位置、错误manifest不会使诊断遮蔽原错误；敏感异常内容不进入日志，且异常发生时RPC未调用。这些测试验证日志边界，不替代缺失的真实任务回归。

## 实际验证

| 命令 | 结果 |
|---|---|
| `python3 scripts/test-v22-keyword-postgrest.py` | 完整迁移链+真实PostgREST复现与修复验证通过；所调用Vitest文件5 passed、0 skipped。 |
| `npx vitest run src/lib/database/v22KeywordConflict.test.ts --maxWorkers=1` | 4 passed；仅需要隔离Docker URL的真实HTTP项明确skip，随后已由上行实际执行通过。 |
| `npm test -- --maxWorkers=4` | 2767 passed / 11 skipped；新增skip为上行Docker HTTP集成，已有10项skip不变。 |
| `npm run typecheck` | 退出0。 |
| `npm run contracts:check` | 退出0，无合约生成漂移。 |
| `.venv/bin/python -m pytest -q tests/test_v22_capability_input_diagnostics.py tests/test_v22_capability_input_repository.py tests/test_v22_capability_inputs.py --disable-socket --allow-unix-socket` | 28 passed。 |
| `.venv/bin/python scripts/run_v22_backend_quality.py fast` | 4289 passed / 265 deselected，389.84s，退出0。 |

## 早期阻断记录（现已补齐，见末尾）

B需要执行freeze之前的完整manifest和PublicFindingsInput，或本任务Redis collection/rendered checkpoints及确认的shared-market/discovery缓存，才能离线重建并找出真实ValueError/TypeError/AttributeError。仅有preparation中的初始请求不足。所有后续重放须保持provider mock/网络禁用，不新增调用。本轮不开开关，不启动收费流程。

本轮开工时已有的24份未提交/未跟踪文档均逐份重算SHA-256，与开工快照完全一致；PLAN、旧P1-01/release记录、superpowers验收记录均未改动。新增改动只包括本轮SQL迁移、测试/本地集成脚本、上述安全日志及两份交付/风险说明。尚未提交或上线，B仍是待补输入状态。

## B 补充：负责人提供229个key后的离线恢复

负责人提供工作区根目录 `.release-private/2026-11-13-job-19367a12/redis-keys.json`，195691753 B；实际核对SHA-256为 `307e00abc226340c8e19585b748844ae81515fdec525569f5519eb72ca956dbb`，与提供值一致。未复制到仓库或output。所有回放脚本、派生输入、完整异常及堆栈均只写入该私有目录（目录700、派生文件600），原文件回放前后哈希不变。

实际执行 `.venv/bin/python ../.release-private/2026-11-13-job-19367a12/replay_preparation.py`：将229个原始key/value载入本地fakeredis，使用原preparation receipt、请求和任务时间，在原deadline内的历史时点恢复真实CapabilityAcquisitionPreparer。网络socket禁用，所有provider delegate均设置为调用即失败；缺失checkpoint的run_once不会执行operation；begin RPC仅从已导出的原receipt内存返回，不连接数据库。

恢复在真实RedisDiscoveryVerifier处停止：`DiscoverySelectionError / COMPETITOR_DISCOVERY_NOT_FOUND`，provider_calls=0。该次停止是输入缺口，**不是原任务V22_CAPABILITY_INPUT_INVALID的根因**，尚未到generation_recipe，不能将它冒称为捕获的原异常。

导出文件没有以下两条独立缓存（不在job checkpoint命名空间）：

```text
searchtrust:v22:production:competitor-discovery:job:5afb75af-4b8c-44b5-ad01-051c814bba48:state
searchtrust:v22:production:competitor-market:snapshot:d347dc93-7482-5576-9fef-dfd47978c630
```

已向负责人请求只读补导出其原值；过期则须明确记录，不能重新采集或编造。未绕过发现校验，未伪造市场快照、时间或checksum。当前回放完整堆栈保存为私有目录 `offline-replay-full-traceback.txt`；其所记录的是本次缺缓存停止，不能当作原始失败堆栈。

另外独立执行 `inspect_saved_stages.py` 校验已有的site/GBP阶段，不绕过完整回放的阻断。按真实阶段代码生成checkpoint_key，再由JobRedisKeys计算SHA-256命中保存值，两个阶段均成功恢复、provider_calls=0。客户site为site_inventory_snapshot_v3，46个页面、46个深度分析（请求上限50）；canonical为69208639 B，其中deep HTML 65791326 B。GBP为customer_public_gbp_snapshot_v2。结果及完整key映射仅保存于私有 `independent-stage-inspection.json`。

站点快照本身已超过repository的20MB总输入上限，是明确的容量线索；仍需完整输入继续跑到真实generation_recipe/prepare分支，确认最先发生的异常。未据此先改限制或清理采集数据，B根因修复仍未完成。

## B 最终定位：补齐两个独立缓存后

已将负责人补充的 `extra-keys.json` 内两个原始value与原229个key一起装入fakeredis，共231个key；实际SHA-256为 `e32ae1eef2bf0b7c3a7d390ee557472690bc9b3159557ba4ce71cfd2a517dbae`。与原文件均保持原值、原时间，在原任务deadline内的历史时点恢复，未重写时间以绕过过期或身份校验。两份导出和全部重放产物始终只位于工作区根目录 `.release-private/2026-11-13-job-19367a12/`，不复制到仓库或output。现无缺失key。

真实路径为：原preparation receipt/request → RedisDiscoveryVerifier → ProspectV22Executor真实checkpoint阶段 → build_acquisition_input → prepare_keyword_input → generation_recipe → repository.prepare。网络socket禁用；provider方法调用即失败；缺失checkpoint禁止执行其operation。begin仅由本地MockTransport返回已导出的原receipt，不调用生产RPC。

### 原始异常及字段

`generation_recipe` **成功**；随后的repository总量检查失败，不是它本身解析失败。`run_generation=1`合法；触发条件是 `len(canonical)>20_000_000`，字段对应整个 `p_generation_canonical`：

```text
Traceback (most recent call last):
  File ".../app/jobs_v22/capability_input_repository.py", line 73, in prepare
    raise ValueError("Invalid generation")
ValueError: Invalid generation
```

完整原始堆栈、外层调用栈、恢复的manifest/request仅保存在私有目录 `original-exception-full.txt`、`offline-replay-full-traceback.txt`、`recovered-manifest.json`、`recovered-request.json`。上述原始异常在本地已实际打印；新安全日志只输出异常类型/代码位置和job后8位，绝不把完整异常内容或客户payload写入Worker日志。

| canonical | 原始字节数 | 修复后字节数 |
|---|---:|---:|
| generation全体 | 72,358,116 | 12,870,881 |
| site | 69,208,639 | 9,721,404 |
| serp | 106,753 | 106,753 |
| competitor | 2,928,292 | 2,928,292 |
| public_gbp | 1,965 | 1,965 |

site为46个结构页/46个deep页面，HTML合计65,791,326B，请求deep上限50。实际业务/市场为Tour operator / US / HI / Keaau；“非US”不是该样本事实。历史Firecrawl为3次失败；本次新增provider调用0。SQL同样限制generation canonical为20MB，故没有单独提高Python上限或修改SQL来绕过约束。

### 修复方法及边界

沿用PLAN P0-10已确认的HTML总量超限规则（按页面顺序、剩余页面not_checked/resource_limit）：只在新准备的完整generation超过现有20MB时，对派生site输入应用既有 `site_business_limits.max_html_bytes_total=10_000_000`。保留结构观察和真实fetch历史，按 `site.pages` 顺序保留完整HTML前缀；不截断HTML、不越过第一个超限页面挑选后续小页面。未纳入的deep内容在新派生输入中移除并标 `resource_limit`，字段检查明确为not_checked，不能变成缺失结论。

- 新增 `acquisition_input_budget.py`；准备器在渲染checkpoint/采集之前应用预算，再按原流程生成绑定、canonical、checksum。渲染由接纳后的静态输入绑定，避免它引用另一份静态checksum。
- 未超过20MB的输入不改；历史v1来源不改；保留页面原HTML（包括首尾空白）、校验和、时间戳均不改。所有已保存checkpoint/frozen文件均不写入。
- `site_business_facts.py`只补识别本次派生的resource_limit标记，使用已有not_checked路径；不改规则触发条件、排序、优先级或缺失语义。
- repository仍维持20MB上限、原对外错误码和文案，只补安全诊断；未改freeze内部逻辑/SQL。
- 这是客户HTML超量的保守降级，不保证任意来源体积都能通过。若竞品/其它来源或后续rendered数据仍令总输入超过20MB，原校验仍会明确失败，本次没有静默丢弃这些来源。

### 同一真实数据修复后重放

实际命令（在SearchTrust-RD）：

```text
ST_PRIVATE_REPLAY_PHASE=after-fix .venv/bin/python ../.release-private/2026-11-13-job-19367a12/replay_preparation.py ../.release-private/2026-11-13-job-19367a12/extra-keys.json
```

```text
loaded_keys=231; checkpoint_hits=3; provider_calls=0
stage=prepared_offline
generation_canonical_bytes=12870881; recipe_bytes=6106
retained_deep_pages=6; omitted_deep_pages=40; checksums_valid=true
```

真实repository已完成generation_recipe、序列化、manifest/generation/source校验和检查；MockTransport在prepare RPC边界主动以ReachedPrepareBoundary停止，**没有宣称本轮调用了真实数据库freeze或写入生产**。这条主动停止与原始ValueError明确区分。仍无额外key缺口。

进一步用 `SearchTrust-RD/.venv/bin/python .release-private/2026-11-13-job-19367a12/verify_after_fix.py` 在工作区根目录实际验证：

```text
other_three_sources_byte_identical=true
structural_pages_byte_identical=true; fetch_attempts_byte_identical=true
retained_deep_byte_identical=6
omitted_pages_not_checked_resource_limit=40
identity_and_context_unchanged=true
report_generated=true; ruleset=v22_capability_public_v14
findings=7; actions=0; action_state=insufficient_basis; provider_calls=0
```

报告生成也已离线成功；完整报告仅存私有目录，不批准、不分享、不导出PDF。这是该Tour operator样本的实际输出，不是All Star冒烟。

### 新增测试与最终验证

`tests/test_v22_acquisition_input_budget.py` 6项覆盖：原fetch/结构不变及未检查语义；UTF-8字节预算和no-op；历史v1不改；保留HTML空白与checksum不变；确定的页面顺序与前缀耗尽；46页Tour operator/Keaau/3次Firecrawl失败的合成真实形状从准备器跑到真实repository，修复前总量拒绝、修复后成功且provider禁用。没有将客户快照放进测试夹具。

| 最终命令 | 实际结果 |
|---|---|
| `.venv/bin/python -m pytest -q tests/test_v22_acquisition_input_budget.py --disable-socket --allow-unix-socket --tb=short` | 6 passed（2.93s）。 |
| `.venv/bin/python -m pytest -q tests/test_v22_acquisition_input_budget.py tests/test_v22_capability_acquisition_preparation.py tests/test_v22_capability_input_diagnostics.py tests/test_v22_capability_input_repository.py tests/test_p0_10_resources.py --disable-socket --allow-unix-socket --tb=short` | 80 passed（15.02s）。 |
| `.venv/bin/python scripts/check_v22_report_goldens.py` | 退出0；3份完整报告golden逐字节一致。 |
| `.venv/bin/python scripts/replay_p1_01_keywords.py --output-dir ../search-trust/output/p1-01/smoke-defects-20261113/history-after-fix --compare-history ../search-trust/output/p1-01/historical-before/historical-digests.json` | 6站重放成功；v12/v13与基准一致；73份来源文件哈希不变；external_calls=0。 |
| `.venv/bin/python scripts/run_v22_backend_quality.py fast`（最终） | **4295 passed / 265 deselected，403.51s，退出0**；新增6项预算测试与7项诊断测试均实际执行。 |

A相关前端全量/类型检查/合约检查/真实PostgREST结果见上表，此后没有修改前端产品代码或A测试/迁移。两边均尚未提交、push、部署；生产函数/数据/开关均未修改，没有采集、扣费、冒烟。原始私有导出不提交。

最终核对：开工时24份既有未提交/未跟踪文档SHA-256仍一致；原始229-key与extra-key导出SHA-256均与负责人提供值一致。私有目录700、文件600。新增测试仅使用合成数据；未将客户采集数据加入仓库。

## 2026-11-13 审阅通过与发布授权

负责人确认Claude已审阅A/B diff和迁移，授权按上次发布流程上线。发布前必须只读确认生产 `start_v22_prospect_discovery_with_keywords` 的prosrc MD5为 `4888849736c04473d5277757a0794dcd`、完整定义MD5为 `8e5f39ef6284fdd5406a1b6d29b559a5`；不匹配则停止，不执行迁移。继续保持开关原状，不采集、扣费或冒烟。

### 下一轮跟进（本轮不实施）

1. `bound_customer_html` 应明确保留首页和选定服务页，而非依赖 `site.pages` 顺序。
2. 裁剪后及渲染后均重新计算canonical体积；若仍超过 `MAX_GENERATION_CANONICAL_BYTES`，返回专用错误码（如 `V22_CAPABILITY_INPUT_TOO_LARGE`），不再落到通用INPUT_INVALID。

本轮不改这两项实现或为其新增测试，避免扩大已审阅发布范围。发布过程证据与最终状态在本节后追加。

### 发布前只读基准确认

生产项目 `cmdsbsvcxesnrrealftb`，检查时间 `2026-11-13 10:40:24.004709+00`，实际 `md5(prosrc)=4888849736c04473d5277757a0794dcd`、`md5(pg_get_functiondef)=8e5f39ef6284fdd5406a1b6d29b559a5`，与负责人指定值均一致；ACL为 `{postgres=X/postgres,service_role=X/postgres}`。通过 `supabase db query --linked` 只读取得，不调用业务函数。

函数回滚原文保存于工作区根目录 `.release-private/2026-11-13-ab-release/start_v22_prospect_discovery_with_keywords-before.sql`，3005 B，SHA-256=`db3d161c2df676d021a3955b73bddb303005fd948b1fcd53d98cde9c43cb808c`。本轮备份和上线证据均存此私有目录，不提交。
