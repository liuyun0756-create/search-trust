# 首次服务：真实 PostgreSQL、Redis 与 ARQ 恢复验收

日期：2026-10-22。本批完成本地真实服务的并发与进程中断验证，未部署、未远程迁移、未改变功能开关。

## 结果

使用独立 PostgreSQL 17.10、Redis 7.4.2 和 ARQ worker 进程，执行前端全部 58 个 SQL 迁移和实际首次服务准备、生成、结算代码。31 项集成测试通过：既有 23 项 Redis 验证 + 新增 8 项首次服务验证。

上一批使用 PGlite/FakeRedis 的流程已有浏览器批准/PDF/分享覆盖。本批专门验证实际数据库行锁、Redis 状态、队列去重、跨进程检查点和结算恢复；公开来源仍是合成输出。

## 新增八项测试

| 场景 | 实际检查 |
| --- | --- |
| 20 个并发确认请求 | 独立 SQL 连接执行确认；只创建一个范围版本、一个任务、一次 verified 扣点 |
| 12 个并发领取请求 | 只有一个 claimed、其余 busy；租约结束后接管，原 token 无法再续租 |
| 有行动的完整 ARQ 任务 | SQL 扫描发布、真实准备 worker、正式 runtime 和生成 worker，得到实际三行动报告 |
| 零行动的完整 ARQ 任务 | 实际生成零行动诊断；消费一点，不返还 |
| 来源冻结后进程退出 | SQL 已提交、正式任务尚未登记时以 `os._exit(71)` 退出；替代进程从 ready 继续，不重新采集 |
| 报告检查点保存后进程退出 | 从相同 Redis 检查点恢复；通过 SQL 状态同步后以第二执行代完成，检查点字节与输入校验值不变 |
| 报告提交后进程退出 | SQL 已成功、Redis 尚未成功时退出；SQL-first 恢复为成功，不重复完成事务，不退款 |
| 报告生成技术失败 | 真实 worker 进入失败协调和结算；只返还一次，重复执行/扫描仍保持失败终态 |

成功路径核对同一任务 ID、原创建时间和截止时间、六来源输入、无父报告、唯一报告记录、一次消费。三个中断路径均核对公开来源各采集一次、冻结一次、完成一次。报告检查点与最终 SQL 报告内容一致。

技术失败路径核对余额回到 5、账本恰好一条 `verified_debit=-1` 和一条 `technical_failure_credit=1`、没有可交付报告。零行动路径余额保持 4、没有返还，两者分开验收。

## 真实队列揭示的恢复细节

ARQ 会保留退出进程对应的 in-progress 投递记录。同一分钟重复扫描会被相同物理投递 ID 去重；现有准备 reconciler 使用分钟分桶，在下一轮发布新的物理投递 ID，逻辑任务、业务范围、点数和处理截止时间不变。

测试同时覆盖同分钟去重和跨分钟恢复。为避免固定等待一分钟，只推进测试注入的“发布分桶时钟”；SQL 的原任务时间和冻结来源不移动。生成阶段的 stale 判断也使用注入时间触发，数据库与 Redis 仍是真实服务。采集租约测试仅将独立测试记录的租约缩短到 100 毫秒，并经过真实时间等待后接管；不声称已按生产等待时长做长期运行测试。

本轮没有发现需要修改生产恢复逻辑的问题；联调修正的是测试来源的观察时间顺序及测试对队列去重的预期。产品输入校验未放宽。

## 新增的可重复运行入口

后端文件：

- `requirements-native-tests.txt`：可选测试依赖，在既有开发依赖基础上加入 psycopg 3.2.13；不加入运行时依赖。
- `scripts/run_v22_native_integration.py`：接收 PostgreSQL/Redis 可执行文件路径，在新临时目录创建并拥有测试服务；随机端口、仅回环监听、生成独立数据库和 Redis 前缀。
- `tests/integration/support/native_capability.py`：真实 SQL RPC 适配器、来源种子和 SQL 状态同步；请求以 service_role 执行。
- `tests/integration/support/native_worker.py`：独立 ARQ 测试进程，运行实际准备/生成函数，并在指定持久化断点退出。
- `tests/integration/test_native_first_service_recovery.py`：上述八项测试，每项克隆独立测试数据库。
- `tests/test_v22_native_test_guard.py`：阻止非本地端点、业务数据库名称、密码、连接选项及生产配置进入测试适配器。

已有 fast 入口调整为同时排除 Redis 和 native 测试，保持禁止 TCP 的快速测试可独立运行。现有 Redis 入口继续运行其原有场景；新的组合测试通过 native 入口显式运行。当前 CI 工作流未接入新的 native 入口。

复现示意（BE 根目录，使用已安装的测试二进制）：

```bash
python -m pip install -r requirements-native-tests.txt
python scripts/run_v22_native_integration.py \
  --postgres-bin /absolute/path/to/postgres/bin \
  --redis-server /absolute/path/to/redis-server \
  -- --tb=short
```

脚本不下载安装服务，也不连接现有业务数据库。测试结束后关闭所属 worker、PostgreSQL、Redis，并删除该次临时数据库目录。下载的测试工具可由调用者自行管理。

本机 Docker daemon 未启动，故使用临时下载的 PostgreSQL 二进制与临时编译的 Redis。psycopg 安装在独立临时依赖目录，通过 PYTHONPATH 注入，未改现有虚拟环境或项目锁文件。

## 验证与边界

- 组合原生集成：31 passed、2,202 deselected，约 13 秒；PostgreSQL 17.10、58 migrations、Redis 7.4.2。
- 定向快速回归：39 项通过，包含首次服务 worker、新版生成 worker、夹具及测试环境保护。
- 后端全量 fast 入口：2,202 passed、31 deselected，约 64 秒；双仓库 `git diff --check` 通过。
- 未改前端页面、报告规则、计费规则或数据库迁移，本批无需前端发布构建。

仍待验证：真实身份授权/来源同步、实际竞品发现与采集供应商、真实客户报告质量、签名 HTTP 回调与费用 outbox 在相同环境的完整联动、部署恢复。来源提供者和 HTTP RPC 传输由测试适配；SQL、Redis、ARQ 和进程退出是真实执行。不能把本批结果当作生产发布验收。

下一步按主计划推进 P4 业务价值优先级和 P5 实施/复核，并保留真实来源与发布验收门槛。P3 与总计划不整体关闭。

本轮开始基线：`baseline-P3hmCJ`，manifest SHA-256 `91cf86ae76e10ae861d94af4803ac3ae966aa6b7560e8172e5a4d602dbc8ff31`。原有未提交内容保留。
