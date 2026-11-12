# Freeze 事务内准备租约修复（2026-11-12）

只修改获客与首次服务 freeze 事务内的租约长度；不修改计算、claim/普通 heartbeat 的 90 秒、fence、deadline、review/discovery、角色设置或锁超时。没有采集、扣费、冒烟或生产测试性 freeze。

## 生产基准与唯一函数改动

通过 `supabase db query --linked` 只读取得生产 pg_get_functiondef。两个函数体分别与 `20261021110000_queue_v22_acquisition_preparation.sql`、`20261021180000_queue_v22_first_service_collection.sql` 的原始函数体逐字相同，未发现后续覆盖。

原生产完整定义 MD5：

- freeze_v22_acquisition_preparation：`e144bdd704d3b7b6ceed8afbaa68cdab`
- freeze_v22_first_service_preparation：`10ec084d7c4ea5b4ca6793feaccd3f00`

新迁移：`20261112090000_extend_freeze_preparation_lease.sql`。迁移 guard 检查两个函数的 prosrc 必须与已导出的旧定义或本迁移定义相同，遇到漂移则失败；随后 CREATE OR REPLACE 两个函数，保持 ACL、SECURITY DEFINER 与 search_path。唯一函数体差异，是 heartbeat 成功后、prepare 前加入以下块（首次服务仅换成 capability_first_service_runs）：

```sql
  declare lease_rows bigint;
  begin
    update public.capability_acquisition_runs
      set lease_until=least(job.deadline_at,clock_timestamp()+interval '200 seconds')
      where job_id=job.id and lease_token=p_lease_token;
    get diagnostics lease_rows = row_count;
    if lease_rows<>1 then raise exception 'CAPABILITY_PREPARATION_LEASE_LOST'; end if;
  end;
```

200 秒仅在 freeze 事务内生效；计算或事务失败时，延长与 heartbeat 一起回滚，崩溃不会持久化较长租约，原接管路径不变。提交时 manifest 已存在，准备租约不再控制交接。least 保留原 deadline 上限，不创建新的期限。

回滚脚本：`supabase/rollbacks/20261112090000_extend_freeze_preparation_lease.sql`。在单独批准的回滚操作中恢复本轮导出的两个原函数定义；脚本带相同漂移检查，不会恢复/改写其他函数或角色。该目录不参与正常 db push。

## B：本地数据库验证

实际命令：

```bash
# search-trust
npx vitest run src/lib/database/v22FreezeLease.test.ts src/lib/database/v22Migration.test.ts
# SearchTrust-RD
.venv/bin/python scripts/run_v22_backend_quality.py fast
# C 的既有回归（未修改 Worker 或测试）
.venv/bin/python -m pytest -q tests/test_v22_capability_acquisition_worker.py
# search-trust
npx tsc --noEmit
```

第一条结果：151 passed，其中租约专项 16 项（获客/首次服务各 8 项），完整 v22Migration.test.ts 135 项。

后端 fast 实际输出：`4235 passed, 265 deselected in 355.96s (0:05:55)`。265 项为 fast 命令排除的 Redis/native 集成测试，不冒称本地运行。Worker 专项：`23 passed in 1.60s`。类型检查退出码 0。

| 要求 | 验证 |
|---|---|
| B1 超过 90 秒 | 本地真实 freeze/heartbeat/fence 函数，测试 prepare helper 将 heartbeat 后的 lease_until 等价减去 100 秒；旧定义报 LEASE_LOST，新定义写入 manifest 成功。没有真实等待 100 秒 |
| B2 回滚 | prepare helper 在 manifest 写入后主动报错；租约恢复到调用前原 90 秒值，heartbeat/status/manifest 写入也一并撤销 |
| B3 deadline | job 剩余 120 秒时延长结果严格等于原 deadline，不产生 200 秒新期限 |
| B4 令牌与接管 | 错误令牌、run_generation/令牌被接管、已过期租约均报 LEASE_LOST；没有借延长复活旧 owner |
| A2 更新计数 | 本地触发器使最终延长 UPDATE 返回 0 行，heartbeat 虽成功，freeze 仍报 LEASE_LOST |
| B5 首次服务 | 与获客完全相同的上述覆盖 |
| 保持不变 | claim、heartbeat、fence 定义与 ACL 不变；普通 heartbeat 仍至多 90 秒；重复迁移及恢复原定义均通过 |

边界：租约专项使用 PGlite 本地 fixture 表和原始 SQL 函数；只 stub 计算 helper，以隔离经过时间，不测试业务报告生成。完整迁移链另外使用完整应用 schema。未在生产延时、修改租约值或调用 freeze 测试。

## C：Worker 到期路径（只读）

`capability_acquisition_worker.py` 的 `_prepare` 用 receipt.deadline_at 的剩余时间调用 asyncio.wait。freeze 未完成而 deadline 到达时，operation 不在 done 集合，抛 JobLeaseLost。虽然该类继承 DeterministicJobError，但退款分支明确排除 JobLeaseLost，因而走 Retry(defer=30)，finally 取消未完成的 operation/heartbeat/lost task。

这条路径不调用 `_fail_preparation`，不依据不确定的 HTTP/SQL 结果直接退款，也没有 reserve/debit 调用。SQL 若已提交，后续 claim 的 ready/dispatch 分支恢复原 job，而非重新采集、建新任务或扣点。真正超过 SQL deadline 且无已完成报告的任务由 expire_v22_prepared_capability_jobs 经 apply_analysis_job_event 处理，沿用既有终态/补偿幂等约束；成功报告由 report_id/capability_report_id 条件保护。不能把取消 HTTP 等同于数据库必定回滚。

以上是代码路径与现有回归检查的结论，没有生产故障注入。Worker 文件、扣费与补偿逻辑均未修改。

## D：lock_timeout 历史纠正与等待风险（只读）

上一轮将本地测试夹具中人为设置的 service_role.lock_timeout=8s，以及 authenticator 的 8s，混写成了生产 service_role 的显式设置。这是报告错误，不是已查明的一次删除操作。

已有只读记录：首次 60 秒迁移前，角色设置中仅 authenticator 有 lock_timeout=8s，service_role 无独立 timeout；该迁移后 service_role 仅新增 statement_timeout=60s；上轮 180 秒迁移核对仍只有 statement_timeout=180s。两次迁移的 ALTER ROLE SET statement_timeout 不会删除其他设置，仓库迁移中也没有删除 lock_timeout 的语句。现有证据不支持“被本轮或上轮迁移移除”。这不能冒称已审计项目创建以来每次人工操作。

还需区分角色 catalog 与有效会话值：**service_role 未显式设置 lock_timeout，不等于其 RPC 会话 lock_timeout 必定为 0。** PostgREST 标准路径先使用 authenticator 连接设置，再叠加 service_role 的事务设置；已有记录的 authenticator.lock_timeout=8s 在未被其他设置覆盖时会保留。因此标准路径预计每次行锁获取等待约 8 秒后报 55P03，而不是仅凭 service_role catalog 就断言等待 180 秒。

本轮没有同一 RPC 会话的 current_setting('lock_timeout') 实测，不把 Management API 管理连接的 SHOW 值冒充 PostgREST 有效值。若某连接实际 lock_timeout=0，则 claim/heartbeat 可能等待到 freeze 释放锁，或被其自己的 180 秒 statement/RPC 总预算取消（还受网关、剩余任务期限影响）；statement_timeout 包含锁等待。claim 还可能先等 client_cases 行锁，heartbeat 直接等 analysis_jobs 行锁；lock_timeout 是每次锁获取上限，不是整条事务总上限。

锁等待期间请求会占用 PostgREST 数据库连接，Worker 协程/并发槽也会等待；积累后新请求可在连接池获取阶段失败。即使有效 lock_timeout 已是 8 秒，仍可能暂时占用这些资源，但不能据此声称生产已经发生堆积。

建议：没有需要“恢复被删除配置”的证据，不建议以恢复为名立即修改。若希望给 service_role 明确、独立于连接角色的 8 秒锁等待约束，可作为单独变更显式配置并验证真实 RPC 会话；本轮不执行。

依据：[PostgREST 事务角色设置](https://docs.postgrest.org/en/stable/references/transactions.html#impersonated-role-settings)、[PostgreSQL SET ROLE](https://www.postgresql.org/docs/17/sql-set-role.html)、[PostgreSQL lock_timeout](https://www.postgresql.org/docs/17/runtime-config-client.html#GUC-LOCK-TIMEOUT)。

## 发布核对

提交/CI、生产迁移清单，以及 pg_get_functiondef 前后零上下文差异在发布完成后保存到 output/release-2026-11-06/freeze-lease-2026-11-12/，不提交生产导出产物。未修改既有未提交的 PLAN、release 文档及 docs/superpowers/plans 验收记录。后端没有代码变更，不另建后端提交、不重部署 Web/Worker。
