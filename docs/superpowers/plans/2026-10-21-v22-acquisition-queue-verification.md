# P2 接续：准备队列与正式执行交接

日期：2026-10-21。承接获客准备批次，完成内部 worker 接入；未部署、未切换用户入口，P2 整阶段仍未完成。

## 已完成

1. 独立 ARQ 准备函数及物理 ID，只传原 job ID / generation，不占用正式执行队列身份。内部登记/排队接缝支持重放修复 enqueue 失败，没有新增扣点调用。
2. SQL 准备租约复核已登记任务、原收费、状态、代次和 deadline。准备与正式执行共同使用原任务 attempt_count，不建立第二套供应商重试预算。
3. 准备检查点使用独立 generation 命名空间，成本账本使用原任务 key。SQL 租约检查约束检查点 I/O，来源冻结再次核对有效租约。已进入准备队列的任务无法绕过租约直接插入 manifest。
4. 心跳保存成本并续租；原截止时间或租约丢失取消采集。冻结输入与最后准备成本、交接状态在同一 SQL 事务内提交，迟到准备心跳不覆盖正式执行状态。
5. 通过真实准备协调器、真实输入仓库及正式 `V22JobRuntime.submit_capability` 接通交接。正式 Redis 状态只登记小 envelope，保留原时间、代次、版本号、尝试次数和成本。
6. 冻结提交后响应丢失、正式排队结果未知时，下次领取返回 ready dispatch，不再次采集。已完成报告沿用 SQL 权威恢复。
7. 新版成本账本采用初始化后禁止重建的策略：曾执行任务账本缺失、或运行中账本被删除，均停止而不是恢复为零预算。旧流程默认账本行为不变。
8. worker 启动仅在 capability readiness 和现有采集开关均满足时注入准备器。没有新公开付费入口；开关实际仍关闭。

设计：[队列接续设计](../specs/2026-10-21-v22-acquisition-queue-design.md)。没有使用新供应商、扩充采样预算或修改商业规则。

## 故障处理边界

- 未知 RPC 结果不会立即触发返还。准备异常、尝试耗尽、worker 消失继续由已有原数据库 deadline 巡检统一补偿一次。
- 领取已提交、账本尚未建立时崩溃，后续无法证明没有花费的任务会保守停止，等待恢复或到期补偿；不为提高恢复率重置预算。
- SQL 租约和冻结门槛防止旧 worker 发布结果，不宣称供应商调用 exactly-once。中断时供应商请求可能已经发生，仍由原操作账本约束。
- 关闭开关不是退款操作；发布前仍需排空/恢复策略。准备队列尚无用户页面状态展示，不能把当前内部运行作为用户端全链路验收。

## 文件与基线

- FE：新增 `supabase/migrations/20261021110000_queue_v22_acquisition_preparation.sql`，源迁移总计 45；扩展 `src/lib/database/v22Capability.test.ts`。
- BE：新增 `app/jobs_v22/capability_acquisition_worker.py` 和对应测试；扩展队列、worker 启动注入、成本账本保护与已有 capability worker 测试。
- 开始快照：`/Users/liuyun3/Documents/SearchTurst前后端/.v22-capability-baselines/baseline-1jhylV`，manifest SHA-256 `e677dfc5dac88faa9af92354b8832e47fceb390fe9efd48994e7daacb8ac8c20`。FE 216 / 排除 33，BE 84 / 排除 0。
- HEAD 不变：FE `88890cd484ad1a5f9294b1f21bb5a47bc27f5b7a`；BE `9bf2090b91d5ee036f8ea7e470797761b8cf838c`。保留既有修改，无提交或部署。
- 收尾快照：`/Users/liuyun3/Documents/SearchTurst前后端/.v22-capability-baselines/baseline-lgj9Ih`，manifest SHA-256 `5064785064f8b0028d17805117d38b836261e0238fcc4fe5e029d614c66a1574`。FE 219 / 排除 33，BE 88 / 排除 0；仅本行在快照后补记。

## 验证结果

| 检查 | 结果 |
| --- | --- |
| FE 全量 | 145 文件、1,436 项通过 |
| FE 数据库能力测试 | 83 项通过，含新增 9 项；计入全量 |
| FE 类型检查 | 通过 |
| BE 全量 fast | 2,090 项通过、23 项 Redis 集成未纳入 |
| BE 新准备 worker | 14 项通过，计入全量；最后日志改动后再次通过 |
| BE 准备 worker + capability worker | 31 项通过 |
| 契约双端一致性 | 20 配套 / 6 runtime / 10 生成示例产物检查通过 |
| 配置产物扫描 | 42 文件、0 发现；secretValuesChecked=0，不是全仓库或生产秘密审计 |
| 实际开关 | FE dispatch=false，BE capability execution=false |
| 两仓库 diff 空白检查 | 通过 |

SQL 通过 PGlite 顺序加载全部迁移；后端使用 MockTransport、FakeRedis 与严格合成来源，运行真实准备/绑定/仓库/正式派发代码。未访问真实网站、Google 授权或付费供应商；SQL 竞争用例是顺序交错，不替代原生 PostgreSQL 多连接验证。

本轮修正两类测试数据：失败任务须具备完整终态字段；“最后一次重试”须有前面尝试对应的成本账本。未削弱保护来让测试通过。首次后端全量的 3 个旧 fixture 失败已修正，随后完整重跑全部通过。

没有界面改动，未重跑浏览器、PDF 视觉或前端生产构建；未进行真实 Redis 重启/ARQ 进程崩溃、原生 PostgreSQL 并发及远程迁移验收。

## 下一步与未完成项

1. 用户“开始分析”中的业务确认、原子预留/登记与内部准备队列接入，以及准备期间的状态读取。当前登记前已扣点但未标记的窗口仍需关闭。
2. 跨 Case 共享缓存来源的安全持久化，不能通过重写原始来源 ID 绕过绑定冲突。
3. Case 新报告索引、完整修订/批准的界面与接口、同版本 PDF/分享出口。
4. 首次服务、实施复核与其余 P3–P6 门槛，以及真实运行环境的发布验收。
