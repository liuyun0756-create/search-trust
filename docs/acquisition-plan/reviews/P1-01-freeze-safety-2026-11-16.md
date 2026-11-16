# P1-01：freeze 整包保护、断连恢复与离线容量分析

实施已通过负责人审阅，当前已授权按“备份 → 新PR CI → 迁移核对 → 后端合并 → 前端合并及部署”发布；执行进度见第5节。2026-11-16负责人已确认候选9个服务页连同首页全部保留用于测量；补齐两条scope后已完成完整RPC入参重建。不能将“冻结分类没识别服务页”当成“实际没有服务页”。本轮没有采集、扣费、冒烟、改开关、升级数据库或生产测试freeze。

## 1. 实施范围与错误语义

### 1.1 整包上限

新增配置 `V22_CAPABILITY_FREEZE_MAX_INPUT_BYTES`，默认 **40,000,000 B（十进制40 MB）**，必须为正整数；在worker启动时传入准备队列。没有修改任何线上环境变量。

`LeasedPreparationRpc` 对 acquisition 和 first_service 两个 freeze 入口检查实际完整HTTP JSON对象：`{p_lease_token,p_cost_counters,p_input}`。编码与HTTPX相同：UTF-8、非ASCII不转义、紧凑分隔符、禁止NaN；包含canonical文本二次转义，不是generation canonical长度。`input_bytes`日志也改用这个完整口径。

在生产调用路径中，先从Redis获取成本快照并记录本次准备尝试，再做大小检查；超限时，在最终heartbeat、恢复探针、freeze调用之前抛 `DeterministicJobError / V22_CAPABILITY_FREEZE_TOO_LARGE`。之后仍使用既有租约/终止事件路径完成失败和退款。**这里的“不发RPC”是大小保护边界不发freeze/探针；正常任务claim、既有heartbeat及必要退款SQL并未被删除。** 不能为了“零数据库调用”而取消正常退款。

最终heartbeat返回的外壳成本快照再检查一次，确保真正发送的对象仍在上限内。未超限的freeze RPC名称、参数、canonical、checksum与既有业务函数不变。

2026-11-16负责人在Supabase升级Small后，将本地默认值由18MB裁定为40MB。配置项仍可覆盖；Settings默认值和worker未提供ctx覆盖时的fallback常量同步，测试断言两者相同。本次仅修改这两处默认值及对应测试，不改重启恢复/退款逻辑、数据库规格或线上环境变量。原generation canonical的20,000,000 B校验保留；Fresno该项仅16,922,547 B，本次40MB调整解决的是外层完整请求准入。

### 1.2 断连与重启保护

新增仅service_role可执行的只读RPC `inspect_v22_capability_preparation`（迁移20261116100000），返回限定job的状态/revision/progress、manifest是否存在、当前租约是否属于调用者、`pg_postmaster_start_time()`。不返回payload，不加行锁、不续租、不改任何业务数据；未修改freeze函数。生产尚未应用此迁移，未来上线需先应用探针迁移再发布依赖它的后端。

首次发送freeze前，将数据库启动时间写入Redis的独立、NX、带TTL意图记录，按job+generation+kind隔离，不存HTML、URL、业务内容或令牌。Redis写入/回读失败则不发送freeze。意图在断连时保留，新worker恢复时在任何provider阶段之前检查它。

| 核对结果 | 行为 |
|---|---|
| manifest已存在，或任务已终态，或租约不属于本worker | 保留SQL恢复/正式交接路径，不重放freeze，不据此退款。 |
| 未提交、当前租约有效，数据库启动时间与意图不同 | 确定性错误 `V22_CAPABILITY_FREEZE_DATABASE_RESTARTED`，走现有终止/退款路径。只说明数据库重启，不宣称已证明OOM或任务必然是重启原因。 |
| 未提交、启动时间相同 | 保留瞬时错误与既有Retry；必须先完成只读核对，后续新claim仍受SQL行锁/租约保护，不能绕过可能仍在运行的原事务。 |
| 状态探针不可用/响应不可信 | 保留意图，等待状态恢复；不再次发送freeze。恢复后先核对，再决定交接、失败或普通网络重试。 |

即使发生“已提交但响应丢失且数据库随后重启”，manifest优先于重启信号，避免“出了报告又退款”。终止事件失败或数据库不可达时仍依赖既有恢复/期限机制，不能承诺数据库完全不可用时立即退款。

退款继续使用现有 `apply_analysis_job_event` 与事务触发器，revision、generation、lease、已冻结manifest及终态fence均保留。first_service只为这两个新保护错误进入终止路径，其他原有异常分类不变。没有新增退款SQL、手工加点或调度器。

### 1.3 首页、服务页与显式页面保护

预算helper明确预留：首页/root URL、已标记 `service_index/service_detail` 的已选深页，以及现有业务scope的SEO `target_pages`。其它页按selection_score降序、URL确定排序，在剩余预算内按前缀纳入；不再依赖site.pages的偶然顺序。原结构观察、抓取记录、保留HTML/空白/checksum不变；未纳入的页仍为not_checked/resource_limit。

必保页面总量本身超过预算时拒绝准备（同一TOO_LARGE确定性错误），不截断HTML或悄悄删除必保服务页。没有降低线上HTML预算或自动挑选“代表页”，也没有修改页面分类/规则判定/报告文案/冻结证据/digest工具。

## 2. Fresno离线恢复与测量边界

已先阅读负责人提供的 `.release-private/2026-11-16-fresno-jobs/README.md`，实际核对：

| 原始私有文件 | 字节数 | SHA-256 |
|---|---:|---|
| db-rows.json | 23,256 | `0f39ab81c7cb731ec1198e8746121690108661edf1087b6f48d751c2218bdd25` |
| redis-export.json.gz | 38,779,334 | `92fe7dbec4b5555ac41fe44ede2d03d0c7e7580cd30140c27b475f1af543c68b` |
| business-scope-versions.json | 2004 | `f4080205a84d09053c7710aeddfc11baa4b5268bac7086e51cc696e74da996cf` |

537个原始key加载fakeredis；2个base64值按字节解码，其余UTF-8原文保留。以原任务deadline内的历史时点恢复，不改导出值或证据时间。真实ProspectV22Executor及checkpoint阶段读取site/GBP/competitor/shared-market；缺checkpoint即停止，provider方法和新成本claim均拒绝，socket禁用。两任务均恢复成功，未缺key，provider/外部调用=0，SQL调用=0。脚本和所有客户数据只放私有目录，不进仓库/测试夹具。

两任务site canonical均精确为 **12,525,951 B**，与负责人日志相同；16个深页HTML合计 **11,841,935 B**。原worker日志 `input_bytes=36,962,127` 的口径是p_input，而非完整HTTP外壳。

### 2.1 从完整真实形状重建RPC（已补齐数据）

负责人补充的两条`case_business_scope_versions`原记录分别为8f157ee5-1741-4ad5-918b-902668f05fde（revision 1）、8723e6e2-7a91-4b05-9e9c-d9fcc2e21e64（revision 2）。文件SHA-256已核对，模型直接读取scope；未编造revision、confirmed_at或target_pages。两条原scope的`target_pages=[]`，保留原值。

本地实际执行：原537个Redis key → 真实ProspectV22Executor恢复4类来源 → 原BusinessScope和preparation request → `build_acquisition_input` → `prepare_keyword_input`（v14 / manifest v4）→ `generation_recipe`与真实repository.prepare验证 → `LeasedPreparationRpc`组装完整HTTP外壳 → 仅内存Capture。没有发送HTTP或调用SQL。完整编码与HTTPX Request.content逐字节一致。

**原始两任务的p_input重建均为36,962,127 B，与负责人原始freeze日志精确一致**；generation canonical为16,922,547 B，4类canonical为site 12,525,951、competitor 4,167,651、serp 110,525、public_gbp 2,048 B。重建的原始4来源请求与日志体积一致，没有凭空补渲染来源。

外壳使用原导出的终态成本计数和36字符UUID占位值（仅令牌内容不同，长度相同）：第一任务外壳2,407 B、第二任务2,405 B。因此下表是**实际完整重建对象的编码长度**，不再依赖日志锚定差量；仍不声称捕获了历史HTTP原始字节或历史freeze当时成本计数的位数。先前差量法的所有共同预算行，与此次完整重建结果逐项一致。

另做过一次严格的“开启渲染”本地探查：对应render缓存键不在导出中，SavedCheckpoints立即拒绝，未执行operation、provider或新成本claim。该探查不能证明历史开关值；最终重建采用原采集4来源，不捏造渲染记录，也不把它说成新一次渲染采集。完整4来源原包与生产p_input字节数一致是本次对照依据。

原件三个SHA-256均不变；每个保留深页（不仅必保页）的HTML、checksum及其它字段逐字节一致；原site和scope不变。派生snapshot按既有流程重算自己的binding/checksum，这是新准备输入，未改已有checkpoint、冻结证据或digest算法。

### 2.2 必保服务页（负责人已确认）

冻结分类中没有service_index/service_detail，但以下9条服务路径被标为other。负责人2026-11-16明确要求**9页全部保留，加首页**：backflow-testing、commercial-projects、leak-detection、new-construction、re-piping、residential-projects、service-department、sewer-inspection-video-recording、waterheaters。

测量用`required_urls`显式传入这9页，不修改原scope.target_pages、不改页面分类器，不把该客户URL硬编码进生产逻辑。加首页共10页，HTML **7,163,122 B**。生产helper已支持root/home、service_index/service_detail和SEO显式target_pages；冻结数据错误分类不能靠空target_pages自动恢复，未来应由负责人确认SEO范围或单独修分类，本轮不擅自处理。

只按原分类保首页的3 MB实验会删真实服务页，**不满足本轮要求，已排除**。

### 2.3 9服务页+首页全保留：完整请求实测

| HTML预算 B | 保留深页数 | 22440e65：整包 B | f7b13a4d：整包 B | 40MB判断 |
|---|---:|---:|---:|---|
| 原始11,841,935 | 16 | 36,964,534 | 36,964,532 | 放行（仅离线） |
| 10,000,000 | 13 | 31,188,972 | 31,188,970 | 放行（仅离线） |
| 8,000,000 | 11 | 27,811,300 | 27,811,298 | 放行（仅离线） |
| 7,200,000 | 10 | 26,184,604 | 26,184,602 | 放行（仅离线） |
| 7,163,122 | 10 | 26,184,604 | 26,184,602 | 放行（仅离线） |
| 6,000,000 | 不裁必保页 | — | — | 必保HTML已超过预算，确定性拒绝 |
| 3,000,000 | 不裁必保页 | — | — | 必保HTML已超过预算，确定性拒绝 |

**当前40MB结论：原16页无需降低HTML预算即可通过整包大小检查**，完整请求分别36,964,534 / 36,964,532 B，距40,000,000 B保护线剩余3,035,466 / 3,035,468 B。此“放行”仅说明客户端大小检查允许，不证明Small上freeze能成功或内存安全。没有执行真实RPC、没有修改生产HTML预算，也没有删除9个服务页或首页。

作为前次18MB分析的历史对照：同样必保清单的最低请求约26.18MB，确实无法低于18MB；这一测量结论不变，变化是负责人明确批准默认上限40MB。小于必保HTML的6MB/3MB预算仍确定性拒绝，不能为了通过而删除必保页。

对表内10份可重建请求（每任务5份），使用真实默认40,000,000 B的LeasedPreparationRpc，全部通过repository校验并进入**仅内存Capture**；随后显式将同一wrapper配置为18,000,000 B，10份均返回`V22_CAPABILITY_FREEZE_TOO_LARGE`且Capture调用次数不增加，证明配置覆盖仍生效。默认值改变没有改动冻结输入、checksum或HTTP编码。全程没有向数据库发送大请求。

复现命令（工作区根目录）：`SearchTrust-RD/.venv/bin/python .release-private/2026-11-16-fresno-jobs/rebuild_fresno_rpc.py`。实际输出：537 keys、2 jobs、external_calls=0、sql_calls=0、scope原值验证通过、完整repository验证通过、HTTPX编码一致、默认40MB允许10份请求且显式18MB覆盖在发出前拒绝10份；原文件哈希及所有保留深页字节不变。脚本、原始数据、full-rpc-measurements.json和full-rpc-40mb-run.log均仅放私有目录，不提交。

## 3. 内存放大分析（只出方案，不改freeze实现）

### 3.1 已知事实与不能证明的部分

负责人提供的故障发生时环境：0.5 GB NANO、shared_buffers约224 MB；旧16/19 MB请求成功、37 MB请求断连；随后多次automatic recovery及postmaster启动时间变化。它们说明数据库重启与freeze时间相关，**尚没有内核OOM/cgroup kill证据，不能把OOM写成已证明**。本轮不在生产做大请求或内存压测。

本地旧完整freeze诊断曾记录PG容器memory.peak约1002 MiB（包含文件缓存且无OOM），不是单查询RSS。也不能拿本地0.3秒的热缓存实验推导生产NANO容量。18MB是前次止血阈值，当前已按负责人裁定改为40MB。

负责人确认当前已升级Small（2GB）：shared_buffers=512MB、work_mem=5MB、max_connections=90；2026-11-16 04:47:29 UTC重启，service_role statement_timeout=180s仍生效。本轮采用该确认，不重复采集生产配置。40MB是本轮允许下一次冒烟验证Small的准入阈值，不是已测得的安全容量或并发保证；本轮不进行冒烟。

### 3.2 哪些地方有几份数据

下表区分**接口层可确认的逻辑重复**与数据库分配器的实际峰值。SQL赋值/表达式并不都保证额外复制整棵树；TOAST、内存上下文、临时值生命周期和并发决定实际RSS，不能把所有行简单相加声称“精确放大N倍”。

| 阶段 | 可确认的重复/临时表示 | 内存影响与证据 |
|---|---|---|
| Worker JSON请求 | 同一来源内容固定有2份逻辑文本表示：generation canonical里的payload + public_source_canonicals对应canonical；recipe已去payload，不是第3份HTML。HTTP转义再次增加字节。 | 本样本p_input36.96 MB，而site+competitor+serp约16.80 MB；还有GBP、上下文、转义与元数据。客户端JSON字符串/bytes和HTTP缓冲也占内存，但它们不等于PG进程RSS。 |
| PostgREST HTTP解析/绑定 | 至少接收完整请求body；库的解析树/参数表示可能同时存在，实际复制次数取决于PostgREST版本/实现。 | 这是独立进程的内存，不应直接加到PG RSS。RPC的jsonb参数还需在PG侧构造。 |
| 外层p_input jsonb | 一份外层二进制JSONB，内部仍含generation、各来源canonical这两组大文本。`p_input->>'p_generation_canonical'`提取出text参数。 | jsonb输入会解析为二进制结构，不能假定wire字节数就是内存字节数。[PG17 JSON类型](https://www.postgresql.org/docs/17/datatype-json.html)。 |
| wrapper与core | wrapper的`full_input=p_generation_canonical::jsonb`与core再次执行同样转换，共2次独立generation解析；嵌套调用时外层局部值仍在生命周期内。 | 两份逻辑generation树加原canonical；pub/full_input局部引用是否深复制不能只看赋值断言。当前迁移链保留这两次处理。 |
| 每个来源canonical | 逐来源执行`canonical::jsonb`并与`src->payload`比较，source当前值和比较临时表示存在；不是一次将所有来源都压缩后比较。 | 当前最大site约12.53 MB、competitor4.17 MB；JSONB提取、解析、比较产生峰值。sha256的`convert_to`还会产生UTF-8 bytea，流式hash本身不是主副本。 |
| INSERT与立即读回 | INSERT的datum、TOAST/pglz/WAL工作区；随后`select * into snapshot`，比较normalized_payload可能解压，增加当前来源的临时表示。 | 压缩后的磁盘体积不代表处理时驻留内存。不能由24行/11MB表体积判定大RPC安全。 |
| hydrate与整体比较 | hydrate从各normalized_payload重新组装1份完整generation逻辑树；`sources=sources||jsonb_build_array(source)`重复构造逐渐增大的数组，再由jsonb_set重建结果并和core.full_input比较。 | 不同阶段会有原值与新值并存；4个来源意味着4次逐步数组构造，所处理总字节超过最终数组本身。JSONB拼接和jsonb_set均返回新值，参见[PG17 JSON操作](https://www.postgresql.org/docs/17/functions-json.html)。 |
| recipe写入 | 主要存不带payload的配方和绑定元数据。 | 不应误说再次写一整份HTML；真正的放大集中在大参数、解析、来源比较、hydrate以及TOAST/临时值。 |

多个数据库连接可以同时承担以上工作集；shared_buffers（故障时224MB、当前负责人确认512MB）之外的backend内存并没有被work_mem统一封顶（work_mem主要约束排序/hash等操作，参见[PG17资源配置](https://www.postgresql.org/docs/17/runtime-config-resource.html)）。即使单个37MB请求通过40MB大小检查，也不能由此保证一个或两个并行freeze能在Small上安全完成。本轮没有更改worker并发或数据库规格。

### 3.3 下一轮候选方案与风险（均未实施）

1. **优先设计内容引用传输**：HTML/完整canonical作为不可变私有对象保存，worker上传前计算现有canonical checksum，对象存储验证内容，生成绑定user/Case/job/generation/schema/checksum/size的可信receipt；SQL只接收小manifest、配方和经过授权校验的引用。生成/离线重放在worker读取对象、校验后hydrate。DB不再解析、压缩大HTML正文。
2. 不能只让客户端提交一个自报hash：若无可验证blob、授权/租约约束、不可变存储receipt、保留期与重放机制，会削弱证据完整性。需要独立传输/来源schema版本与旧v1–v4兼容，不改已冻结数据或旧digest算法。应先验证对象上传与数据库manifest提交间的幂等/孤儿清理、租户隔离、失效及可恢复性。
3. **过渡方案**：按来源只传一次canonical、分阶段入库，再由小manifest引用；避免同时携带generation+各来源副本。仍然会在PG处理单个大site，而且SQL hydrate仍可能构造全量树，不能当作根治；SQL/Python协议与校验边界需一起评审。
4. 后续再评估去除重复generation解析、写后读回和整体hydrate比较，或改为已验证对象checksum/receipt比对；属于安全边界变更，不能本轮顺手删检查。单纯HTTP gzip只能减传输体积，不消除解压后的PG JSONB工作集。
5. 后续可评估全库freeze并发背压/单飞租约。Small升级已由负责人完成，本轮不再调整；升级提供余量但未消除重复内容。40MB仅是当前准入阈值，真实执行与并发容量尚待另行授权验证。

## 4. 实际测试与交付范围

以下命令均实际执行。后端相关测试与fast在40MB默认值调整后重跑；SQL、类型及历史输出是本轮前次已执行的结果（本次默认值调整未涉及这些路径），分别注明，不冒称重复执行。后端命令在SearchTrust-RD执行，数据库/类型命令在search-trust执行；离线测量在工作区根目录执行。

| 验证 | 实际命令 | 结果 |
|---|---|---|
| 大小、恢复、预算及准备队列 | `.venv/bin/python -m pytest -q tests/test_v22_freeze_safety.py tests/test_v22_acquisition_input_budget.py tests/test_v22_capability_acquisition_worker.py tests/test_v22_first_service_worker.py tests/test_v22_acquisition_freeze_metrics.py --disable-socket --allow-unix-socket --tb=short` | **58 passed in 5.33s**（40MB后重跑） |
| 后端完整fast | `.venv/bin/python scripts/run_v22_backend_quality.py fast` | **4306 passed, 265 deselected in 396.39s (0:06:36)**，exit 0（40MB后重跑）；沿用既有fast选择，不改marker/配置。 |
| 本地真实SQL全迁移链、退款与现有迁移回归 | `npx vitest run src/lib/database/v22FreezeSafety.test.ts src/lib/database/v22Migration.test.ts --maxWorkers=1` | **141 passed**（新增6项+原有135项），4.50s；40MB调整前执行，SQL未再改。 |
| 类型检查 | `npm run typecheck` | exit 0；40MB调整前执行，前端代码未改。 |
| 既有完整报告黄金输出 | `.venv/bin/python scripts/check_v22_report_goldens.py` | exit 0；3份黄金输出逐字节一致；40MB调整前执行。 |
| 六站v12/v13历史重放 | `.venv/bin/python scripts/replay_p1_01_keywords.py --historical-only --output-dir ../search-trust/output/p1-01/freeze-safety-20261116/history --compare-history ../search-trust/output/p1-01/historical-before/historical-digests.json` | 6站；`external_calls=0`，`compared=true`；73份来源文件不变；40MB调整前执行。 |
| 两任务完整RPC重建 | `SearchTrust-RD/.venv/bin/python .release-private/2026-11-16-fresno-jobs/rebuild_fresno_rpc.py` | exit 0；537 keys，2 jobs，provider=0、SQL=0；完整repository验证、默认40MB放行与显式18MB覆盖拒绝通过；原件哈希与保留HTML/checksum不变；详细数值见第2节。 |

新恢复测试覆盖：完整外壳/UTF-8/转义计量、等于阈值放行、超限不发freeze或恢复探针、超限确定性终止、重复投递不重复终止；普通网络断连核对后保留Retry；数据库启动时间改变且未提交时确定性终止；已提交manifest优先恢复交接、不退款；探针不可用时保存Redis意图，后续worker在采集前核对；first_service两项新错误终止且其他既有错误仍Retry。

本地SQL6项覆盖只读事务与lease不变、owner/Case/generation/kind过滤、service_role ACL、真实freeze提交后的manifest可见性，以及两个新错误分别重复终止时余额只增加1、仅一条technical_failure_credit、charge=compensated。网络断连由MockTransport模拟，退款由本地PGlite完整迁移链验证；不把两层测试说成生产重放或真实故障注入。

### 4.1 Diff与未上线边界

本轮后端6个产品文件：`app/core/config.py`、`app/jobs_v22/worker.py`、`app/jobs_v22/freeze_safety.py`（新）、`app/jobs_v22/capability_acquisition_worker.py`、`app/jobs_v22/acquisition_input_budget.py`、`app/jobs_v22/capability_acquisition_preparation.py`；测试5个文件（含新增`tests/test_v22_freeze_safety.py`）。数据库仅新增只读探针迁移及`src/lib/database/v22FreezeSafety.test.ts`，不改freeze函数/业务SQL、前端UI、规则或线上配置。

可审阅patch位于本地`output/p1-01/freeze-safety-20261116/backend.patch`与`database.patch`，包含新文件，排除既有未提交文档、PLAN、superpowers、私有原始数据。测试日志副本也在同一output目录；这些产物不提交。40MB相对18MB的最小增量另见`40mb-default.patch`（仅config、fallback常量、对应测试3个文件）。

实施阶段完成时未提交、push、部署或执行生产迁移。后续负责人已审阅授权上线，执行记录见第5节；必须先应用只读探针迁移并核对，再合并后端，不能颠倒。

### 4.2 本次答复后的结论与剩余边界

1. 服务页清单与两条scope均已补齐，无待补Redis key或数据库记录。负责人已决定全保9页，本轮测量全部遵守。
2. 负责人已明确批准40MB默认值，约36.96MB原包离线通过；不需要删必保页，也未修改生产HTML预算。是否能在Small上真正完成freeze尚未验证，不采集/冒烟来补证。
3. 后续上线已获负责人授权，严格按第5节执行。原实施工作区的无关未提交文件保留原样；从最新main新建独立工作树，只提交白名单。

## 5. 2026-11-16 审阅通过与发布记录

负责人确认Claude已审阅整包40MB保护、数据库重启恢复、只读迁移及页面预算，授权上线。严格执行：备份完成；两个仓库从最新main建立新分支和PR；两边CI全绿后执行迁移并核对ACL及service_role空job返回null；核对通过后合并后端，再合并前端，等待三处部署。禁止采集、扣费、冒烟、改开关，不额外设置Railway上限变量。

### 5.1 生产备份已完成

项目`cmdsbsvcxesnrrealftb`；三次`supabase db dump --linked`均退出0，无Warning；data使用`--data-only --use-copy`。开始2026-11-16 05:24:12 UTC，完成05:28:12 UTC。私有目录`.release-private/2026-11-16-freeze-backup/`，目录700、文件600；manifest为complete=true。未做恢复演练，不把成功导出等同于已验证恢复。

| 文件 | 字节数 | SHA-256 |
|---|---:|---|
| roles.sql | 493 | `3583120bc9a33d58114e8fcbf7fb31f8913496318895f4317a26d6fb0b6e1dfb` |
| schema.sql | 1,022,669 | `0bad3f2dee345c78eb264db4e70a5de8067075404281c8951c8ddcc941d46ca5` |
| data.sql | 43,656,815 | `76f480bef8cff75970619934a1e8dea37ade6f0b4ea73363d64487d5f95542f0` |

### 5.2 新分支与白名单

前端基线main=`543082c01c6432b6911d29a0e97ac49ae742e168`；后端基线main=`6316b10e454cfdba5885f5588957973b9dced900`。两个仓库均新建`fix/freeze-safety-20261116`，使用独立工作树，不复用已合并分支。只带入本轮白名单文件，原工作区保留。此提交阶段尚未执行生产迁移或合并；PR CI/迁移/部署结果待实际取得后追加。
