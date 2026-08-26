# SearchTrust v2.2 Supabase Migration 实施计划

状态：已完成

日期：2026-08-26

范围：V22-010

设计依据：`docs/superpowers/specs/2026-08-26-searchtrust-v2-2-supabase-migration-design.md`

## 1. 本地数据库基础

1. 初始化不包含远程 project ref 和 secret 的 Supabase 本地配置。
2. 确认现有 migration 能从空数据库顺序应用。
3. 建立 pgTAP 测试目录和执行入口。

验收：本地 stack 可启动，现有 schema reset 成功。

## 2. 原子 migration

1. 创建单个 V22-010 migration，并显式使用事务。
2. 创建 Case、Connection、Binding、Snapshot、Job 五张表。
3. 扩展 reports，建立双向 Case/report 外键。
4. 添加命名 CHECK、外键、partial unique index、查询索引、注释和权限。
5. 新表启用 RLS，仅授予 service_role。

验收：migration 失败整体回滚，成功后所有对象存在，历史 reports 数据不变。

## 3. 数据库触发器

1. 实现 updated_at。
2. 实现 Case latest report 同用户/同 Case 校验。
3. 实现 Binding owner 校验。
4. 实现 Snapshot binding/supersedes 校验及不可变例外。
5. 实现 Job/report 同 Case 校验。
6. 实现 v2.2 report user/Case/parent/snapshot 校验及首次完成后不可变。

验收：所有跨行规则和不可变规则均由数据库拒绝非法写入。

## 4. pgTAP 测试

1. 覆盖合法完整写入、归档和 GBP raw payload 清理。
2. 覆盖唯一性、token 完整性、状态、TTL 和 job 终态。
3. 覆盖跨用户/跨 Case 关联。
4. 覆盖 Snapshot 和 report 不可变。
5. 覆盖 RLS/grant、Case 删除级联及 Connection 保留。
6. 覆盖旧 v2.1 report 兼容。

验收：全部数据库测试通过且无依赖远程项目或真实 token。

## 5. TypeScript 类型

1. 为五张新表增加 Row 类型。
2. 扩展 Report nullable v2.2 字段。
3. 正式正文引用生成的 `SearchTrustReportV2_2`，不复制合同。
4. 增加有限 JSON 类型，移除新增代码中的 `any`。

验收：typecheck 和现有代码通过。

## 6. 最终验收

1. `supabase db reset`。
2. `supabase db lint`。
3. `supabase test db`。
4. `npm test`、`npm run typecheck`、`npm run build`。
5. 检查工作区差异只包含 V22-010 范围。
6. 提交实现并把本计划状态更新为已完成。

完成后进入 V22-011 Case API。

## 7. 实施结果

完成日期：2026-08-26

- 已初始化不含远程 project ref、密钥和 seed 的本地 Supabase 配置。
- 已新增一份原子、前向兼容 migration；空库按全部历史 migration 顺序执行成功。
- 已实现五张 v2.2 表、reports 扩展、命名约束、索引、RLS、service role 权限和全部跨行触发器。
- 已增加 Supabase pgTAP schema 契约，以及基于嵌入式 PostgreSQL 17 的正向/负向数据库集成测试。
- 已证明 v2.1 历史报告在 migration 前后保持原正文且新增字段为空。
- 已同步 TypeScript Row 类型，`report_v2_2` 直接引用生成合同类型。
- `npm test`：20 项通过；`npm run typecheck`、`npm run contracts:check`、`npm run build` 均通过。
- 当前机器未安装 Docker，因此 `supabase db reset / db lint / test db` 无法启动本地 Supabase stack；同一组 migration 已由嵌入式 PostgreSQL 实际执行，原生 pgTAP 文件已提交供 Docker 环境或 CI 复跑。
