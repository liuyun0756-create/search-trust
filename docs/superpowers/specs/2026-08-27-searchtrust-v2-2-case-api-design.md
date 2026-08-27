# SearchTrust v2.2 Case API 设计

状态：已确认，待书面审核

日期：2026-08-27

范围：V22-011

依赖：V22-003 合同冻结、V22-010 Supabase 数据模型

## 1. 目标

为 SearchTrust v2.2 提供服务端专用的 Case CRUD 边界，使已登录用户能够：

1. 创建一个网站与真实 Location 组合的客户 Case；
2. 查看自己的 Case 列表和详情；
3. 更新已确认的商家、Location、主营服务和目标市场信息；
4. 归档和恢复 Case；
5. 在任何操作中都不能读取或修改其他用户的 Case。

V22-011 不实现页面 UI、公开数据预检、Google OAuth、数据绑定、报告生成、任务队列或隐私硬删除。

## 2. 已确认的产品规则

- Case 创建后，`site_url` 和 `normalized_domain` 不可修改。换网站必须创建新 Case。
- 同一用户可以为同一个域名创建不同 Location 的 Case。
- 同一用户、同一规范域名、同一规范 Location 只能存在一个 Case，归档 Case 也参与重复判断。
- 重复创建返回 `409 CASE_ALREADY_EXISTS`，并返回已有 Case 的 ID 和状态。
- 日常删除只执行归档，不提供物理删除 API。
- 已归档 Case 可以恢复为 active。
- 已归档 Case 保持可读，但确认信息为只读；必须先恢复，再更新确认信息。

## 3. API 表面

所有接口位于 Next.js App Router 的 `/api/v2/cases` 下，响应使用 JSON。

### 3.1 `POST /api/v2/cases`

创建当前用户的 Case。

请求：

```json
{
  "site_url": "https://www.example.com/",
  "business_name": "Example Dental",
  "operating_model": "storefront",
  "primary_service": "Emergency dentist",
  "primary_location": {
    "display_name": "Austin, TX",
    "country_code": "US",
    "region": "Texas",
    "city": "Austin",
    "postal_code": "78701",
    "latitude": 30.2672,
    "longitude": -97.7431
  },
  "target_market": {
    "display_name": "Austin, TX",
    "country_code": "US",
    "region": "Texas",
    "city": "Austin",
    "postal_code": null,
    "latitude": 30.2672,
    "longitude": -97.7431
  },
  "public_gbp_url": null
}
```

成功返回 `201` 和 Case 资源。客户端不得传入 `user_id`、`normalized_domain`、`business_identity`、`status`、`latest_report_id`、时间戳或 `location_key`。

### 3.2 `GET /api/v2/cases`

列出当前用户的 Case。

查询参数：

- `status=active|archived|all`，默认 `active`；
- `limit`，默认 20，范围 1—100；
- `offset`，默认 0，范围 0—10000。

按 `updated_at desc, id asc` 稳定排序。响应：

```json
{
  "items": [],
  "total": 0,
  "limit": 20,
  "offset": 0
}
```

`total` 是当前状态筛选下的总数，不受 limit 和 offset 影响。

### 3.3 `GET /api/v2/cases/:id`

返回当前用户拥有的单个 Case。非法 UUID 返回 `400 INVALID_REQUEST`；不存在或属于其他用户统一返回 `404 CASE_NOT_FOUND`。

### 3.4 `PATCH /api/v2/cases/:id`

允许更新以下字段中的一个或多个：

- `business_name`；
- `operating_model`；
- `primary_service`；
- `primary_location`；
- `target_market`；
- `public_gbp_url`。

恢复操作只接受：

```json
{ "status": "active" }
```

active Case 不接受 `status` 字段。archived Case 只接受上述恢复请求，不在同一个 PATCH 中混合恢复和确认信息更新。禁止修改 `site_url`、`normalized_domain`、`latest_report_id` 和任何系统字段。

更新 `business_name`、`operating_model` 或 `primary_location` 时，服务端同步重建 `business_identity`，保持数据库冗余字段一致。更新 Location 如果与另一个 Case 冲突，返回 `409 CASE_ALREADY_EXISTS`。

### 3.5 `DELETE /api/v2/cases/:id`

幂等归档当前用户的 Case：

- active Case 更新为 `status=archived` 并写入 `archived_at`；
- 已归档 Case 不重复改写 `archived_at`，直接返回当前资源；
- 不执行物理删除。

成功返回 `200` 和归档后的 Case。

## 4. Case 响应合同

所有单资源响应只返回以下字段：

```text
id
site_url
normalized_domain
business_name
business_identity
operating_model
primary_service
target_market
status
latest_report_id
archived_at
created_at
updated_at
```

`user_id` 和内部 `location_key` 不返回给浏览器。列表的 `items` 使用相同资源形状，避免详情和列表产生两套语义。

## 5. 输入合同与规范化

使用现有 AJV 依赖编译严格 JSON Schema；所有对象 `additionalProperties=false`。

### 5.1 文本限制

- `business_name`：trim 后 1—240 字符；
- `primary_service`：trim 后 1—200 字符；
- Location `display_name`：trim 后 1—200 字符；
- `region`、`city`：null 或 trim 后最多 120 字符；
- `postal_code`：null 或 trim 后最多 32 字符；
- 空的可选 Location 字符串规范为 null；
- `country_code`：trim 并转大写后必须匹配 `^[A-Z]{2}$`。

### 5.2 URL 规则

- `site_url` 必须是绝对 HTTP 或 HTTPS URL；
- 禁止 username、password、localhost、`.local` 域名和 loopback/private/link-local IP literal；
- hostname 使用 URL 解析器的 IDNA 结果，转小写并去除前导 `www.` 得到 `normalized_domain`；
- `site_url` 移除 query 和 fragment，保留业务路径，移除非根路径末尾的 `/`，并使用 URL 解析器规范默认端口；
- `public_gbp_url` 为 null 或绝对 HTTPS URL，不作为获客发现或 Google API 调用入口。

此处只执行存储边界的静态 URL 检查。V22-020 采集前仍必须重新解析 DNS 并执行完整 SSRF 防护，不能依赖本接口的结果。

### 5.3 Location 规则

Location 使用 V22-003 `TargetMarket` 的字段语义：

- `display_name` 和 `country_code` 必填；
- latitude 范围 -90—90；
- longitude 范围 -180—180；
- 经纬度必须同时为 number 或同时为 null；
- 未提供的 `region`、`city`、`postal_code`、latitude、longitude 规范为 null。

`primary_location` 表示商家身份 Location；`target_market` 表示本次 Local SEO 分析的搜索市场，二者可以不同。

## 6. `business_identity` 构造

客户端不直接提交数据库 `business_identity`。服务端固定构造：

```json
{
  "business_name": "...",
  "site_url": "...",
  "normalized_domain": "...",
  "operating_model": "storefront",
  "primary_location": {},
  "public_gbp_url": null
}
```

创建和 PATCH 都通过同一个纯函数构造该对象。读取时不根据顶层字段临时拼装，数据库值必须已保持一致。

## 7. 数据库唯一 Location Key

新增一份前向 migration：

1. 创建 immutable 函数 `public.v22_case_location_key(jsonb)`；
2. 为 `client_cases` 增加 nullable stored generated column `location_key`；
3. 创建 partial unique index `(user_id, normalized_domain, location_key) where location_key is not null`；
4. 创建触发器，拒绝已存在 Case 的 `site_url` 或 `normalized_domain` 更新；
5. 添加条件一致性约束：有完整 `primary_location` 的 Case，其 `business_identity` 中的 business name、site URL、domain 和 operating model 必须与顶层字段一致；V22-011 前的不完整内部行继续兼容；
6. 为 generated column 添加说明，不授予浏览器权限。

函数规则：

- `primary_location` 不是 object 或缺少必要字段时返回 null，使 migration 能兼容 V22-010 后、V22-011 前可能存在的不完整内部数据；
- 经纬度完整时返回 `geo:<latitude fixed 6>:<longitude fixed 6>`；
- 否则返回 `place:<country>|<region>|<city>|<postal>|<display>`；
- place 组成部分统一 trim、压缩连续空白并转小写；
- 新 API 保证所有新 Case 都能生成非空 key。

TypeScript 规范化函数实现相同规则，用于冲突后定位已有 Case。数据库集成测试必须验证 SQL 和 TypeScript 对同一组 Location fixture 生成完全相同的 key。

唯一索引包含 active 和 archived Case。并发插入或并发 Location 更新由数据库唯一约束最终裁决，不能只依赖 API 的先查后写。

## 8. 代码结构

```text
src/lib/cases/
  contracts.ts     请求、响应和 AJV schema
  normalize.ts     URL、文本、Location 和 key 规范化
  errors.ts        Case 领域错误
  repository.ts    user-scoped Supabase 查询
  service.ts       Case 生命周期和字段一致性

src/app/api/v2/cases/
  route.ts
  [id]/route.ts
```

Route Handler 只负责：

1. 调用 `getCurrentUser()`；
2. 读取 request 和 route params；
3. 调用 Case service；
4. 把领域结果映射为稳定 HTTP 响应。

Case service 不直接解析 Clerk session。Repository 的每个公开方法都必须接收 `userId`，且 Supabase 查询必须显式包含 `.eq('user_id', userId)`；service role 绕过 RLS，不能把 RLS 当成用户隔离条件。

Handler 通过小型 factory 接收 auth 和 service 依赖。生产导出使用真实依赖，测试注入真实 service 加内存 repository，不需要修改全局模块状态。

## 9. 数据流

```text
HTTP request
  → Clerk getCurrentUser
  → strict JSON/query/UUID validation
  → normalization
  → Case service
  → user-scoped repository
  → Supabase constraints and unique index
  → response projection
  → stable v2 JSON response
```

创建时，service 先做友好重复检查；数据库 unique index 负责并发最终一致性。若 insert 或 update 返回 PostgreSQL `23505`，service 查询当前用户相同 domain/key 的 Case，并映射为 `CASE_ALREADY_EXISTS`。

## 10. 错误合同

统一格式：

```json
{
  "error": {
    "code": "CASE_NOT_FOUND",
    "message": "Case not found."
  }
}
```

错误代码：

| HTTP | code | 用途 |
|---:|---|---|
| 400 | `INVALID_REQUEST` | JSON、query、UUID 或字段校验失败 |
| 401 | `UNAUTHORIZED` | 没有 Clerk 用户 |
| 404 | `CASE_NOT_FOUND` | Case 不存在或属于其他用户 |
| 409 | `CASE_ALREADY_EXISTS` | 同用户/domain/Location 冲突 |
| 409 | `CASE_ARCHIVED` | 尝试修改未恢复的 archived Case |
| 500 | `INTERNAL_ERROR` | 未预期服务端或数据库错误 |

`INVALID_REQUEST` 可以包含安全的字段级 `issues`，但不返回数据库错误、堆栈或完整请求。`CASE_ALREADY_EXISTS` 的 error 对象额外包含：

```json
{
  "case_id": "uuid",
  "status": "active"
}
```

服务端日志只记录错误代码、路由和 request ID；不得记录整个 `business_identity`、客户 URL query、认证头或 Supabase secret。

## 11. 测试策略

### 11.1 纯函数与合同

- 文本、国家代码、空值和 Location 规范化；
- 经纬度成对、范围和 key 生成；
- HTTP/HTTPS、credentials、localhost、private IP 和 GBP URL；
- 未知字段、系统字段和空 PATCH 拒绝；
- `business_identity` 构造与顶层字段一致。

### 11.2 Handler 与 service

- collection 和 item 操作未登录均为 401；
- 正常创建、分页列表、详情、确认信息更新、归档、重复归档和恢复；
- active Case 的非法 status PATCH；
- archived Case 未恢复前修改返回 409；
- 非法 UUID 和错误查询参数返回 400；
- 其他用户读取、修改、归档和恢复统一 404；
- 相同 domain/Location 返回 409 和已有 ID；
- 相同 domain、不同 Location 创建成功；
- Location 更新产生重复时返回 409。

### 11.3 数据库

- V22-010 后顺序应用 V22-011 migration；
- 历史 incomplete Case 不阻断 migration；
- generated key 与 TypeScript fixture 一致；
- 数据库拒绝修改已有 Case 的 site URL 或 normalized domain；
- 完整 business identity 与顶层字段不一致时写入失败；
- 唯一索引覆盖 active 和 archived；
- 不同用户可以有同 domain/Location；
- 不同 Location 可以共享 domain；
- 并发最终由 `23505` 拒绝重复；
- v2.1 reports 和 V22-010 删除级联保持不变。

### 11.4 全量回归

- `npm test`；
- `npm run typecheck`；
- `npm run contracts:check`；
- `npm run build`；
- 有 Docker 的环境运行 `supabase db reset`、`supabase db lint` 和 `supabase test db`。

## 12. 安全与隐私

- Clerk 只负责 SearchTrust 登录；Case API 不涉及 Google OAuth。
- Supabase client 仅在服务端创建，service role key 不进入响应或客户端 bundle。
- 所有 repository 查询显式按当前 `user_id` 限定。
- 跨用户访问与真实不存在使用相同 404。
- DELETE 只归档，硬删除留给后续明确的隐私删除流程。
- 不记录原始 Authorization header、完整请求体或数据库错误。
- 本 API 的 URL 校验不能替代采集阶段 DNS rebinding/SSRF 防护。

## 13. 非目标

- 不创建 Case 页面或表单；
- 不调用 V22-020 预检；
- 不生成默认关键词或竞品；
- 不实现 Google Connection/Binding CRUD；
- 不创建报告或 analysis job；
- 不扣 Credits 或发起支付；
- 不实现隐私硬删除；
- 不改动现有 `/api/reports` 与 v2.1 行为。

## 14. 验收标准

V22-011 完成必须同时满足：

- 五个 Case 操作端点按本规格工作；
- `site_url` 和 `normalized_domain` 创建后不可修改；
- 重复 Location 由数据库唯一索引防止并发绕过；
- active/archived 生命周期、幂等归档和恢复通过；
- 每条生产 Supabase 查询显式包含当前用户归属；
- 未授权与跨用户测试通过；
- 统一错误合同不泄露数据库或其他用户信息；
- TypeScript、Vitest、合同漂移检查和生产 build 通过；
- 不实现 V22-011 之外的 UI、OAuth、预检、任务或报告功能。

完成后按总计划进入 V22-012 持久任务或已排定的并行轨道。
