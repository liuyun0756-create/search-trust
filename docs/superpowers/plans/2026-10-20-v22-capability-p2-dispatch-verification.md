# P2 接续：已准备任务提交、恢复与 Owner 报告读取

日期：2026-10-20。本批本地实现及验证完成；不是 P2 整阶段完成，未部署、未启用新入口、未执行真实收费分析。

## 完成范围

1. 新增服务端派发授权 RPC 和 owner 提交路由。浏览器只提供原 Case、任务 ID、幂等键及空对象；服务端读取并复核冻结请求，不接受浏览器指定来源正文、身份或报告类型。不新增扣点。
2. 后端内部提交再次验证 SQL 绑定；沿用原代次、截止时间、尝试次数和状态版本。同一 queued 任务可以重复投递同一物理队列 ID，修复登记后未入队的中断。运行中不重复排队，失败任务不复活，SQL 已完成时无需访问 Redis 即可返回完成引用。
3. SQL 有成本记录而 Redis 操作账本丢失时，不重建空预算继续执行；耗尽尝试预算也不重置。过期任务由原截止时间及终态规则处理。
4. 新增数据库时钟驱动的已准备任务到期巡检；行锁、skip locked、每批最多 100 项。保留真实尝试次数（包括尚未执行的 0），原事件事务仅补偿一次。已结算的正常零行动报告不进入清理，仍消耗 1 点、不返还。
5. 轮询及浏览器事件解析支持新版最小完成引用，核对任务和 Case，保留旧接口兼容。完成后可定位新报告。
6. 报告页增加默认关闭的 owner 读取分支。先验证正式完成及已消费权益；系统版保留原始报告，仅最新已批准修订可作为客户版。新草稿不回退为旧批准版。旧报告路由优先且保持兼容。

设计依据：[本批设计](../specs/2026-10-20-v22-capability-p2-dispatch-design.md)。

## 主要文件

- FE：`supabase/migrations/20261020140000_authorize_v22_capability_dispatch.sql`，含授权与已准备任务到期补偿两个 RPC。
- FE：`src/lib/report-capability/{dispatch,dispatch-handler,owner-document,runtime}.ts`，`src/lib/analysis-v22/versioned-status.ts`，对应测试及生成 runtime schema。
- FE：`src/app/api/v2/cases/[id]/capability-analysis/route.ts`，`src/app/cases/[caseId]/reports/[reportId]/page.tsx`，原轮询 handler 和 workspace 状态处理。
- BE：`app/jobs_v22/{capability_dispatch,capability_reconciler}.py`，`store.py`、`worker.py`，`app/api/v2/{dependencies,runtime}.py`。
- BE：`tests/test_v22_capability_{dispatch,reconciler}.py` 及 runtime schema 导出脚本。

## 验证结果

| 检查 | 本轮最终结果 |
| --- | --- |
| FE 全量单元/组件/隔离数据库 | 145 文件，1,414 通过 |
| 新数据库能力测试（含前序） | 61 通过，计入 FE 全量 |
| 新 owner 提交 / 版本状态 / owner 文档测试 | 15 / 7 / 4 通过，计入 FE 全量 |
| BE fast | 2,043 通过，23 项未纳入 |
| BE 新提交 / 到期巡检测试 | 21 / 6 通过，计入 BE fast |
| 原获客报告、服务升级浏览器回归 | 3 通过；模拟身份/API、外部请求保护 |
| FE 类型检查与生产构建 | 通过；27 个静态页面，新增提交 API 纳入构建 |
| 双端契约一致性 | 20 配套契约、6 runtime、10 实际规则 QA 产物 --check 全部通过 |
| 配置产物安全扫描 | 42 个配置内文件，0 发现，secretValuesChecked=0；不是生产秘密审计 |
| 两仓库 diff 空白检查 | 通过 |

后端覆盖实际 ASGI 提交 → 新执行器/worker/规则 → 完成引用，包括 acquisition、first_service、after_acquisition 三条内部路径；SQL RPC 使用 MockTransport、Redis 使用 fakeredis。数据库测试使用隔离 PGlite，不是原生 PostgreSQL 多连接竞争验收。时效测试使用真实短期过期等待，不修改不可变来源模拟过期。

浏览器回归只证明旧获客与服务流程未回归；新 owner 页面通过读取/投影测试和生产编译，尚未进行新报告实页多视口或新付费流程浏览器验收。本轮未重跑 PDF 视觉检查，未执行真实 OAuth/provider、真实 Redis 重启或生产数据库迁移。

## 基线与发布边界

- FE HEAD：`88890cd484ad1a5f9294b1f21bb5a47bc27f5b7a`；BE HEAD：`9bf2090b91d5ee036f8ea7e470797761b8cf838c`。未创建提交。
- 开始快照：`/Users/liuyun3/Documents/SearchTurst前后端/.v22-capability-baselines/baseline-V7D0AH`；manifest SHA-256：`cd15fe9649ffe64b846d4b9afd9e095257c5995e209ef3d83cd0343306b87607`。FE 捕获 197 / 排除 33，BE 捕获 74 / 排除 0；保留既有未提交修改。
- 收尾快照：`/Users/liuyun3/Documents/SearchTurst前后端/.v22-capability-baselines/baseline-CYqiZk`；manifest SHA-256：`690d4f60f40c986e48226e24d35a6a2ed8c0f2e9e72d8832f0f004f384974194`。FE 捕获 213 / 排除 33，BE 捕获 80 / 排除 0；快照已包含实现和本轮记录，仅此快照说明行在捕获后补记。
- 本批增加一个本地源迁移，总数 43；只在隔离测试执行，未查询或应用远程迁移。
- 实际读取的 FE `V22_CAPABILITY_DISPATCH_ENABLED` 与 BE `V22_CAPABILITY_EXECUTION_ENABLED` 均为 false。没有修改开关、部署、真实付款或收费 provider 调用。
- 正常零行动交付消耗 1 点，不返还；技术失败补偿一次；幂等重放不新增收费。

## 尚未完成及下一步

1. 新建分析仍走旧链。需将业务确认、一次点数预留、合格来源采集/复用、manifest 准备和本批提交路由接成真实入口；准备失败且尚无 manifest 的补偿需要一并设计实现。
2. 首次服务用户入口及收费 UI 尚未开放；内部 first_service 测试不等于该产品流程已交付。
3. 新版 owner 编辑、保存/批准 API 与页面挂载、统一批准版 PDF 下载及固定分享尚未接通。现有编辑/渲染模块不能当作在线出口。
4. Case 报告列表及最新报告索引仍待接入。普通 GET 状态仍依赖 Redis；SQL 完成且 Redis 不可用的恢复目前通过重新提交同一任务实现，不宣称所有查询自动恢复。
5. 巡检随默认关闭的新执行 readiness 注入。真实放量前需完成排空/恢复策略、原生并发、真实授权及整链路验收；关闭开关不会自动退款。

## 本轮审视

- 修复了“登记成功但未入队”的重放缺口；没有用重置截止时间、代次或成本预算换取重试成功。
- 到期补偿保留原真实尝试数，避免给未执行任务伪造一次运行；正式完成的零行动报告始终受保护。
- 本轮重点是准备完成之后的运行链和报告读取，不扩大为新收费入口已完成。后续应优先完成准备阶段与用户入口，再验收编辑及客户交付出口。
