# 首次服务：实际生成到批准交付的隔离验收

日期：2026-10-22。阶段完成；不是完整入口到供应商的端到端验收，不是生产上线。

## 本轮结论

将实际 Python 服务报告生成器与前端真实 SQL 迁移、仓储、编辑器、批准、PDF 和客户分享连成同一份报告的隔离链路。此前浏览器交付测试使用预制的获客报告；本轮新增首次服务报告实际生成，不手写或复制生成结果。

链路：受控来源快照 → 首次服务预留事务 → 输入冻结仓储 → SQL 重建输入 → 实际执行器/规则生成 → 原子完成事务 → SEO 编辑/批准 → PDF 和分享。

同时保留旧交付测试，未修改任何生产入口、生成规则、数据库迁移、扣点政策或实际开关。

## 三种新增浏览器场景

1. 正常生成有行动报告：实际得到 3 条行动；保留 GSC 750、GA4 60 等来源值；编辑摘要、保存草稿、批准第 2 版、下载和分享。
2. 有行动报告完成事务提交后响应丢失：执行器重试读取已完成报告，不再次生成或调用完成事务；随后完成编辑/交付。
3. 无足够行动依据：实际生成零行动诊断，保留证据和限制；直接批准第 1 版，无需先编辑；响应丢失后仍可交付。

每个场景均断言：

- `first_service`、无父报告、无伪造历史变化。
- 开始事务重放仍只有一条 `verified_debit=-1`，余额从 5 到 4；没有 Prospect 扣点或返还。
- 完成事务只执行一次，最终状态 `consumed`；数据库原始报告等于实际生成器结果。
- PDF 的批准版本号正确；客户 PDF 与 SEO 下载具有相同内容校验值。
- 客户分享展示批准摘要；未发生外部浏览器请求或页面脚本错误。

旧四项浏览器测试继续覆盖：旧分享固定版本、新草稿不泄露、撤销、双标签页冲突、保存响应丢失、完成事务回滚、权限和分享创建响应丢失。

## 实现与边界

- `SearchTrust-RD/tests/support/first_service_delivery_bridge.py`：通过标准输入/输出 JSON 行与前端测试通信，调用真实输入仓储、执行器、规则、结果持久化；使用 FakeRedis 运行真实检查点代码。
- `e2e/integration/generated-first-service.ts`：只允许 prepare/resolve/complete 三个 RPC；以 service_role 运行实际 SQL。不给子进程继承真实服务密钥，没有网络监听器，60 秒超时并清理子进程。
- `e2e/integration/capability-database.ts`：允许已生成报告及其数据库接入原交付验收，不重新创建或替换报告；旧预制获客报告场景不变。
- `playwright.integration.config.ts`：只运行完全拦截请求的数据库交付测试，不启动 Next 预览服务器。

联调暴露的测试适配问题已经修正：不能让 JavaScript 中转把封存 JSON 中的 `1.0` 重写为 `1`。私有来源以原始 JSON 文本入库；SQL resolver 也以 JSON 文本交给 Python，保持原始数字表达和来源校验值。没有放松生产校验或改写已封存来源来适配测试。

不在本轮覆盖范围：竞品发现、公开/私有供应商实际请求、浏览器首次服务入口到准备 worker 的同一链路、ARQ 调度、原生 Redis/PostgreSQL 并发、真实账号和客户质量验收。来源是合成数据；PGlite/FakeRedis 不是生产服务。此次不修改页面文案或承诺。

## 验证

- `npx playwright test --config=playwright.integration.config.ts --workers=2`：7 项通过，含 3 项新增实际生成场景。
- `npx vitest run`：166 文件、1,737 项通过。
- 后端 `python -m pytest -m 'not redis_integration' -q --tb=short`：2,198 项通过、23 项原生 Redis 测试未运行。
- 新增来源夹具测试 2 项通过，实际生成、无来源修改、无父报告和评估时点均核验。
- `npm run typecheck` 通过；双仓库 `git diff --check` 通过。
- `npm run security:scan`：45 个文件、0 findings；`secretValuesChecked=0`，不代表真实凭据审计。
- 没有生产源码改动，不重复运行发布构建。初次使用普通浏览器配置时预览服务器启动未能完成；独立配置不依赖该服务，不能据此声称预览问题已修复。

PDF 和生成报告 JSON 附件：`output/playwright/integration-results/`；可视测试报告：`output/playwright/integration-report/index.html`。只含本地合成数据。

## 下一步

把已验收的首次服务 UI/确认事务、来源准备 worker 与本轮生成/交付桥接到同一 Case、同一次预留、同一任务；进一步验证采集失败、队列交接响应丢失和恢复。然后才进入获授权的真实来源与原生服务验收。P3 和总计划仍不整体关闭，未部署、未远程迁移、未启用真实收费。

本轮基线：`baseline-IBOEWn`，manifest SHA-256 `1b4097a21eeec783eee0c9920e2555bbe83a39c930d8663c7c6d4090bb2cb0ad`。现有脏工作区按基线保留，不以 HEAD 差异冒充本轮改动。
