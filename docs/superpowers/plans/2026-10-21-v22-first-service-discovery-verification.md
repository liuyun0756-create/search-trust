# P3 首次服务发现预留与任务衔接验证

## 范围和状态

本批完成内部数据库和服务端仓储边界：在竞品发现前预留一次 verified 点数，发现成功后保存结果等待确认，再将同一次预留绑定到已有 first_service 采集/报告任务。没有创建额外 Prospect，没有放开页面付费按钮或增加公开 API。

设计见 [发现衔接设计](../specs/2026-10-21-v22-first-service-discovery-design.md)。这是 P3 的一批工作，不是整体首次服务已上线。

## 基线与改动

- 开始基线：`/Users/liuyun3/Documents/SearchTurst前后端/.v22-capability-baselines/baseline-caYTGZ`。
- 清单 SHA-256：`b1e3cefe93759d057fcb65fe53f92c486bd27064292942c1fc719d9411f3e4f1`。
- FE HEAD：`88890cd484ad1a5f9294b1f21bb5a47bc27f5b7a`；303 个已捕获脏文件、33 个排除项。
- BE HEAD：`9bf2090b91d5ee036f8ea7e470797761b8cf838c`；99 个已捕获脏文件、0 排除项。
- 本批不修改后端。历史脏改动保留；新增 2 个前端仓库 SQL 迁移，全部迁移共 54 个。
- 主要文件：`20261021190000_reserve_v22_first_service_discovery.sql`、`20261021200000_bind_v22_first_service_discovery.sql`、`first-service-discovery.ts` 及其测试、`v22FirstService.test.ts`；同步设计、主计划、能力台账及本记录。

## 已验证的行为

1. 无 Prospect、无 BusinessScope 版本、无分析任务的客户可以在内部准备事务完成资格检查后预留 verified 点数。保存发现请求和原始来源引用，不伪造竞品。
2. 相同请求恢复原预留；换 owner、Case、任务、幂等键或请求内容会被拒绝。余额不足、数据不健康/过期/错配、跨用户、并行 Prospect/服务流程不会另扣点。发现 ID 唯一约束失败时，账户和账本写入全部回滚。
3. 可信后台结果严格匹配发现/Case；重复登记不改写结果。迟到、过期、错配和无效结果不能进入生成。零候选单独为 needs_competitors，不冒充已交付诊断。
4. 确认有效候选后复用唯一预留；即使账户剩余点数已为零也不要求再买一点。正式启动前重新检查授权及最新私有快照，允许更新准备期间过期的数据；启动后固定来源不变。
5. 采集请求必须引用保存的发现、市场摘要及查询；不能换用另一份看似有效的发现。随后使用原采集租约/冻结/结算链路。
6. 隔离数据库完整执行预留、结果登记、确认、采集冻结和零行动报告完成；只有一条 verified_debit、没有 Prospect、没有技术返还。正常交付零行动诊断仍消耗 1 点。
7. 明确的技术失败，或到达准备截止时间仍未记录结果，最多返还一次；人工等待确认、已绑定分析或已完成报告不能通过准备阶段返还。正式分析的 20 分钟期限从确认后开始；后续任务超时仍只返还一次。未知 HTTP 状态不会被仓储自动转换成失败。
8. RPC 对 anon/authenticated 撤权；service_role 无表写入权限，必须经受限事务执行。回执采用字段白名单，不暴露私有来源内容。内部辅助函数不直接授权 service_role。

## 自动化验证

- `npm test`：161 个文件、1,662 项通过；相对上轮增加 40 项。
- `npm run typecheck`：通过。
- `npm run build`：通过。
- `npx playwright test e2e/first-service-preparation.spec.ts e2e/capability-database-journey.spec.ts e2e/prospect-report.spec.ts e2e/report-sharing.spec.ts e2e/capability-share.spec.ts --workers=2`：9 项通过，包括 1280/390px 准备页面、SQL 支持的交付修订/零行动/双标签页冲突/响应恢复，以及既有报告分享。
- `npm run security:scan`：50 个文件、0 个发现；`secretValuesChecked=0`，不能据此声称真实凭据集合已扫描。
- 定向检查无空白错误。未运行真实后端采集、Google/Clerk/支付/Redis、远程迁移或部署。

首次定向测试定位了超时查询的输出字段同名歧义，已限定表别名并复测。测试时钟和授权撤销样本也按既有数据库约束修正，未放松业务约束。后续类型检查修正了测试数据中 UUID 与摘要字段的联合类型赋值。最终全量测试通过。

浏览器测试沿用项目已有 TypeScript Playwright（当前 Python 环境没有 Playwright）；其中四项使用运行全部迁移的隔离 PGlite，其余使用受控接口。它们是既有页面/交付回归，不是新增付费发现入口的浏览器验收。

## 保留的门槛与下一步

- 目前首个服务发现只支持当前采集器的 mobile/en 默认条件；不会接收其他条件再静默转换。
- 首个发现、供应商任务状态和 SQL 登记之间的自动接线/恢复对账尚未连接；准备超时 RPC 已验证，但没有新增后台定时调用者。
- 同一次预留下的人工补充、过期结果重新发现需要专门协调；当前内部首个请求不接受补充网址，不可因此让用户重新购买 Prospect。
- 仍需付费确认 UI/API、真实发现结果核验调用、任务恢复状态与首次服务端到端验收。
- PGlite 验证了事务与权限语义，但不替代原生 PostgreSQL 多连接锁竞争验证。SQL 边界测试使用合成发现结果和来源，不是实际供应商抓取结果。
- 默认开关不变，无真实点数扣除，无外部付费请求、远程迁移或部署。P3 仍未整体完成。

## 结束快照

结束基线：`/Users/liuyun3/Documents/SearchTurst前后端/.v22-capability-baselines/baseline-HtsV7j`，清单 SHA-256 `32080c71aaf5d9f4040bb6089395bc1284682e0534682450c13b5a7b8062c086`。FE 309 个捕获文件 / 33 个排除项；BE 99 / 0。按开始、结束清单逐文件 SHA 比较，本批仅 FE 9 个文件变化，BE 0 个，均为上述实现、测试和文档。本段为快照生成后追加的元数据，不包含在该结束快照中；其余文件未在快照后修改。
