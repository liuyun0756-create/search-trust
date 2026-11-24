# P1-02 第二段｜客户 Google 评论样本

## 发布合约

新采集使用 `v22_capability_public_v22`、报告 `2.2.17`、合约 `2.2.22`、manifest `v22_analysis_input_v12`、公开资料快照 `customer_public_gbp_snapshot_v3`。v19 保留为空。默认关闭 `V22_CUSTOMER_GBP_REVIEWS_ENABLED`，运行路径还要求 GBP 对比启用且 A3 的分支状态为 `retained`。两种确认来源都使用同一个保留分支。关闭或分支未保留时沿用旧报告路径。

最多 4 次评论页请求及 1 次资料身份键查询。重试也占用同一任务的预算。只冻结散列后的评论标识、日期、回复是否可见和采样记录。采样量上限 30 条，窗口用首次原始采样时点的 UTC 时间往前 90 天。路径优先使用已匹配身份的 data_id。无法确定完整覆盖时保留计数下限。至少两家同方向、比较样本的原始时点相距不超过 24 小时才展示方向。回复率分母为回复状态可判的样本数，历史竞品每页截取口径不同，本阶段双方只展示各自的样本回复率。

## 旧版本入口盘点

| 入口 | v22 处理 |
| --- | --- |
| Python 配置、Worker 工厂、任务准备 | 默认关闭。继承完成后才判断采集资格，沿用确认分支。 |
| Python `capability_inputs`、准备 Worker、runtime dispatch/completion、冻结模型、`verified_models` | 校验 manifest v12 与来源 v3 的配对及所有 checksum。已完成报告的读取支持 v3。 |
| Python `capability`、`capability_public`、`public_gbp_bindings`、`evidence_bindings`、`gbp_comparison`、`comparison_reasons` | 新增受 v22 限定的样本验证、报告版本、指标和推断。v21 及以下使用原模块版本。 |
| Python 合约导出与 `ruleset_registry` | 导出 2.2.22 和 GBP 来源 v3，v19 继续空着。 |
| 前端 JSON / TypeScript 合约、runtime、`validate`、`gbp-comparison`、`possible-reasons` | 接收并验证 2.2.17 和 v12 配对，保留原合约。 |
| 前端 `owner-document`、`order`、`action-visibility`、`projection` | 支持 2.2.17 报告的候选和交付投影。网页、分享、PDF 共用客户字段。 |
| 已冻结报告的身份复核 | 保留 v13–v21 的现有入口。v22/v3 的历史复核是单独的合约问题，本段仅支持获客时为已确认分支采样。 |
| SQL 旧版 `persist_v22_prospect_result` | 旧流程只写 v1/v2，保持不变。 |
| SQL `hydrate_v22_capability_generation_input` 及关键词、落地页、行动、候选、本地实体校验 | 通过已验证的 manifest 布局及冻结来源读取，无需扩写独立版本列表。 |
| 历史 SQL 迁移、旧测试夹具、设计记录 | 保留版本字面量作为已发布基线。扩展当前迁移测试中的报告规则集名单。 |

迁移 `20261124100000_bind_customer_gbp_reviews_v22.sql` 校验原始 prosrc / 定义 MD5 再替换函数，并在同一事务内复查目标和 ACL。回滚文件保存完整旧定义。回滚要求没有写入 v22 报告，否则旧约束会拒绝。两个新校验函数只授权 postgres 和 service_role。

| SQL 函数或约束 | 原 prosrc MD5（约束使用定义 MD5） | 目标 MD5 | ACL |
| --- | --- | --- | --- |
| `check_v22_acquisition_preparation_binding()` | `6edb7a3fb074a371044bb09c7dca2506` | `b8c9ddac4303d436dfd91298067ba5ed` | postgres、service_role |
| `enforce_v22_delivery_prerequisites()` | `38fa04c7fbfaeed6717ca885e0bbc47e` | `5e996b873d4715831777df5be4e1399a` | postgres |
| `freeze_v22_analysis_manifest(uuid,uuid,uuid,jsonb,text,text)` | `b570b42a415e852ebf420210d3f80ff6` | `21b652dffff62bbc234450c19fd703cc` | postgres、service_role |
| `get_v22_completed_plan_source(uuid,uuid,uuid)` | `877ea62bdcc7322363938e4f5d9b6e8d` | `cfd75d927271ddf2167ee3d232b24080` | postgres |
| `list_v22_completed_capability_reports(uuid)` | `e0b6181f3aee5ac5dbe721bf12247112` | `73b3bbd5d26d4bc69fa597e6306b7e23` | postgres、service_role |
| `prepare_v22_capability_analysis_input_core(uuid,uuid,uuid,jsonb,text,jsonb,text,jsonb,text,integer)` | `4639d97f0df2dcbe623d258143cf1bea` | `95c5c5815ff5a6977f158feeac96c878` | postgres |
| `save_v22_report_content_revision(uuid,uuid,uuid,jsonb)` | `38b98afa2a148d6c6cbbca7e262414ae` | `bae42543b0061e36b130280b78adeba4` | postgres |
| `start_v22_verified_analysis_legacy_financial_bridge(uuid,uuid,uuid,text,text,uuid,uuid)` | `fbb82903e09e0b47d95cfe38bff0fcc7` | `91aa1715a552765638ea3b410c79468a` | postgres |
| `store_v22_capability_report(uuid,uuid,uuid,jsonb,text,integer)` | `5cf5e7bd11e77a91dc871033a466b81b` | `06d3d0d1b6d85a7e9ac13f097f3a5ead` | postgres、service_role |
| `v22_a3_manifest_shape(jsonb)` | `0b0e5c86c8766ff7430d5ec9caf809d3` | `5da9618d0d5796cc9f37ba0c99e8f14b` | postgres、service_role |
| `v22_a3_report_shape(jsonb)` | `3a783fc8d5dbe0c59941b4974b14b3b3` | `fbf8ca15345158e603c0f86b99244f0e` | postgres、service_role |
| `validate_v22_gbp_comparison(jsonb)` | `0c8ef85809288363c25b47bc8ae303d5` | `48f876bc969beb47c77784dcd5c91707` | postgres、service_role |
| `validate_v22_possible_reasons(jsonb)` | `e5ed327182dbab4779f652dff4cd4d2c` | `9f99a3793ae9e9cb48140167e26180b9` | postgres、service_role |
| `capability_report_input_variant` | `821494ee70419167dc0c4d932365798f` | `257b4727e1067bed05e15cf2e530b14e` | 适用原定义 |
| `capability_report_versions_schema_version_check` | `f404d0a3e4b017594d750726cfaf6a04` | `7343c61ba462f5ead01919722848e889` | 适用原定义 |

## Fresno 离线核对

冻结报告来源为 f1ffaeb0，A3 确认 rev 4。客户使用 2026-11-23 已保存的 30 条脱敏测量样本，零新增 provider 调用。旧网站及竞品的作业绑定在采样前已过期，重放只在本地副本延长这两条绑定，原采样时间及来源 payload 保持原样。按已保存的采样元数据重建页面摘要，不声称重获原始供应商响应。

| 样本 | 近 90 天 | 最近评论（UTC） | 可见回复 |
| --- | --- | --- | --- |
| 客户 | 2，精确值 | 2026-09-18 | 30/30 |
| PR Plumbing | 至少 30 | 2026-11-23 | 24/30 |
| Low Cost Plumbing | 至少 30 | 2026-11-20 | 28/30 |
| Art Douglas | 至少 16 | 2026-10-30 | 29/30 |

三家竞品原始采样点与客户相差约 86 分钟。评论数和样本最近日期均有三家支持同一方向，生成一条近期评论活跃度的可能原因。可见回复只展示样本比例。
