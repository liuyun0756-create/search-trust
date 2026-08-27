# SearchTrust v2.2 Case API 实施计划

状态：已完成

日期：2026-08-27

范围：V22-011

设计依据：`docs/superpowers/specs/2026-08-27-searchtrust-v2-2-case-api-design.md`

## 1. 数据库扩展

1. 新增一份 forward-only migration。
2. 创建 immutable `v22_case_location_key(jsonb)` 函数。
3. 增加 stored generated `location_key`。
4. 增加同用户/domain/location partial unique index。
5. 增加 Case site URL/domain 不可变触发器。
6. 增加完整 business identity 与顶层字段一致性约束。
7. 扩展 PGlite 和 pgTAP 测试。

验收：历史 incomplete Case 可继续存在；新完整 Case 得到稳定 key；重复和非法变更由 PostgreSQL 拒绝。

## 2. Case 合同与规范化

1. 定义 Target Location、创建、更新、列表 query 和响应类型。
2. 使用 AJV 严格校验 JSON，拒绝未知字段。
3. 实现文本、国家代码、nullable 字段和经纬度规范化。
4. 实现站点 URL/GBP URL 验证与规范化。
5. 实现 TypeScript Location Key，并与 SQL fixture 对齐。
6. 实现统一 business identity 构造。

验收：纯函数测试覆盖合法输入、边界、私网 URL、空 PATCH 和不可写系统字段。

## 3. Repository 与 Service

1. 定义可注入的 `CaseRepository` 接口。
2. 实现 Supabase repository，所有方法显式接收并查询 `userId`。
3. 使用显式列投影，浏览器响应不包含 user ID 或 location key。
4. 实现创建、重复冲突定位、列表、详情、更新、归档和恢复。
5. 将 PostgreSQL `23505` 映射为稳定重复 Case 错误。
6. archived Case 保持只读，只允许独立恢复操作。

验收：service 测试覆盖正常生命周期、重复 Location、同域不同 Location、归档幂等、恢复和跨用户 404。

## 4. Route Handlers

1. 新增 `/api/v2/cases` GET/POST。
2. 新增 `/api/v2/cases/[id]` GET/PATCH/DELETE。
3. 使用 handler factory 注入 auth 和 service，生产使用真实依赖。
4. 统一 v2 error body 和 HTTP 状态。
5. 请求 JSON、query 和 UUID 错误均安全返回，不泄露 Supabase detail。

验收：未授权、非法请求、正常 CRUD、跨用户和冲突响应均符合设计。

## 5. 测试

1. `normalize.test.ts`：文本、URL、Location 和 key。
2. `service.test.ts`：领域生命周期和 owner isolation。
3. Route Handler 测试：HTTP/auth/error mapping。
4. `v22Migration.test.ts`：顺序 migration、SQL/TS key parity、unique、immutability、兼容。
5. pgTAP：新增函数、列、索引和触发器存在性。

验收：V22-011 新测试通过，V22-003/V22-010 测试无回归。

## 6. 最终验证

1. `npm run test:database`。
2. `npm test`。
3. `npm run typecheck`。
4. `npm run contracts:check`。
5. `npm run build`。
6. `git diff --check` 并确认只包含 V22-011 范围。
7. 更新计划状态并提交实现。

本机无 Docker 时，继续使用 PGlite 执行真实 PostgreSQL migration 和行为测试；原生 Supabase pgTAP 保留给 Docker 环境或 CI。

完成后进入 V22-012 持久任务。

## 7. 实施结果

完成日期：2026-08-27

- 已新增 Case Location Key、数据库唯一索引、完整 identity 一致性约束和网站身份不可变触发器。
- 已实现严格 AJV 请求合同、URL/Location 规范化和安全错误格式。
- 已实现 user-scoped Supabase repository 与创建、列表、详情、更新、归档、幂等归档和恢复 service。
- 已实现 `/api/v2/cases` 与 `/api/v2/cases/[id]` 五个 Route Handler。
- 已覆盖未授权、跨用户、正常 CRUD、重复 active/archived Location、同域不同 Location、数据库 `23505` 竞态和历史 migration 兼容。
- `npm test`：6 个文件、47 项通过；`npm run typecheck`、`npm run contracts:check`、`npm run build` 均通过。
- 本机未安装 Docker，因此 Supabase 原生 reset/lint/pgTAP 仍留给 Docker 环境或 CI；PGlite PostgreSQL migration/行为测试 9 项通过。
- 项目现有 ESLint flat config 在 ESLint 启动阶段触发循环结构错误；本阶段未修改全局 lint 配置，使用 TypeScript、Vitest 和 Next.js production build 完成代码验证。
