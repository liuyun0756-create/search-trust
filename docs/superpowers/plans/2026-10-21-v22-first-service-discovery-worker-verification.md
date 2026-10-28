# P3 首次服务竞品发现后台执行与恢复验证

日期：2026-10-21。接续已批准方案，仅完成首次发现的后台接线，不是 P3 整体完成。设计见 [后台接线设计](../specs/2026-10-21-v22-first-service-discovery-worker-design.md)。

## 本批实现

- 新迁移 `20261021210000_dispatch_v22_first_service_discovery.sql`：服务角色专用扫描、一次性派发标记、SQL 互斥租约、90 秒续期、最多三次执行及原 20 分钟期限。执行前重新核对 Case 身份、服务、地区及原 GSC/GA4 来源权限；浏览器角色没有执行权，服务角色不能直接修改运行表。
- 后台定时扫描已预留的首次服务发现请求，使用固定逻辑任务和独立物理队列。首次派发响应不明或已登记 Redis 状态丢失时不重建任务，原期限负责技术结算；已存在但未入队/中断的任务可以重新派发。
- 复用实际竞品发现服务、候选排序、共享市场缓存和检查点。使用独立 Redis 前缀，旧获客恢复器不会领取这些任务；正式首次服务采集验证器使用同一发现仓储，获客验证器保持原仓储。
- 原成本账本持续存在才允许重试；首次初始化后，通用发现 worker 也以 require-existing 方式读取该账本，防止检查与执行之间的数据丢失重置预算。原通用 worker 的默认行为不变。
- 执行期间维护 SQL 租约，心跳失败/不确定、期限届满或取消时终止受管采集。结果入库前检查实际后台状态中的请求摘要、Case、发现 ID、输入摘要、有效期及真实共享市场快照引用，不接受浏览器提供的结果。
- 明确技术失败使用既有一次返还 RPC；网络状态不明不会被转成失败退款。成功发现但零合格候选仍登记结果等待补充，不当成技术失败；成功后不再扫描，人工确认等待不受原发现技术期限扣回。正常完成零行动诊断仍消耗一点、不返还。
- 新 `V22_FIRST_SERVICE_DISCOVERY_ENABLED` 默认 false，并依赖既有能力执行与真实采集器就绪。没有修改实际环境开关、开放新 UI/API、远程迁移、部署或提交代码。

## 验证结果

- 加载全部 55 个真实迁移的隔离 PGlite 测试：首次服务 55 项通过。本批新增派发一次/重复返回、互斥与过期接管、旧令牌拒绝、三次上限、来源授权失效不运行、浏览器权限、技术超时仅返一次、结果入库后停跑及人工等待不退款。
- 新后台发现测试 25 项通过，运行真实仓储、发现 worker、发现服务和候选排序；外部来源受控，SQL HTTP 为模拟传输。覆盖丢派发/队列/结果响应、状态丢失、成本账本丢失、真实缓存恢复、三次耗尽、零候选、错误身份/来源/有效期、失去心跳/期限/取消及默认禁跑。
- 新发现与既有通用 worker、能力启动定向回归合计 50 项通过。启动矩阵增加 4 个组合，确认仅三个条件同时满足才安装协调器，且两个业务路径的发现仓储分离。
- 后端完整 fast 回归：2,183 项通过，23 项真实 Redis 集成测试按既有标记排除。
- 前端完整回归：161 个文件、1,665 项通过；类型检查和生产构建通过。
- 浏览器回归：9 项通过，包括桌面/移动首次服务免费准备页、隔离 SQL 驱动修订/批准/分享、零行动诊断、旧报告和分享。它们不证明首次服务付费发现 UI 已接通。
- 安全扫描：50 文件、0 findings；`secretValuesChecked=0`，不代表真实凭据集合已审计。双仓库 diff 空白检查通过。

复现命令：

```sh
# FE
npm test -- --reporter=dot --silent
npm run typecheck
npm run build
npx playwright test e2e/first-service-preparation.spec.ts e2e/capability-database-journey.spec.ts e2e/prospect-report.spec.ts e2e/report-sharing.spec.ts e2e/capability-share.spec.ts --workers=2
npm run security:scan
# BE
.venv/bin/python -m pytest tests/test_v22_first_service_discovery_worker.py tests/test_v22_capability_worker.py tests/test_v22_competitor_discovery_worker.py -q
.venv/bin/python -m pytest -m 'not redis_integration' -q --tb=short
```

本机 Python 环境未安装 Playwright，按网页测试技能的缺依赖回退使用项目既有 TypeScript Playwright 套件；没有安装新的依赖。构建和浏览器服务器串行执行，避免共享 `.next` 产物竞争。

## 剩余范围与边界

下一批接同一预留中的补充竞品与过期刷新，再接明确使用一点的公开首次服务确认流程。当前没有新的可点击付费入口，也没有完整首次服务浏览器端到端验收。

FakeRedis、PGlite 和模拟 HTTP 不等于原生 Redis/PostgreSQL 并发与 PostgREST 验收；本批未访问真实供应商、Google、客户数据或支付服务。部署时还需要迁移、配置、真实并发/故障与授权环境验收。P2 真实环境门槛和 P3–P6 未完成项继续保留。

## 工作区保护

开始基线：`/Users/liuyun3/Documents/SearchTurst前后端/.v22-capability-baselines/baseline-vZXliJ`，manifest SHA-256 `4eb4121da1f846b29b80179f4ac691f4622d4278859c082697aa742f8afeac71`。FE HEAD `88890cd484ad1a5f9294b1f21bb5a47bc27f5b7a`，BE HEAD `9bf2090b91d5ee036f8ea7e470797761b8cf838c`。保留全部既有修改，不 reset、不提交。

结束基线：`/Users/liuyun3/Documents/SearchTurst前后端/.v22-capability-baselines/baseline-3M1P5q`，manifest SHA-256 `2f45002a742594cd6ae5d1d15ac41aca4cda00181a200e5cba8a3843bae3b859`。FE 捕获 312 / 排除 33，BE 捕获 103 / 排除 0。逐文件哈希比较只有本批 FE 6 文件（迁移、SQL 测试及四份文档）、BE 7 文件（两内部模块、两测试、三个接线文件）变化；无其他捕获文件变化。本段为结束快照后唯一补录。
