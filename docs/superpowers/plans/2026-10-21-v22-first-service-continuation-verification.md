# P3 同点数补充竞品与过期刷新验证

日期：2026-10-21。接续已批准的首次服务发现后台方案；设计见 [续接设计](../specs/2026-10-21-v22-first-service-discovery-continuation-design.md)。本批不开放新付费 UI/API，不部署。

## 本批实现

- 第 56 个迁移 `20261021220000_continue_v22_first_service_discovery.sql` 增加内部续接事务、不可变历史和当前发现状态查询。每轮保存旧请求/结果，以新发现 ID 执行；原工作流、扣点和初始发现 ID 不改变。
- 补充允许 1–3 个不同站点；刷新仅允许已过期结果，沿用原补充列表。均只能接续已保存结果，不能替换进行中的任务或延长其时限。原有市场可见候选核验仍生效，不保证任意输入网址可成为竞品。
- 原请求精确重放返回初始身份和当前指针；续接键绑定完整意图，重复点击不新执行、不新扣点。同键不同输入、旧页面、旧结果、旧失败和旧租约不能覆盖/退还新一轮。源权限、业务身份及当前 GSC/GA4 快照在续接时重新核验。
- 每轮固定 20 分钟技术期限，但 SQL 三次执行总上限不清零。所有轮使用初始发现成本账本和累计供应商上限，账本丢失不能重建。累计成本摘要按原 ID 和单调账本版本更新，避免累计值重复统计。
- 有效市场结果用于补充；过期后重新采集，仍受原预算约束。最新状态区分需要补充、可以确认、结果过期及报告阶段，不用初始回执冒充当前有效结果。
- 技术失败仅补偿原工作流一次。人工等待、零候选发现与零行动诊断分别处理；正常完成零行动报告消耗 1 点、不返还。

## 本地验证

- 隔离 PGlite 加载全部 56 个迁移：首次服务 62 项通过，其中新增 7 项覆盖精确重放、过期刷新、历史不可改、浏览器撤权、来源更新/撤权、旧回调隔离、总尝试上限、一次返还及零行动单次消费。
- 新服务端续接仓储 18 项通过；与 SQL 定向测试合计 80 项。回执严格校验身份和状态，仅读取允许字段，不转发私有快照或原始数据库错误。
- 后端新增 4 项，首次服务发现测试共 29 项；与既有发现和能力启动定向回归合计 54 项通过。真实发现服务/仓储搭配受控来源，验证补充复用缓存、过期重新采集、共享账本、最后一次执行不重置重试额度、账本丢失不重建和预算拒绝。
- 前端全量：162 个文件、1,690 项通过。修正新增测试 UUID 字段的过窄推断后，类型检查和生产构建通过。
- 后端 fast 全量：2,187 项通过，23 项真实 Redis 集成测试按既有标记排除。
- 浏览器回归 9 项通过：桌面/移动免费准备、SQL 驱动编辑/批准/分享、零行动诊断、旧报告及分享。它们不证明新的付费续接页面已实现。本机 Python Playwright 缺失，按网页测试技能的回退原则使用项目既有 TypeScript 套件，未安装依赖；构建和浏览器测试串行执行。
- 安全扫描：50 文件、0 findings；`secretValuesChecked=0`，不代表真实凭据集合已审计。双仓库 diff 空白检查通过。

复现：

```sh
# FE
npx vitest run src/lib/report-capability/first-service-continuation.test.ts src/lib/database/v22FirstService.test.ts
npm test -- --reporter=dot --silent
npm run typecheck
npm run build
npx playwright test e2e/first-service-preparation.spec.ts e2e/capability-database-journey.spec.ts e2e/prospect-report.spec.ts e2e/report-sharing.spec.ts e2e/capability-share.spec.ts --workers=2
npm run security:scan
# BE
.venv/bin/python -m pytest tests/test_v22_first_service_discovery_worker.py tests/test_v22_competitor_discovery_worker.py tests/test_v22_capability_worker.py -q
.venv/bin/python -m pytest -m 'not redis_integration' -q --tb=short
```

## 剩余边界

下一步接公开首次服务的明确一点确认、状态恢复和竞品确认页面；三次执行用尽但仍不能确认时，需要明确展示阻断与处理方式，不能自动新增扣点或伪造技术失败退款。市场候选限制也需如实说明。

原成本账本有保留期限（当前默认 7 天，配置可调整）；丢失或过期后不重建预算。后续公开入口需要处理这种不可继续状态，不应承诺无限期免费刷新。本批没有改变原保留策略。

FakeRedis、PGlite、模拟 HTTP 和合成数据不等于原生 Redis/PostgreSQL 并发、真实供应商、Google、身份、支付或完整付费浏览器验收。实际环境开关未改，无远程迁移、部署或提交；P2 真实环境门槛及 P3–P6 未完成项继续保留。

## 工作区保护

开始基线：`/Users/liuyun3/Documents/SearchTurst前后端/.v22-capability-baselines/baseline-drbpQW`，manifest SHA-256 `f50fae2478799eb6907930e85a7800e7533046d338be9a195fddf288e463e92d`。FE HEAD `88890cd484ad1a5f9294b1f21bb5a47bc27f5b7a`；BE HEAD `9bf2090b91d5ee036f8ea7e470797761b8cf838c`。保留既有工作区修改，不 reset、不提交。

结束基线：`/Users/liuyun3/Documents/SearchTurst前后端/.v22-capability-baselines/baseline-3C2EpV`，manifest SHA-256 `e151d56d972ddae9d4326d3edbcc1df0c071f495ca42db8c86bb45eba236cb5f`。FE 捕获 317 / 排除 33，BE 捕获 103 / 排除 0。与开始快照逐文件哈希比较，仅本批 FE 9 文件（四份文档、迁移、SQL 测试、原仓储及新仓储/测试）、BE 4 文件（三个内部模块及测试）改变；其他捕获文件无变化。本段是结束快照后的唯一补录。
