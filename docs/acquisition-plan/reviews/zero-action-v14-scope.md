# 零行动报告：v14 版本隔离影响清单（历史方案，未采纳）

2026-11-10 负责人决定：不采用本 v14 方案；在 v12/v13 内完成本轮呈现修正。依据为现存 v12 仅两份自测报告、v13 为零份，已存报告不可变，正式 v12 任务恢复走生成 checkpoint/已完成报告读取，身份复核固定生成 v3/v13。以下保留为当时的范围分析，不是待实施计划；没有新增 v14 或相关迁移。

状态：按负责人“新增 v14 牵涉面过大，先停下来列清单”的指令停止实施。本轮仅只读核对并写本说明；摘要净化、PDF 小修和 v14 均尚未改动，没有提交、push、部署、采集、扣费或生产写入。上一轮留在 v12/v13 内的未提交实现仍在工作区，不能作为已修复版本提交。

## 为什么不是单加一个规则集字符串

现有代码与 SQL 有以下严格对应：

- manifest v3 当且仅当 ruleset=v13；v3 必须携带 identity_version_id、identity_checksum、target_market、evidence_as_of。
- 报告 2.2.7 对应 v12，报告 2.2.8 对应 v13；候选池、交付编辑、完成引用均依赖这两个报告格式。
- `store_v22_capability_report` 按规则集推导报告格式；`validate_v22_candidate_pool` 再校验规则集与格式对应。
- 身份复核的 `prepare_v22_public_reassessment` 固定要求 manifest v3/v13、报告 2.2.8；其 commit 也按 2.2.8 保存。
- 前端 `owner-document.ts` 仅对 v13 开放身份确认区。

因此只给 freeze 加 v14，会让后续生成、保存、候选校验或身份复核拒绝新报告。直接改“当前版本”常量也可能改变用于生成旧夹具的默认入口，不能靠改写旧输出解决。

## 建议的兼容边界（建议，尚未选择或实施）

建议 v14 承接两类原有输入，继续复用已有报告结构，不自动新增 2.2.9：

| 规则集 | manifest / 身份 | report schema | 本轮新能力 |
|---|---|---|---|
| v12 | 原有 v1/v2 / 旧身份 | 2.2.7 | 不启用，恢复旧字节 |
| v13 | 原有 v3 / identity v2 | 2.2.8 | 不启用，恢复旧字节 |
| v14 | v1/v2 / 旧身份 | 2.2.7 | 启用 |
| v14 | v3 / identity v2 | 2.2.8 | 启用，保留全部身份绑定校验 |

这需要把现有“一种 report schema 对应唯一 ruleset”的校验，改为上表的严格组合；只增加 v14 的合法组合，不能允许 v12 携带 identity v2，或让 v13 绕过 manifest v3。v14 身份复核也必须仍要求 v3/identity v2。

若负责人希望 v14 一律使用新 report schema（例如 2.2.9），还需同步完成引用、交付版本、实施来源和更多运行时枚举，范围会进一步扩大；本轮没有自行采用该路线。

## 需要修改的文件清单

以下按上面的建议路线列出。上一轮新增事实的现有相关文件仍属于最终提交范围；不包含 PLAN.md、docs/superpowers/plans、output、.release-private 或其他既有未提交 docs。

### 后端产品代码

- `app/report_v22/public_presentation.py`：仅 v14 启用；从已验证的观测位置聚合一句摘要，禁止拼接三段技术事实。
- `app/report_v22/capability_finding_status.py`：增加独立 v14 常量及相关集合，保留 v12/v13 常量的历史含义。
- `app/report_v22/capability.py`：manifest 身份绑定、report schema/ruleset 组合、labels/contact checks/candidate pool/priority 的 v14 合约；旧组合保持严格。
- `app/report_v22/capability_public.py`：仅 v14 打开观测事实、摘要和限制合并；按输入身份选择原有报告结构，恢复 v12/v13 原路径。
- `app/report_v22/capability_priority.py`：让 v14 使用既有候选池算法和弱依据过滤，不改算法、权重或优先级。
- `app/jobs_v22/capability_acquisition_input.py`：新获客明确选择 v14，避免只在离线测试里能生成 v14。
- `app/jobs_v22/capability_inputs.py`：复核并同步生成输入/冻结 recipe 的版本组合校验。
- `app/report_v22/identity_input.py`：明确指定新构建的目标规则集；保留旧 v13 冻结输入及旧夹具构建的确定性。
- `app/report_v22/public_reassessment.py`：新身份重判生成 v14，同时保留旧输入按旧规则重放的能力。
- 已有本次相关文件 `market_observations.py`、`public_rule_catalog.py`、`findings.py`、`actions.py`：保留事实规则及无行动映射，检查无需再增加判定行为。

### 前端产品代码和生成合约

- `src/lib/report-capability/reader-copy.ts`：客户 readerFinding 净化 rank_source；顾问视图保留原始 observed_fact。
- `src/components/report/pdf/CapabilityReportPDFDocument.tsx`：使用与网页一致的紧凑 readerLimits。
- `src/lib/report-capability/validate.ts`：按上表校验 v14、身份与 report schema；v12/v13 仍保持原限制。
- `src/lib/report-capability/owner-document.ts`：v14 是否显示身份确认区必须依据其 v3 身份变体，不能对旧身份误开放。
- 上一轮 `src/components/report/CapabilityReportDocument.tsx` 的完整清单折叠区仍属相关提交内容。
- 两侧 `contracts/v2.2-capability/{capability.schema.json,manifest.json}` 与 `src/lib/report-capability/contracts/{capability.schema.json,manifest.json}`：重新导出严格组合。
- `src/lib/report-capability/generated/types.ts`：重新生成，只有实际变化才提交。
- `scripts/export_v22_capability_contracts.py`：若合约元数据版本需要递增，单独同步；不重写历史报告样本。

沿用 2.2.7/2.2.8 的建议路线下，`action-visibility.ts`、`projection.ts`、`order.ts`、`runtime.ts`、运行时 schema 及 `capability_runtime_models.py` 现有枚举已覆盖这两个报告结构，需跑 v14 验证，但不因命中版本字符串就顺手修改。

### 测试与离线验证

- `tests/test_zero_action_presentation.py`、`tests/fixtures/zero-action/history-digests.json`：门控扩到 v12/v13 原字节；新增 v14 双身份变体和无内部摘要断言。
- `tests/test_p0_02_ruleset_paths.py`：仅同步新获客 v14 入口；历史版本参数和缺失字段断言保留。
- `tests/test_p1_07_candidates.py`：恢复 v11/v12 原有发现一致性；v14 新事实例外单独测，不把旧版本例外继续留在 v12。
- 上一轮 `tests/test_v22_findings_export.py`、`tests/test_v22_public_action_catalog.py` 仍属新事实规则的相关测试。
- `src/lib/report-capability/zero-action-presentation.test.tsx`、`reader-copy.test.ts`：v14 的实际重放、摘要与客户事实净化、技术视图保留。
- `src/components/report/pdf/CapabilityReportPDFDocument.test.tsx`：紧凑限制文本测试，不生成或导出生产 PDF。
- `src/lib/database/v22Capability.test.ts`、`v22Migration.test.ts`、`v22IdentityReview.test.ts`：旧格式不变、v14 合法组合、错误组合拒绝、替换目标缺失报错、身份重判路径。

## 新迁移的具体内容

计划新增 `supabase/migrations/20261110140000_add_capability_public_v14.sql`，晚于现有 20261110130000。尚未创建可执行迁移文件，也未应用任何 SQL。

整份迁移放在一个事务内，沿用 pg_get_functiondef + replace。每个替换都先检查旧目标存在，不存在就 raise；保持原函数签名、权限、行锁、幂等、收费、输入 checksum 和身份绑定检查。

| 函数 | 要替换的内容 | 必须保留 |
|---|---|---|
| freeze_v22_analysis_manifest | 规则集白名单增加 v14；将 v3 当且仅当 v13 的互斥条件改为上表的合法组合 | v13 仍只能 v3；v3 的四个身份字段、Case/市场/证据时点/来源校验全部保留 |
| store_v22_capability_report | 白名单增加 v14；v14 的预期 report schema 按 manifest 是否 v3 分别为 2.2.8/2.2.7 | v12→2.2.7、v13→2.2.8 原分支不变；未知组合拒绝 |
| validate_v22_candidate_pool | ruleset/schema 精确映射增加 v14 的两种合法组合 | 原候选引用、数量、唯一性、依赖和原版本映射不变 |
| prepare_v22_public_reassessment | 接受新构建的 v3/v14 预览，仍兼容原 v3/v13 | 仍要求 identity v2、2.2.8、来源/身份 checksum 和无新采集约束 |
| commit_v22_public_reassessment | 核对 prepare/commit 的版本组合一致；仅在实际有硬编码规则集检查时替换 | 2.2.8 保存格式、append-only、新报告/重新批准、扣点规则不变 |

需要额外回归、但建议路线下不应无故改动的函数：validate_v22_candidate_selection、save_v22_report_content_revision、enforce_v22_delivery_prerequisites、list_v22_completed_capability_reports、get_v22_completed_capability_report、get_v22_completed_plan_source。它们对现有报告格式的接受范围应继续有效。

确定的白名单替换目标示例：旧尾部 `'v22_capability_public_v12','v22_capability_public_v13')` → 新尾部增加 `'v22_capability_public_v14'`。不能只做这一处就发布；必须与上表的身份和保存映射一起完成并通过本地数据库测试。

## 摘要与 readerFinding 的拟定修改

摘要建议原文（尚未生成或验证）：

> This sample did not identify a supported change to propose. Observed Maps positions: Plumbing Services Fresno: 2; Plumbing Services near me: 2; best Plumbing Services Fresno: 1. Unverified checks and sample limits are listed below.

数据来自 A1 的已验证位置证据，不从自由文本猜数字。Maps/organic 事实原文可保留 rank_source；客户 readerFinding 去掉对应括号，技术视图仍展示原值，底层保存事实不变。摘要不出现 rank_source、坐标或规则 ID。

## 确认后应执行的验证

1. 原 v12/job67cb 使用原 manifest/request 重放，恢复到原 canonical SHA-256 `3cac9c938cc5b9a03f8b7c2aecb3614c37dbffed5a42db3560cec2424a3ba6d5`；v13 使用改前固定夹具断言完整字节不变。
2. 对同一份冻结快照建立单独 v14 离线 manifest，仅更新版本及对应 manifest checksum，不改变源快照和证据；本地 Supabase 验证 freeze/store 及版本组合。
3. 与上一轮离线结果相比，v14 仍是 Maps 事实3条（2/2/1）、findings=5、actions=0、insufficient_basis、限制8条且原19句可追溯；差异应限于版本相关字段/checksum、精简摘要及客户事实净化。
4. 网络阻断和本地数据计数继续证明零 provider 调用、零新快照；不写生产，不采集、不扣费、不批准、不分享、不导出生产 PDF。
5. 完成相关测试、两端完整测试/类型检查、合约导出检查后，只逐项暂存本轮相关文件；排除 PLAN.md 和所有无关 docs/输出/私有目录。

本轮没有实施这些修改，因此不能声称 v12/v13 恢复断言或 v14 重放已通过。上一轮测试通过结果仅对应上一轮实现。
