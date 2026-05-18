# SearchTrust 全栈面试文档

> 基于 SearchTrust 项目整理，涵盖项目介绍、技术选型、核心模块实现细节、难点与解决方案。

---

## 一、项目介绍（1 分钟电梯演讲）

**SearchTrust** 是一个 B2B SaaS 工具，帮助本地商家诊断其网页的 Google 信任问题。用户输入一个 URL，系统调用后端 AI 分析接口，生成一份包含 5 个模块的结构化信任诊断报告（Executive Summary、Page Level、Key Issues、Six-Layer Model、Optimization Path），包含信任状态、排名潜力、风险等级等评估维度。

**技术栈**：Next.js 16 (App Router) + TypeScript + Tailwind CSS + Clerk（认证）+ Supabase（数据库）+ Resend（邮件）+ Vercel（部署）

**核心业务流程**：用户登录 → 填写 URL → 调用后端 AI 创建分析任务 → 前端轮询任务状态 → 完成后解析并存入数据库 → 渲染报告

---

## 二、技术选型

### Q1: 为什么选 Next.js App Router 而不是 Pages Router？

**答**：
- App Router 支持 React Server Components，减少客户端 JS 体积
- 路由嵌套布局（Layout）更灵活，如 `/reports` 页面的 BackHeader 只渲染一次
- API 路由与页面路由统一在 `src/app/` 下，结构更清晰
- 内置 `loading.tsx`、`error.tsx` 等约定式文件，简化 loading/error 处理
- 本项目需要大量 API 路由（generate-report、report-status、reports 等），App Router 的 `route.ts` 模式更直观

### Q2: 为什么选 Clerk 而不是自建认证或 NextAuth？

**答**：
- Clerk 提供 Google OAuth 开箱即用，无需自建登录页面和 session 管理
- Clerk 中间件（`clerkMiddleware`）自动处理 session 注入，API 路由里 `await auth()` 即可获取用户信息
- 免费额度 10,000 MAU，够早期用户使用
- 提供 `useUser()` 客户端 hook 和 `auth()` 服务端函数，前后端都能方便获取用户
- 内置 Webhook 支持（`user.created` 事件），可自动同步用户到数据库

### Q3: 为什么选 Supabase 而不是 MongoDB 或自建 PostgreSQL？

**答**：
- 关系型数据天然适合（用户-报告-订单是一对多关系）
- Supabase 提供免费的 PostgreSQL 实例（500MB），自带连接池和 REST API
- 使用 `service_role` key 可以在 API 路由中绕过 RLS，同时保留 RLS 能力给未来扩展
- 不需要 ORM（如 Prisma），直接写 SQL 查询，更轻量

### Q4: 为什么用 Lemon Squeezy 而不是 Stripe？

**答**：
- Lemon Squeezy 作为 Merchant of Record (MoR) 处理税务、发票，无需企业资质
- 个人开发者即可接入全球收款（信用卡、PayPal、Apple Pay、Google Pay）
- Stripe 需要企业主体和银行账户才能收款， Lemon Squeezy 不需要
- 每笔交易 5% + $0.50 的手续费虽然略高，但对早期产品可接受

---

## 三、认证与用户系统

### Q5: Clerk 用户是如何同步到 Supabase 的？

**答**：两层保障：

1. **Webhook（主路径）**：Clerk 用户注册时触发 `user.created` 事件 → 调用 `/api/webhook/clerk` → 在 Supabase users 表插入记录（`clerk_user_id`、`email`、`audit_credits = 5`）。使用 Svix 验证 webhook 签名防伪造。

2. **兜底逻辑**：`getCurrentUser()` 函数在每次 API 调用时执行。如果查 Supabase 没找到用户（webhook 延迟或未触发），会主动调用 Clerk API 获取用户信息，手动创建记录。

```typescript
// src/lib/auth.ts 核心逻辑
export async function getCurrentUser() {
  const session = await auth();           // Clerk session
  const clerkUserId = session.userId;
  if (!clerkUserId) return null;

  const { data } = await supabase
    .from("users")
    .select("id, audit_credits")
    .eq("clerk_user_id", clerkUserId)
    .single();

  if (data) return { userId: data.id, auditCredits: data.audit_credits };

  // 兜底：webhook 未触发时手动创建
  const { data: newUser } = await supabase
    .from("users")
    .insert({ clerk_user_id: clerkUserId, email, audit_credits: 5 })
    .select("id, audit_credits")
    .single();

  return newUser ? { userId: newUser.id, auditCredits: newUser.audit_credits } : null;
}
```

### Q6: API 路由如何做鉴权？中间件的配置逻辑是什么？

**答**：

**中间件层**（`src/middleware.ts`）：使用 Clerk 的 `clerkMiddleware`，通过 `createRouteMatcher` 定义公开路由。非公开路由自动触发 `auth.protect()`，未登录用户会被重定向到 Clerk 登录页。

关键：`/api/(.*)` **不能**放入公开路由，否则 Clerk 不会注入 session 到 API 请求中，导致 `await auth()` 拿不到用户信息返回 401。

```typescript
const isPublicRoute = createRouteMatcher([
  "/", "/framework", "/sample-report", "/pricing", "/policy",
  "/reports",                        // 页面本身公开，组件内判断登录态
  "/api/webhook/(.*)",               // Webhook 必须公开（Clerk/支付回调不带 session）
]);
```

**API 路由层**：每个需要鉴权的 API 都调用 `getCurrentUser()`，未登录返回 401，credits 不足返回 403。

### Q7: 遇到的认证相关难点？

**难点 1：Clerk Development 模式限制**
- Development 实例（`pk_test_`）只支持 `localhost` 和 `*.accounts.dev` 域名
- "Allowed subdomains" 功能只在 Production 模式可用
- 解决：本地用 localhost 测试，正式上线前在 Clerk Dashboard 升级为 Production 实例

**难点 2：Supabase RLS 权限问题**
- 即使用 `service_role` key，Supabase 仍要求显式 `GRANT` 权限
- 报错：`permission denied for table users`
- 解决：在 Supabase SQL Editor 执行 `GRANT ALL ON public.users TO service_role;`

---

## 四、报告生成核心流程

### Q8: 完整描述一次报告生成的流程

**答**：

```
1. 用户点击 "Run a Trust Audit" 按钮
   → RunAuditButton 调 /api/user/credits 检查 credits
   → credits ≤ 0 → 跳转 /pricing
   → credits > 0 → 弹出 AuditFormModal

2. 用户填写 URL + Page Type → 提交
   → AuditModalProvider 调 POST /api/generate-report
   → 后端调第三方 AI 接口 POST /api/v1/analyze { url, page_type, language }
   → 拿到 task_id
   → 扣减 audit_credits (-1)
   → Supabase reports 表插入记录（status = "free_preview"）
   → 返回 { task_id, report_id }

3. 前端跳转 /reports?task_id=xxx&report_id=xxx
   → 每 3 秒轮询 GET /api/report-status?task_id=xxx
   → 后端调第三方 GET /api/v1/task/{task_id}
   → status !== "done" → 返回进度 { stage, percent, message }
   → status === "done" → 解析 result：
      a. result.score 去除 ```json ``` 包裹，JSON.parse 得到 5 个模块
      b. 顶层字段直接存入 reports 表
      c. 返回完整报告数据
   → 前端停止轮询，渲染报告

4. 失败处理
   → status === "failed" → audit_credits += 1（退还）
   → 网络异常 → 5 秒后重试
```

### Q9: 轮询机制是怎么实现的？为什么不用 WebSocket 或 SSE？

**答**：

**轮询实现**：
- 前端用 `useEffect` + `setTimeout` 递归实现，每 3 秒调一次
- 轮询期间显示进度条（percent + message）
- 成功/失败后停止轮询，通过 `window.history.replaceState` 清理 URL 参数
- 组件卸载时通过 `stopped` 标志位终止轮询

```typescript
const poll = async () => {
  if (stopped) return;
  const res = await fetch(`/api/report-status?task_id=${taskId}`);
  const data = await res.json();

  if (data.status === "done") {
    stopped = true;
    await loadHistory();
    fetchReport(data.reportId);
    window.history.replaceState({}, "", "/reports");  // 清理 URL
    return;
  }
  setPollProgress(data.progress);
  setTimeout(poll, 3000);  // 递归轮询
};
```

**为什么不用 WebSocket/SSE**：
- 报告生成时间通常 30 秒~2 分钟，不是高频实时场景
- 轮询实现简单，不需要维护 WebSocket 连接
- Next.js API Route 天然支持请求-响应模式，WebSocket 需要额外配置
- 3 秒间隔对用户体验影响可忽略

### Q10: 后端返回的 score 数据是如何解析和存储的？

**答**：

后端返回的 `result.score` 是一个被 ` ```json\n...\n``` ` 包裹的字符串，需要手动提取：

```typescript
function parseScore(scoreStr: string) {
  const jsonStr = scoreStr
    .replace(/^```json\n/, '')    // 去掉开头的 ```json
    .replace(/\n```$/, '');        // 去掉结尾的 ```
  return JSON.parse(jsonStr);
}
```

解析后拆分为 5 个 JSONB 字段分别存入 Supabase：
- `module_1_overview` → Executive Summary
- `module_2_page_level` → Page Level
- `module_3_key_problems` → Key Issues
- `module_4_eight_layers` → Six-Layer Model
- `module_5_optimization` → Optimization Path

**为什么拆分存储而不是存一个整体 JSON？**
- 前端按模块渲染，拆开后可以直接 `report.module_1_overview` 读取，无需每次解析
- 可以单独更新某个模块
- JSONB 类型支持 PostgreSQL 原生 JSON 查询，未来可按模块内容搜索

---

## 五、数据库设计

### Q11: 三张表的设计思路

**答**：

```
users 1 ──── N reports     （一个用户有多份报告）
users 1 ──── N orders      （一个用户有多笔订单）
```

- **users**：Clerk 认证用户，`clerk_user_id` 唯一索引关联 Clerk，`audit_credits` 控制使用次数
- **reports**：每份报告的完整数据，`task_id` 关联后端任务，`status` 区分免费/付费，5 个 JSONB 字段存模块数据
- **orders**：订单记录，`status` 跟踪支付状态，`credits_purchased` 记录购买的次数

### Q12: reports 表为什么用 status 字段而不是 is_paid 布尔值？

**答**：
- 状态可能不止两种（未来可能加 `expired`、`refunded` 等）
- `CHECK (status IN ('free_preview', 'paid_full'))` 约束保证数据一致性
- 语义更清晰，`free_preview` 表示"免费预览"，`paid_full` 表示"已付费完整版"
- 便于后续扩展更多状态

---

## 六、前端架构

### Q13: 组件复用策略——/sample-report 和 /reports 如何共用 ReportContent？

**答**：

`ReportContent` 组件通过 props 控制差异：

```typescript
<ReportContent
  report={report}
  isPaid={report.status === "paid_full"}   // 控制是否显示解锁遮罩
  isLoading={isLoading}
/>
```

- `/sample-report`：传入 `isPaid={true}`，5 个模块全部可见，无左侧历史列表
- `/reports`：根据 `report.status` 动态判断，前 2 个模块免费可见，后 3 个显示解锁遮罩

解锁遮罩逻辑：
```typescript
const isLocked = (tab: TabId) => {
  if (isPaid) return false;
  return tab !== 'Executive Summary' && tab !== 'Page Level';
};
```

### Q14: RunAuditButton 的公用逻辑是怎么设计的？

**答**：

`RunAuditButton` 封装了完整的点击链路，所有页面复用同一个按钮：

```
点击 → 是否登录？
  ├── 未登录 → 弹出 GoogleLoginModal
  └── 已登录 → credits > 0？
       ├── credits ≤ 0 → 跳转 /pricing
       └── credits > 0 → 弹出 AuditFormModal
```

通过 `AuditModalProvider`（Context）统一管理 Modal 状态，避免每个页面重复写 Modal 逻辑。

### Q15: 报告页的 loading 状态是如何处理的？

**答**：三层 loading 状态：

1. **首次进入**：`historyLoading` 状态，显示全局 spinner，直到历史列表加载完成
2. **切换报告**：`isLoading` 状态，报告内容区域显示骨架屏（`LoadingState`）
3. **轮询生成**：`polling` 状态，显示进度条和百分比

避免的问题：首次进入报告页时，之前会先显示空内容"Select a report to view"再突然切换到报告，用户体验差。加了 `historyLoading` 后，加载完成前显示 spinner，加载完直接渲染报告。

### Q16: 左侧历史列表如何实现固定定位滚动？

**答**：

```tsx
<aside className="hidden lg:block w-64 flex-shrink-0">
  <div className="sticky top-6">
    <div className="space-y-8 max-h-[calc(100vh-120px)] overflow-y-auto pr-1">
      {/* 报告列表 */}
    </div>
  </div>
</aside>
```

- 外层 `sticky top-6`：让列表在页面滚动时固定在视口顶部
- `max-h-[calc(100vh-120px)] overflow-y-auto`：列表内容超出视口高度时自身可滚动
- 右侧报告内容可以自由滚动，左侧列表始终可见

---

## 七、项目难点与解决方案

### 难点 1：后端 API 兼容性问题（page_type 中文枚举）

**问题**：后端老师为了方便测试将 `page_type` 改成了中文枚举值（如"本地服务落地页"），但前端展示和存储都是英文（如"Service Page"）。

**解决方案**：在 API 路由层加映射，前端保持英文，只在调后端时翻译：

```typescript
const PAGE_TYPE_MAP: Record<string, string> = {
  "Service Page": "本地服务落地页",
  "Location Page": "实体目的地",
  "City Page": "门店信息",
  // ...
};

// 调后端时使用映射值
body: JSON.stringify({
  page_type: PAGE_TYPE_MAP[page_type] || page_type,
})
```

后端统一改成英文后删除此映射即可，前端零改动。

### 难点 2：Clerk middleware 导致 API 401

**问题**：最初把 `/api/(.*)` 放入 `isPublicRoute`，导致所有 API 请求 Clerk 不注入 session，`await auth()` 返回 null。

**根因**：Clerk middleware 对 public route 不处理 session，只有 protected route 才会注入认证信息。

**解决**：只保留 `/api/webhook/(.*)` 为 public（webhook 不带用户 session），其余 API 路由让 Clerk 正常处理 session。

### 难点 3：解锁遮罩的交互优化

**问题**：最初用 `bg-white/40 backdrop-blur-md` + `opacity-20 blur-[3px]` 的组合，遮罩几乎不透明，用户感知不到下方有内容，像一块空白区域。

**解决方案**：调整为更通透的毛玻璃效果：
- 遮罩层：`bg-white/30 backdrop-blur-[3px]`（白色更透明，模糊更轻）
- 底层内容：`opacity-50 blur-[4px]`（50% 不透明度让结构可见，4px 模糊让文字不可读）
- 中间解锁卡片：`bg-white/90 backdrop-blur-sm`（半透明毛玻璃质感）

效果：用户能隐约看到下方有结构化内容的色块和布局，激发解锁欲望，但具体文字完全不可读。

### 难点 4：后端 score 数据格式不规范

**问题**：后端返回的 `result.score` 不是纯 JSON，而是被 ` ```json\n...\n``` ` 包裹的字符串，无法直接 `JSON.parse`。

**解决方案**：

```typescript
function parseScore(scoreStr: string) {
  const jsonStr = scoreStr
    .replace(/^```json\n/, '')
    .replace(/\n```$/, '');
  return JSON.parse(jsonStr);
}
```

这种防御性解析保证了即使后端格式微调（比如加空格、换行风格变化），也能正确提取。

### 难点 5：报告生成失败时的 credits 退还

**问题**：用户提交报告后立即扣减 credits，但如果后端分析失败（status === "failed"），用户不应该被扣费。

**解决方案**：
1. 生成时立即扣减（乐观扣减），避免并发重复提交
2. 轮询到 `failed` 状态时，自动退还 credits（`audit_credits += 1`）
3. 轮询网络异常时不退还（可能是暂时网络问题，后端可能仍在处理）

---

## 八、待开发功能的技术方案

### Q17: Lemon Squeezy 支付集成的方案？

**答**：

```
用户点击购买 → POST /api/checkout → 调 Lemon Squeezy API 创建 Checkout
→ 跳转 Lemon Squeezy 托管付款页 → 用户支付
→ Lemon Squeezy 回调 POST /api/webhook/lemonsqueezy
→ 验证签名 → 更新 orders 表 (status = paid)
→ 更新 users.audit_credits += 购买次数
```

关键点：
- Webhook 必须验签（Lemon Squeezy 使用 HMAC-SHA256）
- 使用数据库事务保证 orders 和 credits 更新的原子性
- 幂等处理：同一 `order_id` 不重复加 credits

### Q18: PDF 导出的方案？

**答**：

使用 `html2pdf.js` 客户端生成 PDF：
- 优点：无需服务端渲染，不占用服务器资源
- 实现方式：将 `ReportContent` 组件渲染到隐藏 DOM → `html2pdf().from(element).save()`
- 注意：需要处理图表（Recharts）的 SVG 渲染、多页分页、中文字体支持

---

## 九、性能与部署

### Q19: Vercel 部署的配置和注意事项？

**答**：
- Next.js 原生部署到 Vercel，零配置
- 环境变量通过 Vercel Dashboard 配置（Clerk keys、Supabase keys、Resend key 等）
- Clerk 需要升级为 Production 模式，配置自定义域名 `trysearchtrust.com`
- API 路由默认超时 300s（Vercel Fluid Compute），足够报告轮询使用

### Q20: 数据库索引策略？

**答**：

```sql
CREATE INDEX idx_users_clerk_id ON users (clerk_user_id);      -- 登录时查用户
CREATE INDEX idx_reports_user_id ON reports (user_id);          -- 查用户的所有报告
CREATE INDEX idx_reports_created_at ON reports (created_at DESC); -- 按时间排序
CREATE INDEX idx_orders_order_id ON orders (order_id);          -- Webhook 回调查订单
```

高频查询场景：
- `getCurrentUser()`：通过 `clerk_user_id` 查用户 → 走 `idx_users_clerk_id`
- `/api/reports`：通过 `user_id` 查报告列表 → 走 `idx_reports_user_id` + `idx_reports_created_at`
- 支付回调：通过 `order_id` 查订单 → 走 `idx_orders_order_id`

---

## 十、开放性问题

### Q21: 如果用户量增长到 10 万+，你会做哪些优化？

**答**：

1. **数据库**：Supabase 连接池优化，高频查询加 Redis 缓存（用户 credits、最近报告）
2. **轮询**：改用 SSE 或 WebSocket 推送，减少无效请求
3. **报告存储**：5 个 JSONB 模块数据较大，考虑压缩存储或分离到对象存储
4. **CDN**：静态资源（图片、字体）走 CDN
5. **队列**：报告生成请求走消息队列（如 BullMQ），避免第三方 API 并发限制
6. **监控**：接入 Sentry 错误追踪 + Vercel Analytics 性能监控

### Q22: 如果后端 API 响应变慢（>5 分钟），怎么处理？

**答**：

1. **前端**：增加轮询超时上限（如 10 分钟），超时后提示用户并提供重试
2. **后端**：报告状态标记为 `timeout`，退还 credits
3. **异步通知**：收集用户邮箱，报告完成后发邮件通知（不需要用户一直等在页面上）
4. **缓存**：同一 URL 24 小时内不重复分析，直接返回缓存结果

### Q23: 你在项目中做的最有挑战的技术决策是什么？

**答**（参考）：

**数据同步的两层保障机制**。Clerk Webhook 可能因为网络问题延迟或丢失，导致用户登录后 Supabase 里没有记录。我在 `getCurrentUser()` 里加了兜底逻辑：查不到就自动创建。这保证了即使 Webhook 失败，用户的第一次 API 调用也能正常工作。这是一个"最终一致性"的设计思路——Webhook 是主路径，兜底是容灾路径。
