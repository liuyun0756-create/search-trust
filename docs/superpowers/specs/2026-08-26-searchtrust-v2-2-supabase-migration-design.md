# SearchTrust v2.2 Supabase Migration 设计

状态：已批准，等待实施计划

日期：2026-08-26

范围：V22-010

适用仓库：`search-trust`

## 1. 摘要

V22-010 为 SearchTrust v2.2 建立客户项目、Google 连接、来源绑定、不可变数据快照、持久分析任务和报告版本的数据基础。

迁移采用单个原子化、forward-only、仅扩展 migration。它不回填、不改写现有 v2.1 数据；旧报告新增字段全部允许为空，并继续使用原有读取与渲染路径。

## 2. 目标

- 创建 `client_cases`、`google_connections`、`case_source_bindings`、`data_snapshots` 和 `analysis_jobs`。
- 扩展现有 `reports`，支持 Case、v2.2 合同、不可变版本和数据快照引用。
- 在数据库层执行唯一性、状态、token 安全、不可变性和 GBP 原始内容保留规则。
- 延续 Clerk + Next.js server-only + Supabase service role 的身份边界。
- 建立可重复的本地 migration、pgTAP、lint、TypeScript 和构建验证。
- 保证现有 v2.1 报告行和线上接口语义不变。

## 3. 非目标

- 不实现 V22-011 Case API。
- 不实现 OAuth、token 加密/解密应用代码或 Google API 调用。
- 不实现 GSC、GA4、GBP 同步。
- 不实现 Redis/ARQ、worker 或任务恢复逻辑。
- 不实现 GBP 定时清理任务，只提供可安全清理的字段、约束、索引和更新通道。
- 不向远程 Supabase 项目自动应用 migration。
- 不删除或回填历史报告。

## 4. 架构决定

### 4.1 身份和访问

- Clerk 继续作为唯一用户身份提供方。
- `public.users.id` 继续作为所有业务数据的数据库 owner key。
- 浏览器不直接访问 Supabase 数据表。
- Next.js 服务端使用 service role，并在每次查询中显式限制当前 Clerk 用户对应的 `users.id`。
- 所有新表启用 RLS，撤销 `anon` 和 `authenticated` 权限，仅授予 `service_role`。
- 不建立依赖 Supabase Auth `auth.uid()` 的 policy。

### 4.2 迁移策略

- 使用单个带日期的 migration 文件。
- migration 显式放在一个事务内；任一步骤失败则整体回滚。
- migration 只新增表、列、索引、函数、触发器、约束、注释和权限。
- 不包含数据回填或破坏性 schema 变更。
- 生产回滚通过关闭 v2.2 功能入口完成，不自动删除已写入数据。

### 4.3 状态类型

状态字段使用命名 `CHECK` 约束，不创建 PostgreSQL enum。这样能够保持数据库约束明确，同时避免新增合理状态时必须先修改 enum 类型。

## 5. `client_cases`

核心字段：

- `id uuid primary key`；
- `user_id uuid not null`，引用 `users(id) on delete cascade`；
- `site_url text not null`；
- `normalized_domain text not null`；
- `business_name text not null`；
- `business_identity jsonb not null`；
- `operating_model text not null`：`storefront / service_area / hybrid`；
- `primary_service text not null`；
- `target_market jsonb not null`；
- `status text not null default 'active'`：`active / archived`；
- `latest_report_id uuid null`；
- `archived_at timestamptz null`；
- `created_at`、`updated_at`。

约束：

- `normalized_domain` 必须小写，不包含协议、斜杠、查询或 fragment。
- `business_identity` 和 `target_market` 必须是 JSON object。
- `active` Case 的 `archived_at` 必须为空；`archived` Case 必须有 `archived_at`。
- 同一用户可以创建相同域名但不同 Location 的 Case，不建立域名唯一约束。
- `latest_report_id` 在扩展 `reports` 后添加外键，报告删除时置空。
- 触发器验证 latest report 必须属于同一 Case 和同一用户。

索引：

- `(user_id, status, updated_at desc)`；
- `(user_id, normalized_domain)`；
- `latest_report_id`。

## 6. `google_connections`

核心字段：

- `id uuid primary key`；
- `user_id uuid not null`，引用 `users(id) on delete cascade`；
- `google_subject text not null`；
- `account_email text null`；
- `account_display_name text null`；
- `granted_scopes text[] not null default '{}'`；
- access token 的 `ciphertext / iv / auth_tag`；
- refresh token 的 `ciphertext / iv / auth_tag`；
- `encryption_key_version text null`；
- `token_expires_at timestamptz null`；
- `status text`：`active / error / revoked / deleted`；
- `last_error_code`、`last_error_message`；
- `connected_at`、`revoked_at`、`deleted_at`；
- `created_at`、`updated_at`。

安全约束：

- 每个 token 的 ciphertext、IV、auth tag 必须成组出现或成组为空。
- 任一 token 密文存在时必须有 `encryption_key_version`。
- `active` Connection 必须有 access token 密文。
- `revoked / deleted` Connection 不得保留任何 token 密文、tag 或 IV。
- `revoked_at` 和 `deleted_at` 必须与状态一致。
- error 字段不得用于保存供应商原始响应或 token。

唯一性：

- partial unique index `(user_id, google_subject) where deleted_at is null`，保证同一 Google 账号只有一个未删除 Connection。

删除语义：

- Case 删除不删除 Connection，因为同一 Connection 可被其他 Case 使用。
- 用户删除时级联删除 Connection。
- Disconnect 先撤销 Google token，再清空密文并标记 revoked/deleted；是否最终物理删除由后续隐私流程决定。

## 7. `case_source_bindings`

核心字段：

- `id uuid primary key`；
- `case_id uuid not null`，引用 `client_cases(id) on delete cascade`；
- `connection_id uuid null`，引用 `google_connections(id) on delete set null`；
- `source_type text`：`gsc / ga4 / gbp`；
- `external_resource_id text not null`；
- `external_resource_name text not null`；
- `identity_match_status text`：`not_checked / matched / mismatch / needs_confirmation`；
- `identity_match_evidence jsonb not null default '{}'`；
- `health_status text`：`not_checked / healthy / unhealthy / unavailable / expired / error`；
- `health_reasons jsonb not null default '[]'`；
- `is_active boolean not null default true`；
- `confirmed_by_user_id uuid null`，引用 `users(id) on delete set null`；
- `confirmed_at`、`last_synced_at`、`disconnected_at`；
- `created_at`、`updated_at`。

约束：

- identity evidence 必须是 object，health reasons 必须是 array。
- active binding 必须有 Connection 且 `disconnected_at` 为空。
- inactive binding 必须有 `disconnected_at`。
- `confirmed_at` 与 `confirmed_by_user_id` 成对出现。
- Connection 和确认者必须与 Case 归属同一用户，由触发器验证。
- partial unique index `(case_id, source_type) where is_active`。
- 同一个外部资源可以在不同 Case 中使用，但必须分别保存身份匹配证据。

## 8. `data_snapshots`

核心字段：

- `id uuid primary key`；
- `case_id uuid not null`，引用 Case 并在硬删除时 cascade；
- `binding_id uuid null`，使用可延迟 `NO ACTION` 外键引用 binding；有快照的 binding 必须保留为 inactive 审计记录，不能单独物理删除；
- `source_type text`：`site / serp / competitor / gsc / gbp / ga4 / pagespeed`；
- `schema_version text not null`；
- `coverage_start`、`coverage_end`；
- `fetched_at timestamptz not null`；
- `expires_at timestamptz null`；
- `sync_trigger text`：`report_generation / user_sync / retry / migration`；
- `health_status`、`health_reasons`；
- `normalized_payload jsonb not null`；
- `raw_payload jsonb null`；
- `payload_checksum text not null`；
- `provider_request_context jsonb not null`；
- `retention_policy text`：`standard / gbp_content_30d`；
- `raw_content_deleted_at timestamptz null`；
- `supersedes_snapshot_id uuid null`，使用可延迟 `NO ACTION` 自引用；被后续快照引用的 snapshot 不能单独物理删除；
- `created_at`。

约束：

- normalized payload 和 provider context 必须是 object；health reasons 必须是 array。
- `coverage_start <= coverage_end`。
- checksum 格式为 `sha256:<64 lowercase hex>`。
- `gbp_content_30d` 必须有 `expires_at`，且不晚于 `fetched_at + 30 days`。
- `raw_content_deleted_at` 存在时 `raw_payload` 必须为空。
- binding 必须属于同一 Case，且 binding/source 类型必须一致。
- superseded snapshot 必须属于同一 Case且 source type 相同，由触发器验证。

不可变触发器：

- 默认拒绝所有 UPDATE。
- 唯一允许的更新是把非空 `raw_payload` 置空，并首次写入 `raw_content_deleted_at`。
- 该更新不得改变任何其他字段。
- DELETE 保留给 Case 隐私硬删除、用户删除和受控清理流程。

索引：

- `(case_id, source_type, fetched_at desc)`；
- `binding_id`；
- `supersedes_snapshot_id`；
- partial index `(expires_at) where retention_policy = 'gbp_content_30d' and raw_payload is not null`，供清理任务使用。

## 9. `analysis_jobs`

核心字段：

- `id uuid primary key`；
- `case_id uuid not null`，引用 Case 并 cascade；
- `report_id uuid null`，引用 report 并在报告删除时 set null；report 非空时必须属于同一 Case；
- `job_type text`：`prospect_report / verified_report / source_sync`；
- `status text`：`queued / running / succeeded / failed`；
- `current_stage text not null`；
- `progress smallint not null`，0 至 100；
- `attempt_count integer not null default 0`；
- `idempotency_key text not null`；
- `error_code`、`user_message`；
- `cost_counters jsonb not null default '{}'`；
- `started_at`、`heartbeat_at`、`completed_at`；
- `created_at`、`updated_at`。

约束：

- cost counters 必须是 object。
- queued/running 不得有 `completed_at`。
- succeeded 必须 progress=100、有 `completed_at`、无 error。
- failed 必须有 `completed_at` 和 `error_code`。
- partial/普通 unique index `(case_id, idempotency_key)` 防止重复扣费和重复报告。

索引：

- `(status, heartbeat_at)`，支持 stalled job 扫描；
- `(case_id, created_at desc)`；
- `report_id`。

## 10. `reports` 扩展

新增字段：

- `case_id uuid null`；
- `report_type text null`：`prospect / verified_execution`；
- `schema_version text null`；
- `version_number integer null`；
- `parent_report_id uuid null`；
- `report_v2_2 jsonb null`；
- `snapshot_ids uuid[] null`；
- `coverage_state jsonb null`；
- `version_diff jsonb null`；
- `generation_config jsonb null`；
- `ruleset_version text null`；
- `copy_model_version text null`。

外键和删除：

- `case_id` 引用 Case，Case 硬删除时级联删除 v2.2 report。
- `parent_report_id` 使用 `NO ACTION DEFERRABLE INITIALLY DEFERRED` 自引用。存在子版本时禁止单独删除 parent；Case 隐私删除在同一事务中删除整条版本链。
- `client_cases.latest_report_id` 引用 reports，report 删除时置空。

兼容规则：

- 旧行以上字段全部为空时不触发 v2.2 条件。
- v2.2 行必须提供 Case、report type、schema version、version number、正文、snapshot IDs、coverage、diff、generation config 和规则版本。
- prospect 不得有 parent；verified 必须有 parent。
- JSONB 正文字段必须是 object，snapshot IDs 不得为空且不得重复。
- report 的 user、Case、parent report 和每个 snapshot ID 必须属于同一用户/Case；parent version 必须小于当前 version，由触发器验证。

不可变触发器：

- pending report 可以从 `report_v2_2 is null` 首次写入完整 v2.2 正文及其绑定字段。
- 一旦 `report_v2_2` 非空，禁止修改 Case、report type、schema version、version number、parent、正文、snapshot IDs、coverage、diff、generation config、ruleset 和 copy model。
- 分享、品牌、支付和展示元数据不在本触发器范围内。
- v2.1 行继续使用原更新流程。

## 11. 生命周期与删除

- 日常删除 Case 只将状态更新为 archived，并写入 `archived_at`。
- 硬删除仅用于明确的 Case 数据删除或隐私请求。
- Case 硬删除级联删除其 bindings、snapshots、jobs 和 v2.2 reports。
- Google Connection 不随 Case 删除；其他 Case 可以继续使用。
- 用户删除级联删除其 Case、Connection、报告、订单及相关数据。
- GBP TTL 清理不删除快照行，只清除受限 raw payload 并标记清除时间。

## 12. 触发器与函数

migration 创建命名明确的数据库函数：

- 自动维护 `updated_at`；
- 验证 Case latest report 归属；
- 验证 binding 的 Connection/确认者与 Case 归属同一用户；
- 验证 snapshot binding 和 supersedes 关系属于同一 Case/source；
- 验证 job 关联 report 属于同一 Case；
- 验证 report 的 user、Case、parent 和 snapshot IDs 归属一致；
- 执行 snapshot 不可变和 GBP raw payload 清理例外；
- 执行 v2.2 report 首次写入和后续不可变；
- 执行 Connection 终态 token 清空保护。

触发器异常使用标准 SQLSTATE `23514`，消息只包含规则名称和安全描述，不回显 token、客户 JSON 或供应商响应。

## 13. RLS 与权限

对五张新表：

1. `enable row level security`；
2. grant schema usage 给 service role；
3. grant 所需 CRUD 给 service role；
4. revoke all from anon、authenticated；
5. 不创建浏览器 policy。

由于 service role 绕过 RLS，Next.js API 仍必须把 `user_id` 加入查询条件。V22-011 将为每个 Case API 编写未授权和跨用户测试。

## 14. TypeScript 类型

同步扩展 `src/types/database.ts`：

- 为五张新表分别定义 Row 类型；
- 扩展现有 `Report` 的 v2.2 nullable 字段；
- JSON 载荷继续保持 `unknown` 或有边界的 JSON 类型，不在 V22-010 重复手写 `report_v2_2` 合同；
- 正式报告正文使用已生成的 `SearchTrustReportV2_2` 类型。

本阶段不实现数据库访问函数或 Case API。

## 15. 测试

### 15.1 本地数据库

- 初始化本地 Supabase 配置，但不写入远程 project ref 或 secret。
- 从空数据库按顺序应用全部 migration。
- 运行 `supabase db lint`。
- 使用 pgTAP 数据库测试约束、索引、触发器、权限和级联行为。

### 15.2 正向测试

- 插入合法 Case、Connection、Binding、Snapshot、Job 和 v2.2 report。
- 首次完成 pending v2.2 report。
- 归档 Case。
- 清除 GBP raw payload。
- Case 硬删除后 Connection 保留。
- v2.1 report 在 migration 前后字段和正文不变。

### 15.3 负向测试

- 重复 active Connection；
- 重复 active binding；
- token 密文组件不完整；
- revoked/deleted Connection 保留 token；
- 无效 Case 归档状态；
- 非法 GBP TTL；
- 普通 snapshot UPDATE；
- snapshot 跨 Case/source supersedes；
- binding 关联其他用户的 Connection；
- snapshot 关联其他 Case 的 binding；
- 第二次修改 v2.2 report 正文；
-跨 Case latest report；
- report 关联其他 Case 的 parent 或 snapshot；
- job 关联其他 Case 的 report；
-不一致 job 终态；
- anon/authenticated 表权限。

### 15.4 应用验证

- TypeScript `tsc --noEmit`；
-现有 Vitest；
- Next.js production build；
-现有 v2.1 路径不变。

## 16. 验收标准

V22-010 只有同时满足以下条件才完成：

- migration 从空数据库完整应用；
-所有命名约束、索引、函数、触发器和权限存在；
- pgTAP 正向与负向场景通过；
-旧 v2.1 report 不被修改；
- Snapshot 和 v2.2 report 不可变规则通过；
- GBP 30 天 raw content 规则和清理例外通过；
-跨用户浏览器角色无表权限；
- TypeScript 类型、测试和 build 通过；
-未实现超出 V22-010 的 API、OAuth 或 worker。

## 17. 后续顺序

V22-010 完成后进入：

1. V22-011 Case API；
2. V22-012 Redis/ARQ 持久任务；
3. V22-020 Preflight API。
