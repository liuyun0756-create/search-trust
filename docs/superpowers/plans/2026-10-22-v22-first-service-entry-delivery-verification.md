# 首次服务：入口、采集队列、实际生成与交付的同库验证

日期：2026-10-22。本批隔离验收完成；未部署、未执行远程迁移、未启用实际入口或收费开关。P3 和总计划仍不整体关闭。

## 本轮结果

同一个 Case 内，从浏览器明确确认 1 点、选择竞品，到准备队列、公开来源组装、正式生成任务、原子结算，再进入报告批准、PDF 和客户分享。没有预先插入结果报告，没有中间 Prospect，没有更换数据库或任务。

沿用前两批真实入口和交付组件。测试种子只建立账户、客户、连接绑定和有效 GSC/GA4 合成快照；业务范围与任务由实际入口事务生成，公开快照由准备流程冻结。

实际路径：

1. FirstServiceEntry → 真实 handler/repository → 单次 verified 预留。
2. 真实发现仓储 claim/record + Redis 市场/发现缓存；候选结果是受控测试输出。
3. 浏览器确认三个候选 → 同一事务保存业务范围并登记采集任务。
4. 真实准备 reconciler 查询 SQL 待处理项 → 受控队列传输 → prepare_v22_first_service。
5. 真实 RedisDiscoveryVerifier、ProspectV22Executor.collect_confirmed_sources、输入适配器及 SQL 租约冻结；三个来源 stage 返回合成输出，禁止生成中间 Prospect。
6. V22JobRuntime.submit_capability → DurableJobStore → execute_v22_job → CapabilityV22Executor/实际规则 → SQL 完成事务。
7. 入口读取完成状态 → 点击 Open your diagnosis → 实际报告组件/编辑器/批准 → SEO PDF 与客户分享 PDF。

## 实际发现并修复的问题

入口直接将 SQL `now()` 写入业务范围 JSON。它输出会话时区偏移（如 `+08:00`，UTC 会话也是 `+00:00`），而 BusinessScope 契约要求 UTC `Z`。此前分段测试手工提供的 `Z` 时间掩盖了问题；完整链路使准备 worker 拒绝输入，无法继续。

新增迁移 `20261022090000_canonical_v22_scope_confirmation.sql`，仅替换首次服务确认和同样受影响的获客 intake 两个时间生成点：UTC、六位微秒、`Z`。保留授权、事务、幂等、原期限和收费逻辑，未修改 Python 校验规则。

不改写已经保存的业务范围或输入清单，以免破坏不可变历史及校验值。若将来检查到旧环境存在此类待处理记录，应单独核对并按恢复流程处理；本迁移不是历史数据修复脚本。

## 四项新增完整浏览器场景

| 场景 | 验证结果 |
| --- | --- |
| 正常有行动诊断 | 一次采集、一次冻结、一次完成，实际生成后可批准和交付 |
| 冻结事务已提交但响应丢失 | 再次扫描拿到 ready，恢复派发，不重新采集/冻结 |
| 零行动诊断、正式队列接受任务后响应丢失 | 恢复后两次物理投递只完成一次；诊断仍交付、扣 1 点、不返还 |
| 公开网站采集第一次暂时失败 | 原准备租约结束后由扫描恢复；网站重试一次，其余来源各一次；仍沿用原任务及截止时间 |

采集失败场景仅在隔离 SQL 中让测试租约过期，不修改原任务创建时间、截止时间、私有来源或已冻结结果；不是原生调度器的时序测试。

每项均断言：

- 只有一个服务任务、一次 `verified_debit=-1`，余额 5 → 4，没有返还或 Prospect 扣点。
- 报告 `first_service`、无父报告、六个来源引用，SQL 原始报告等于实际 worker 结果。
- 交接前后创建时间和截止时间不变；已冻结输入恢复不重新采集。
- 完成事务只调用一次，最终收费状态 consumed。
- 批准无需先编辑；SEO 下载和客户下载的内容校验值相同。
- 无外部浏览器请求、无页面脚本错误、无 SQL 错误。

原七项交付测试保留，继续覆盖有行动编辑/草稿/批准、完成响应丢失、零行动、旧分享固定版本、撤销、双标签冲突、保存与分享响应丢失、事务回滚和权限边界。

## 验证记录

- 前端 `npx vitest run`：166 文件，1,743 项通过。新增六项 SQL 回归覆盖首次服务/获客在 UTC、上海、洛杉矶时区的确认时间格式、时点有效性和幂等不改写。
- 后端 fast：2,201 项通过，23 项原生 Redis 测试未运行。新增三项测试检查合成来源生成不修改原快照、故障只发生一次。
- `npx playwright test --config=playwright.integration.config.ts --workers=2`：11 项通过，含本批四项完整场景。
- `npm run typecheck`、双仓库 `git diff --check` 通过。
- 原安全扫描：45 文件、0 findings；本批 integration-results/report 另行扫描：19 文件、0 findings。两者 secretValuesChecked 都为 0，不代表真实凭据审计；未上传任何产物。
- 未改营销页面、生产前端组件或构建配置；产品变更为 SQL 迁移，已在隔离库应用并执行，未重复运行 Next 发布构建。

本地 PDF、实际报告和调用记录保存在 `output/playwright/integration-results/`，可视测试报告在 `output/playwright/integration-report/index.html`。

## 范围与下一步

这是真实应用函数 + PGlite/FakeRedis + 受控队列/来源输出的组合验收，不等于线上完整服务验收。没有真实 Google 授权/同步、实际发现供应商/发现 worker 执行、付费采集、原生 Redis/PostgreSQL 并发、ARQ 调度/回调/成本 outbox 全流程或真实客户内容质量验收。浏览器从“已具备私有来源”的首次服务确认页开始，不包含前面的连接准备操作。

下一步优先验证原生服务中的租约并发与进程中断恢复，再在获授权的隔离账号/来源环境中验证连接、发现、采集及真实报告质量；同时按主计划继续后续实施记录与复核能力。不能把本批通过写成生产上线或整体完成。

本轮开始基线：`baseline-RxlFs3`，manifest SHA-256 `c855039a4c3f8ed72a474f96e391f0e53ee26c568badd8d582439f0eb0a62fd9`。保留原有脏工作区；不以整个 HEAD 差异充当本批变更清单。
