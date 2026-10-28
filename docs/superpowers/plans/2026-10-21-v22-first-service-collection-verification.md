# P3 首次服务公开证据准备 / 队列验证

日期：2026-10-21。继续已批准计划，不是 P3 整阶段完成。设计见 [首次服务采集设计](../specs/2026-10-21-v22-first-service-collection-design.md)。

## 实际实现

- 新增独立采集意图契约：没有 report_type、父报告或调用者传入的私有数据。数据库要求已存在、已预留 verified 点数的首次服务任务，固定完整请求及 canonical 校验值；不新增扣点接口。
- 新增 `begin_v22_first_service_collection`：核验 owner/Case/业务版本/身份/地区/竞品、原任务和当前 GSC/GA4 授权，从首次启动记录返回原有两份私有快照。不自动改用新的快照。
- 复用真实竞品发现校验与网站/竞品/公开 GBP 来源采集入口，保留原共享市场及 Case-local 绑定，不执行 Prospect 报告流水线。网站采集器显式支持无报告的公开采集请求；本批不新增 GSC 爬取排序算法。
- 将四份公开来源与两份已授权私有来源组装为 first_service 清单，运行现有服务和跨来源规则；无 previous_report/parent_report、版本 1、不伪造变化比较。公共子模型仍沿用既有公开规则 context，不代表生成 Prospect 报告。
- 独立物理队列、SQL 租约、运行代数和检查点命名空间。采集与正式生成共用一个任务、原截止时间、成本账本和尝试预算。旧令牌/过期租约不能冻结来源；交接不确定时从 ready 派发恢复，不重采、不重复收费。
- Worker 仅在既有 capability 与采集依赖就绪时安装 preparer；没有可用依赖时不退回旧执行器。没有启用任何开关，没有新增公开路由。
- 既有期限恢复包含采集中任务；技术失败补偿一次。正常完成的零行动首次诊断仍消费 1 点，不返还。

## 迁移与测试

新增本地迁移：

- `20261021170000_prepare_v22_first_service_collection.sql`
- `20261021180000_queue_v22_first_service_collection.sql`

隔离 PGlite 执行全部 52 个实际迁移。首次服务 SQL 测试由 24 项增至 33 项，新增覆盖原来源固定、重复登记、不同意图/owner 拒绝、授权失效回滚、租约竞争/过期接管/旧令牌、未领取时冻结阻断、冻结后的 ready 恢复、完成后断开来源仍可恢复、查询词 recipe 偷换回滚、处理中超时补偿、浏览器角色拒绝及不可变准备记录。

后端新增 39 项测试，覆盖真实来源适配器和服务规则、真实采集协调器、网站采集检查点恢复、严格输入/回执、错误来源/期限/代数/预算/发现、SQL 租约交接的模拟传输、真实正式任务运行时入队、丢失冻结/交接响应、账本丢失不重置、取消采集、失效队列消息和默认关闭。

前端完整测试：154 个文件、1,593 项通过。类型检查、生产构建通过。7 项既有浏览器报告交付回归通过，其中数据库驱动测试加载全部 52 个迁移；未增加首次服务 UI，不能据此声称首次服务页面验收通过。安全扫描 41 个文件、0 finding、secretValuesChecked=0；不代表生产密钥审计。两仓库 diff 空白检查通过。

后端完整 fast 回归：2,154 项通过；23 项需要真实 Redis 的集成测试不在本地 fast 范围内。新增首次服务后端测试 39 项，与既有获客和网站采集相关的定向回归合计 87 项通过。

复现：

```sh
# FE
npm test -- --reporter=dot --silent
npm run typecheck
npm run build
npx playwright test e2e/capability-database-journey.spec.ts e2e/prospect-report.spec.ts e2e/report-sharing.spec.ts e2e/capability-share.spec.ts --workers=2
npm run security:scan
# BE
.venv/bin/python -m pytest -m 'not redis_integration' -q --tb=short
```

## 发现并修复

检查实际网站采集器发现它还读取旧 request.first_party_snapshots；增加显式 first-service 分支和实际网站采集器测试，避免仅在替身采集器上通过。新测试初跑还暴露严格 UUID 输入、不可直接序列化的模型数组、网站测试配置缺字段和 TypeScript UUID 类型问题，均修正测试构造；未降低生产输入校验。

## 保留边界 / 下一项

内部入口要求一份真实、已确认且有效的竞品发现。首次服务的新发现准备入口、扣点前完整请求校验、与唯一服务预留的衔接仍需接入；不能直接使用会另预留 Prospect 点数的旧公开发现入口。接下来同时处理已有 Case/新增客户、连接中心 first_service 模式、用户明确确认“使用 1 点”及浏览器恢复，再做整条直接服务验收。

本地测试使用合成来源、受控供应商替身、fakeredis 和 PGlite；没有真实 Google 抓取、原生 PostgreSQL 多连接锁竞争、真实 Redis 故障或生产认证验收。没有提交代码、远程执行迁移、部署或开放产品入口；P2 真实环境门槛及 P3–P6 剩余事项继续保留。

## 变更保护

开始基线：`/Users/liuyun3/Documents/SearchTurst前后端/.v22-capability-baselines/baseline-eT9qLZ`，摘要 `9b5b1641e9a0793b6c218961f0c64fc4463fa955677bd498c9a5716b4b5f0ce6`。FE HEAD `88890cd484ad1a5f9294b1f21bb5a47bc27f5b7a`；BE HEAD `9bf2090b91d5ee036f8ea7e470797761b8cf838c`。保留既有大量未提交改动。

结束基线：`/Users/liuyun3/Documents/SearchTurst前后端/.v22-capability-baselines/baseline-aCisyM`，摘要 `195edf9e6325e8f7214f3f48dd11016d6769bf3ea8bbb0b37273b187694afb97`。哈希比较仅 FE 7 文件（2 迁移、1 数据库测试、设计/本记录/主计划/台账）及 BE 10 文件（2 新内部模块、2 新测试、6 采集/队列接线文件）变化；没有其他捕获文件变化。本段为捕获后唯一补录。
