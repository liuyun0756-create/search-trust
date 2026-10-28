# v2.2 能力补齐 P0 — 本地验收记录

日期：2026-10-19（Asia/Shanghai）。状态：**P0 本地工作完成；质量目标供审阅；P1 契约与 D1 待确认。未部署。**

后续决策注记（2026-10-20）：用户已确认 D1——零行动诊断仍交付，消耗 1 点、不返还；技术失败原规则不变。主执行文档、能力台账和 Q16 目标已同步。下文保留 10 月 19 日的验收历史，原“D1 未决”描述不再代表当前决策状态；P1 功能尚未实现或验收。

依据：[执行主文档](./2026-10-13-v22-product-capability-completion-execution-plan.md) §14，第一批只启动 P0。此次没有实现或宣传 P1–P6 新功能，没有付款、收费分析、远程迁移、自动提交或部署。

## 1. 仓库与恢复基线（P0-01）

| 项目 | FE | BE |
| --- | --- | --- |
| 仓库 | `search-trust` | `SearchTrust-RD` |
| 分支 | `main` | `main` |
| HEAD | `88890cd484ad1a5f9294b1f21bb5a47bc27f5b7a` | `9bf2090b91d5ee036f8ea7e470797761b8cf838c` |
| 源码版本 | package 0.1.0；报告契约 2.2.1 | APP_VERSION 默认 1.0.0；报告契约 2.2.1 |
| 运行工具 | Node 26.0.0；Next 16.2.4；React 19.2.5；TS 6.0.3；Vitest 4.1.11；Playwright 1.63.0 | Python 3.12.14；FastAPI 0.115.5；Pydantic 2.10.3；orjson 3.10.12；pytest 8.3.5 |
| 原有改动 | 既有网站/报告/Pricing 等大量未提交改动，完整清单在基线 manifest | 原有一份未跟踪的 2026-09-20 方法模块 spec |
| 本轮迁移 | 无 | 无 |

可恢复源码基线位于仓库外：

`/Users/liuyun3/Documents/SearchTurst前后端/.v22-capability-baselines/initial-2026-10-19/`

- `manifest.json`：完整 `git status --short --untracked-files=all`、分支、提交、文件 SHA-256、迁移文件列表。
- manifest SHA-256：`5b5cd6db78ecd6e5069160ba69298cf5725526cd3ea7a87d65c0d6ccbb90a288`。
- `FE/files/`、`BE/files/`：115 + 1 份源码/文档快照，均重新核对 SHA-256 通过。FE 数量包括本轮刚创建的基线脚本；随后有意修改的已捕获文件只有该脚本和主执行文档的进展注记，其余原有文件内容未变。
- `FE/tracked.patch`、`BE/tracked.patch`：相对指定 HEAD 的工作区差异；未修改 Git index。
- 33 个既有生成输出文件未复制，路径和排除状态仍在 manifest；原位置未被清理。敏感/环境文件不复制。本快照不是全仓库或数据库备份。
- 初始快照在临时目录创建，随后迁至上述持久本地位置；manifest 中的 `destination` 保留原临时路径以维持原始校验值。读取时以上述位置为准。
- 原样恢复必须逐文件比较，不能 `reset --hard` 或覆盖后续工作。旧提交保存未变源码，快照补充用户未提交内容。新增 `scripts/capture-v22-capability-baseline.mjs` 可生成后续独立快照，不覆盖本次基线。

### 环境与功能开关

- 开始检查时本地 TCP 3100/8000 均无监听。浏览器回归由 Playwright 启动 `127.0.0.1:3100`，使用本地测试身份/API 桩与外部请求拦截；完成后测试服务退出。不声称真实服务端分析已运行。
- FE shell 及所检查 `.env.local` 未设置本次白名单中的开关；公开入口和 Google 功能在未配置条件下默认关闭。BE 所检查根目录无 `.env`/`.env.local` 配置；源码的分析/同步/预检/竞品发现开关默认 false，Firecrawl inventory 子开关默认 true，不能据此推断分析入口已开启。
- Playwright 显式开启本地测试模式、公开入口及 Google 测试开关；`VERCEL_ENV` 置空，不代表生产配置。
- 数据库测试使用新建的本地内存 PGlite；后端 fast 禁止网络 socket，Redis 集成被排除。
- 源码含 38 个迁移，最新 `20260927100000_add_v22_delivery_plan_versions.sql`。**生产/远程实际已应用版本未知**。未执行远程 migration 或历史 `reset_prelaunch_data`；历史迁移仅进入隔离 PGlite 测试。
- 生产入口、部署提交、worker 版本、开关及真实付款均未核验。未加载或打印生产凭据；不能用历史上线记录充当本轮验收。

## 2. 摘要问题：复现 → 双端计算 → 修复（P0-02）

初始 BE fast 结果：`1 failed, 1821 passed, 23 deselected`。唯一失败为 `test_verified_digest_matches_modified_schema_valid_frontend_prospect` 的旧固定预期。

确认两个 `prospect.json` 文件字节一致，其文件 SHA-256 均为：

`6165f8537156b027c8e9f811ccb42e044409ceee9b1c9ebd9b4c3b14211e88c7`

直接执行 FE `canonicalDigest` 与 BE `verified_request_digest`，结果一致：

| 输入 | 双端结果（sha256） |
| --- | --- |
| 完整 Prospect | `0a093496b57a559ebed6660245eec41bac828cae11fc0c45473447ee668bde7a` |
| 同一完整样本的三处坐标修改（1、-0、1e-6） | `5af54f0bb6d3391f48790d0066edf968951657b44bc85f90f43379d38f059f06` |
| 数字样式键 + BMP/补充字符 + 有序数组 | `715e9d7ff4a22b4952be8ac184d8c626c4ddb71f53bc3538b9c80843e50897b4` |

实际改动：

- BE 只更新旧测试预期；新增完整样本验证及 UTF-16 顺序固定摘要。
- FE 增加 UTF-16 摘要对照和后端已有的六项数值边界；原数组顺序、非 JSON、循环拒绝等测试保留。
- 两端生产摘要算法、持久化任务身份、旧 checkpoint 编码均未修改。
- 4 份共享契约文件（API/schema/两个完整报告）逐字节比较一致；没有重新生成或改动契约。

## 3. 能力台账与固定验收目标（P0-03）

交付：[能力台账与质量标尺](./2026-10-19-v22-capability-ledger.md)。它逐条记录“代码已存在 / 本地验证 / 已部署 / 真实验收”，附源码/测试锚点，以及自动、人工确认、后续新增、不在范围的分类。

固定样例：

- `../fixtures/v22-capability-p0/acceptance-cases.json`：Q01–Q16，共 **46 个固定输入/预期变体**，包括缺失/冲突/零分母/权限/失败/幂等/并发/不凑数等边界。
- `prospect-target.json`：公共证据、现有服务页、明确下一步和有条件的客户沟通。
- `first-service-target.json`：无需 Prospect 的首次服务目标；当前公开+授权来源，1 点目标，无隐藏 Prospect，两个有依据行动，可原样批准。
- `implementation-review-target.json`：实施记录修订、两个完整 28 天窗口、差值和复核检查；资格规则尚待 P5，效果结论为空，不归因。
- `src/lib/report-v22/capability-targets.test.ts`：8 项**目标文件完整性**检查；来源引用同 Case、时间、行动材料、窗口算术、批准版本、D1 未决等。不是 8 项未来产品能力验收。

八项质量维度已逐条人工阅读核对：对象、事实、判断、行动、材料、完成条件、限制、可选编辑。目标里不提供真实客户结果，不替代运行时契约；所有未来验收状态明确为 `target_not_yet_accepted`。没有把“固定样本通过完整性测试”写成“新业务功能已经通过验收”。

## 4. 自动化结果

| 命令/检查 | 当前结果 |
| --- | --- |
| FE `npm run typecheck` | 通过 |
| FE `npm test` | 134 文件，1,214 项通过 |
| FE `npx vitest run src/lib/verified-analysis-v22/digest.test.ts` | 51 项通过 |
| FE `npm run test:contract` | 11 文件，254 项通过（含 8 项 P0 目标完整性检查） |
| FE `npm run test:database` | 隔离 PGlite，127 项通过 |
| FE `npm run test:e2e -- e2e/prospect-acquisition.spec.ts e2e/verified-upgrade.spec.ts e2e/report-sharing.spec.ts e2e/work-entry.spec.ts e2e/pricing-experience.spec.ts --workers=2` | 19 项通过，模拟身份/API，外部请求保护 |
| BE `.venv/bin/python -m pytest tests/test_v22_verified_digest.py tests/test_v22_job_digest.py -q --disable-socket --allow-unix-socket` | 32 项通过 |
| BE `.venv/bin/python scripts/run_v22_backend_quality.py fast` | 1,823 项通过，23 项 Redis 集成未运行 |
| FE `npm run security:scan` | `ok: true`，42 个现有静态/浏览器产物；0 个已配置秘密标记、0 命中；不是生产凭据泄漏审计 |
| 双端契约字节/备份 SHA/基础测试引用 | 4 份契约一致；116 份备份通过；16 个引用文件存在 |
| `node --check scripts/capture-v22-capability-baseline.mjs` | 通过 |
| 两仓库 `git diff --check` | 通过 |

所有命令计数存在交叉，不能相加作为独立覆盖数量。首次 FE 全量基线为 133 文件/1,199 项；增加 7 项摘要测试和 8 项目标完整性测试后是上述结果。

过程中发现备份目录若放在 FE 内会被 TypeScript 扫描；已将备份移到仓库外并改正目标测试引用路径，完整 typecheck/测试重新通过。未为绕过报错修改编译器配置。

本阶段无 UI 改动。沿用上述本地浏览器脚本覆盖移动端重排、键盘切换、任务/支付失败恢复及分享；不声称完成 P1–P5 尚不存在页面的多尺寸验收。测试报告在 `output/playwright/report/index.html`。已知 Node 实验性/弃用、NO_COLOR 及 Next smooth-scroll 提示未在本阶段重构。

未运行发布级 build、全部 E2E/paused E2E、BE Redis release 或真实第三方调用；本阶段仅测试/文档变更，无发布申请。之后发布仍需按主文档补全门槛。

## 5. 安全边界与后续门槛

- 未改变价格/赠送/扣点/返还、身份认证、所有权、支付、任务状态机和原始报告数据。
- 未申请真实 OAuth 授权、扣点、付款或模型/抓取调用；未创建生产报告。
- 不清理旧改动，不提交、不部署；前端原有未提交文件与后端旧 spec 均保留。
- P0 的改动可以单独回退：恢复两端 digest 测试至本阶段前内容，移除本阶段新增的目标/测试/台账/脚本；不要回退原有营销页面改动。无需数据库或账本回滚。

**下一步：先审阅 P1 契约，特别是 D1。** 若技术分析成功但没有足够依据提出行动，是否交付零行动诊断、是否结算 1 点，需要用户作商业决策。不能擅自认定为技术失败返还，也不能默认扣点。在确认前不开放该新增收费路径。

P0 的本地准备已完成；整个“产品能力补齐”项目尚未完成。直接服务、全文编辑和实施复核仍是后续阶段，不应据此修改网站可用能力声明。
