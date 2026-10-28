# P2 接续：获客来源准备与准备中断恢复

日期：2026-10-21。本轮实现内部准备协调器与隔离验证；未开放新的用户入口、未部署，不等于 P2 或新版全流程完成。

## 本轮完成

1. 对已预留一点的获客任务登记不可变准备记录，固定 owner、Case、原任务/幂等键、已确认业务版本和完整发现关联请求。登记不新增扣点，也不修改原截止时间。
2. 将原获客执行器的采集步骤提取为 `collect_sources`。旧执行仍调用同样采集步骤，再生成和保存旧报告；新准备协调器仅调用采集步骤，不先生成一份旧报告。
3. 采集结果绑定器把实际采集模型组装为新版 manifest 与完整生成输入。校验客户网站、已确认竞品、发现关联、查询/地区、公共 GBP 身份与来源时间；不修改原快照。
4. 无来源有效期的 site/competitor 只接受本任务开始后采集的来源，并保守使用原任务 deadline 作为本次资格截止。SERP/公共 GBP 保留自身有效期；不能给历史快照换时间冒充新来源。评估时间由固定输入决定，不因重试改变摘要。
5. SQL 准备已提交而响应丢失时，下一次登记返回已准备 dispatch，跳过再次采集/准备。网络异常不直接退款；SQL 成本已记录但操作账本丢失时，不重建空预算重新采集。
6. 原数据库截止时间巡检包含已登记但尚未冻结 manifest 的任务，技术失败仍只补偿一次；不清理未登记的旧任务，正常零行动交付仍消耗 1 点。
7. 新触发器防止已登记任务接收旧报告、替换业务版本，或用不同查询/地区/竞品生成 recipe。

设计：[本轮设计及接续约束](../specs/2026-10-21-v22-capability-acquisition-preparation-design.md)。沿用已批准主计划，没有新增商业规则、供应商或采样预算。

## 文件与基线

- FE 新迁移：`supabase/migrations/20261021100000_record_v22_acquisition_preparation.sql`。源迁移总数 44；只在本地隔离 PGlite 执行，未应用远程数据库。
- FE 测试：`src/lib/database/v22Capability.test.ts`，新增登记/重放/隔离/补偿/旧报告拒绝用例。
- BE：`app/jobs_v22/capability_acquisition_input.py`、`capability_acquisition_preparation.py`；原 `executor.py` 提取采集接口。
- BE 测试：新增 `tests/test_v22_capability_acquisition_preparation.py`；修正前批 `test_v22_capability_dispatch.py` 的成本账本用例数据，使其通过合法成本结构后再验证恢复保护。
- FE HEAD：`88890cd484ad1a5f9294b1f21bb5a47bc27f5b7a`；BE HEAD：`9bf2090b91d5ee036f8ea7e470797761b8cf838c`。未提交，保留其他既有修改。
- 开始快照：`/Users/liuyun3/Documents/SearchTurst前后端/.v22-capability-baselines/baseline-8AL4pA`，manifest SHA-256：`ecfac3228eab559c5f3d9a73f3dce6c2b0da7ed4e3dde71d4e71feddb4125550`。FE 捕获 213 / 排除 33，BE 捕获 80 / 排除 0。
- 收尾快照：`/Users/liuyun3/Documents/SearchTurst前后端/.v22-capability-baselines/baseline-sWQo7R`，manifest SHA-256：`9d6065fe70553be2081de6e554727bfc8476479595de5e5cbbda86789dc3e517`。FE 捕获 216 / 排除 33，BE 捕获 84 / 排除 0；本行在快照后补记，其他本轮实现及记录已捕获。

## 验证

| 检查 | 结果 |
| --- | --- |
| FE 全量 | 145 文件，1,427 项通过 |
| FE 数据库能力测试 | 74 项，计入全量；本批新增 13 项 |
| FE 类型检查 | 通过 |
| BE 新准备 + 已有提交定向 | 52 项通过；其中新准备 31 项 |
| 旧采集执行器及报告 pipeline 定向 | 3 项通过 |
| BE 全量 fast | 2,074 项通过，23 项 Redis 集成未纳入 |
| 契约一致性 | 20 配套契约 / 6 runtime / 10 实际规则 QA 产物，双端 --check 通过 |
| 配置产物扫描 | 42 个文件，0 发现，secretValuesChecked=0；不是整个仓库或生产秘密审计 |
| 实际功能开关 | FE dispatch=false；BE capability execution=false |
| 两仓库 diff 空白检查 | 通过 |

测试方法：SQL 使用 PGlite；RPC 使用 MockTransport；采集协调调用真实 `collect_sources`，其底层采集 I/O 返回严格合成快照，未调用真实网站、Google 授权或收费供应商。使用真实规则生成并检查产物，不使用手写报告替代生成结果。

产物检查：无行动样本保留已检查内容与限制、`insufficient_basis` 及一次分析消费规则；HTTP 503 样本显示具体目标 URL、保存的响应值和响应/索引检查材料，没有把一次采集异常写成永久故障或收入损失。材料不编造业务承诺。

本轮没有修改页面布局或交互，未重跑浏览器/多视口/PDF 视觉与前端生产构建；前端类型和全量测试通过不代替新入口浏览器验收。未运行真实 Redis 重启、原生 PostgreSQL 多连接及发布门槛。

## 尚待接入

- 新建分析 UI/owner 路由的业务确认、原子预留与登记；未登记之前的失败补偿仍需覆盖。
- 独立准备 worker 的租约、超时、成本回调与正式执行队列衔接。协调器当前没有注入生产 worker，不得只打开上一批开关就宣称流程已上线。
- 跨 Case 缓存来源的安全持久化、Case 报告索引、新编辑/批准接口与界面、统一 PDF/固定分享。
- 首次服务入口及 P3–P6 未在本轮完成。默认关闭的新巡检仍需要发布前排空/恢复策略，不能把关闭开关当成自动返还。

## 本轮审视

调查技能帮助明确了两个真实缺口：冻结前中断不在旧恢复范围内、原采集器和新版生成输入缺少衔接。本轮只补对应内部边界，没有借机切换旧入口或扩大收费行为。

验证中修正了测试自身的问题：不能删除不可变账本来模拟缺少扣点，改用一开始就缺少记录的 fixture；成本恢复必须使用完整合法计数结构，避免只测到结构拒绝而误报恢复分支已覆盖。后续重点是准备阶段队列与用户入口的完整衔接，而非继续增加不挂载的组件。
