# Freeze 超时加固与离线容量分析（2026-11-11）

本轮只增加角色与传输的时间预算，不修改 freeze、业务函数、规则、证据、checksum 或锁超时。不采集、不收费、不冒烟，不在生产执行测试性 freeze。**180 秒配置不是整条链路可运行 180 秒的保证**：现有 90 秒准备租约、托管 Data API 限制和输入大小限制均保持原样。

## 实施范围与回滚

- 新迁移 `20261111110000_increase_service_role_statement_timeout.sql`：事务内 `alter role service_role set statement_timeout='180s'`，随后 `notify pgrst, 'reload config'`。重复执行结果相同，不修改其他角色、lock_timeout 或业务函数。
- 回滚：另行批准的迁移/事务执行 `alter role service_role set statement_timeout='60s'; notify pgrst, 'reload config';`，保留 lock_timeout。不能用 RESET 代替，因为原先明确配置为 60 秒。
- `SupabaseCapabilityInputRepository`：共享 RPC 实例的总超时从 60 改为 180 秒。
- 负责人另行批准最小补充范围：`VerifiedRpcClient` 仅对 `V22_CAPABILITY_INPUT` 前缀允许最高 180 秒；其他前缀仍最高 60 秒，未显式指定时仍默认 20 秒。否则 repository 在构造时就会报 `V22_CAPABILITY_INPUT_NOT_CONFIGURED`。

同一 repository 的 `prepare` 与 `resolve` 共用该值；实际还供获客/首次服务的 intake、begin、claim、heartbeat、stage、dispatch、status 和 terminal decision 调用使用，均获得较长传输预算。它不是只改 freeze 一条 RPC。`SupabaseCapabilityResultPersister` 使用独立的 `V22_CAPABILITY_PERSISTENCE` 客户端，仍为 60 秒；其他独立 Verified/Review/清理/对账客户端保持原值。数据库 service_role 的角色设置则影响该角色的全部 SQL，而不只 freeze。

## 可能先行生效的限制（只读排查）

| 层级 | 当前限制/证据 | 本轮处理与边界 |
|---|---|---|
| VerifiedRpcClient 构造校验 | 原先无条件拒绝 >60 秒 | 已获额外批准，仅 capability input 放宽到 180 |
| RPC 总计时与 HTTPX | `asyncio.timeout` 与请求级 connect/read/write/pool 均使用显式 total_timeout_seconds | 同步为 180；总计时包括网络与响应处理，并非额外给 SQL 180 秒再加网络时间 |
| Worker/Web HTTPX 默认 | worker.py 的 capability client、api/v2/runtime.py 的 client 默认均为 60 秒 | RPC `stream(...,timeout=180)` 会覆盖默认，MockTransport 测试验证所有请求级 timeout 值为 180，无需改启动配置 |
| 准备租约与 manifest fence | `20261021110000_queue_v22_acquisition_preparation.sql` 中 claim/heartbeat 为 90 秒；`fence_v22_acquisition_manifest` 用 clock_timestamp 检查过期；freeze 前停止后台 heartbeat | **可能在 180 秒之前失败**，取决于抵达 manifest insert 的时间；不修改租约、fence 或 freeze。首次服务也有同类 90 秒租约 |
| ARQ job timeout / 总 deadline | Worker 的 V22_JOB_TIMEOUT_SECONDS 未设置独立环境值，代码默认 1200 秒；获客 `_prepare` 使用 receipt.deadline_at 的剩余时间约束整个操作 | 不是额外硬编码 60 秒，但如果此前采集已经耗尽总期限，剩余时间仍可能不足 180；不延长期限 |
| Worker 通用租约/heartbeat | 生产变量未设置独立值，代码默认租约 180 秒、heartbeat 30 秒；准备阶段另用 SQL 的 90 秒租约 | 不把通用 180 秒误当成准备租约；不改配置 |
| PostgreSQL | 已知 service_role 原 60 秒，authenticator 8 秒；lock_timeout 8 秒 | 只把 service_role statement_timeout 改成 180；锁等待仍可能 8 秒报错。authenticator/anon/authenticated 原值不动 |
| 托管 Supabase Data API | 官方 Timeouts 文档说明 Dashboard/Client 查询可配置上限为 60 秒，较长事务建议直接/会话连接 | **不能把角色 catalog 的 180 秒当成该项目网关已放宽的证明**。本轮不切换连接方式、不改网关、不发长查询测上限 |
| PostgREST 连接池等待 | 官方 db-pool-acquisition-timeout 默认 10 秒，等待连接满时可返回 PGRST003/504；该项目运行时值未重新读取 | 这是获取连接的等待上限，并非正常 SQL 执行 10 秒上限；不改连接池 |
| Railway HTTP 网关 | 官方说明无数据传输 5 分钟、持续传输最多 15 分钟；60 秒 idle keep-alive 是请求之间的空闲 | freeze 是 Worker 直接请求 Supabase，不经 Railway 入站 HTTP 网关；不需要同步修改这些值 |
| prepare 输入大小 | Python `len(canonical)>20_000_000`，SQL prepare 同样检查 generation canonical 20,000,000 字节 | 不因超时增加而改变大小限制；competitor 只是整个 generation 的一部分 |
| resolve 响应大小 | 输入 repository 的 max_response_bytes=25,000,000 | 保持原样；可能先于时间预算拒绝较大响应，不修改资源限制 |
| 结果保存 RPC | capability_result_persistence 的独立 60 秒预算 | 是 freeze 之后的另一阶段，不会截断 freeze；本轮不改 |

外部依据（2026-11-11 查阅）：[Supabase Timeouts](https://supabase.com/docs/guides/database/postgres/timeouts)、[PostgREST connection pool acquisition timeout](https://docs.postgrest.org/en/stable/references/configuration.html#db-pool-acquisition-timeout)、[Railway public networking limits](https://docs.railway.com/networking/public-networking/specs-and-limits)。托管服务的文档边界不是本项目的长请求实测结果。

## 四条已知耗时与拟合方法

不新取生产数据、不追加 provider 请求。MB 均为十进制 1,000,000 字节，耗时是 Worker 单次 freeze RPC 的观测值，不能与 pg_stat_statements 的 SQL-only 计时混用。

| 负责人提供的时间点 | competitor canonical (B) | input (B) | RPC (秒) | 用途 |
|---|---:|---:|---:|---|
| 2026-11-08 05:38 | 未提供 | 未提供 | 17.579 | 没有配对体积，不用于按体积回归 |
| 2026-11-10 08:03 | 5,566,791 | 15,197,038 | 36.009 | 完整体积/耗时点 |
| 2026-11-10 09:02 | 5,566,791 | 15,197,038 | 34.717 | 同体积重复观测 |
| 2026-11-10 10:24 | 7,497,424 | 19,335,109 | 41.336 | 完整体积/耗时点 |

数据质量边界：本地 release-2026-11-06.md 还记录过 **2026-11-10** 的 17.579 秒请求，体积为 5,566,970 B / 15,197,456 B，结果是 22P05 提前失败。日期与负责人给定首行不同，不能仅因耗时相同就合并为同一请求，也不能把早退耗时当作完整 freeze。首行体积保持未知。四条时间记录中，只有三条有可配对体积，且只有两个不同的体积档，不能声称有四个独立容量点。

对三条完整点作线性最小二乘：低档均值 `(36.009+34.717)/2=35.363` 秒，增长率 `(41.336-35.363)/(7.497424-5.566791)=3.093804` 秒/MB。得到 `t=18.140440+3.093804×competitor_MB`。同档耗时相差 1.292 秒，已说明存在与体积无关的波动。

另取最陡有效点对作较保守的敏感性线：增长率 `(41.336-34.717)/(7.497424-5.566791)=3.428409` 秒/MB，锚定最大已知样本 `t=41.336+3.428409×(competitor_MB-7.497424)`。它也不是统计置信上界。

| competitor (MB) | 拟合 RPC (秒) | 较保守敏感性线 (秒) |
|---:|---:|---:|
| 5.566791 | 35.363 | 34.717 |
| 7.497424 | 41.336 | 41.336 |
| 10 | 49.078 | 49.916 |
| 15 | 64.547 | 67.058 |
| 20 | 80.017 | 84.200 |
| 25 | 95.486 | 101.342 |
| 30 | 110.955 | 118.484 |
| 40 | 141.893 | 152.768 |
| 50 | 172.831 | 187.052 |

180 秒的**纯耗时理论交点**约为 52.32 MB（拟合）或 47.94 MB（较保守线），不能称作安全生产上限。若仅作规划，假设最多使用 120 秒、为 180 秒总预算留出 60 秒余量，则较保守线交点约 30.44 MB，可取整为 **30 MB 的时间容量规划值**；该假设没有加入任何配置，也未得到压力测试验证。

但当前输入结构根本不能把这个 30 MB 直接投入使用。本地只读测量已保存的 `67cb-hydrated-request.json`：generation canonical 9,152,307 B，其中 competitor 7,497,184 B，非 competitor 开销 1,655,123 B。保持其他内容和结构固定时，20 MB generation 检查最多只留 **18,344,877 B** 给 competitor。这是对现有文件 canonical 化的离线测量，非原 RPC 请求重新采集的体积，因此不替换上表的历史日志值。更大的其他来源会继续降低该数值。

此外，若托管 Data API 的文档 60 秒限制生效，较保守时间线交点仅约 12.94 MB；90 秒租约的对应交点约 21.69 MB，但租约检查发生在 manifest insert，不能将此换算为精确请求上限。以上任一条件都会比“180 秒理论容量”先起作用。**本轮不能给出已保证安全的最大 competitor 体积**；最大已观测完整样本仍为约 7.50 MB / 41.336 秒。

pg_stat_statements 的 7 次调用均值 15.331 秒、最大 29.261 秒只作数据库侧背景，未作为额外样本参与 Worker RPC 回归。小样本、JSON 结构/转义、来源大小联动、网络、连接池等待、数据库负载、缓存与触发器成本均会改变斜率。不能据此保证更大输入可在 180 秒内完成。

## 本地验证

- 后端针对输入 repository、共享传输与 acquisition worker：139 passed。
- 数据库测试：v22StatementTimeout.test.ts 与 v22FreezeTimeout.test.ts 合计 3 passed；验证重复应用、其他角色不变、lock_timeout 不变、业务函数定义不变，以及回滚到 60 秒。
- 实际本地嵌入式 PostgreSQL（PGlite）查询 `pg_db_role_setting`：`service_role: [statement_timeout=180s, lock_timeout=8s]`。未运行本地 Supabase Docker；该结果不证明托管 PostgREST/网关的长请求行为。
- 生产 dry-run 只列出本轮新迁移；此分析阶段没有生产写入。
- 后端完整 fast：`4235 passed, 265 deselected in 371.90s (0:06:11)`。265 项为 fast 命令排除的 Redis/native 集成测试，不冒称它们已经在本地执行。
- 完整数据库迁移链 `v22Migration.test.ts`：135 passed；连同上述超时专项共 138 项数据库测试通过。
- 本轮不以真实 freeze 或采集验证大输入，不处理性能慢点。生产 catalog 和 CI/部署核对在发布后另行记录，不把本地 role catalog 等同于生产已生效。

实际执行的自测命令：

```bash
# SearchTrust-RD
.venv/bin/python -m pytest -q tests/test_v22_capability_input_timeout.py tests/test_v22_capability_input_repository.py tests/test_v22_verified_input_resolver.py tests/test_v22_capability_acquisition_worker.py
.venv/bin/python scripts/run_v22_backend_quality.py fast
# search-trust（仅数据库测试，无前端应用代码改动）
npx vitest run src/lib/database/v22StatementTimeout.test.ts src/lib/database/v22FreezeTimeout.test.ts
npx vitest run src/lib/database/v22Migration.test.ts
```
