# SearchTrust 技术方案文档 V2

> 基于 V1 方案的全面更新。主要变更：支付从 Lemon Squeezy 改为 Dodo Payments、轮询改为 SSE 长连接、新用户免费次数从 5 改为 1、流程统一为"先填信息再判断登录"、GBP URL 改为必填。

---

## 项目概述

SearchTrust 是一个 B2B SaaS 工具，用于诊断本地页面的 Google 信任问题。用户输入 URL，系统生成一份结构化的信任诊断报告。

---

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端框架 | Next.js 16 (App Router) | 前后端一体 |
| 语言 | TypeScript | 全栈统一语言 |
| UI | Tailwind CSS + Framer Motion | 样式 + 动画 |
| 认证 | Clerk | Google 登录，无需自建 OAuth |
| 支付 | Dodo Payments (Merchant of Record) | 支持个人账户，MVP 使用跳转式 Checkout |
| 邮件 | Resend | 发送报告 PDF 到用户邮箱 |
| 数据库 | Supabase (PostgreSQL) | 存储报告、订单、用户数据 |
| 部署 | Vercel | Next.js 原生部署平台 |
| 图表 | Recharts | 报告内数据可视化 |

---

## 架构设计

### 整体架构

```
浏览器
  ↓
Next.js (Vercel)
  ├── 前端页面 (src/app/**/page.tsx)
  ├── API 路由 (src/app/api/**/route.ts)
  │     ├── 调用后端报告生成接口（第三方 SSE）
  │     ├── 调用 Dodo Payments 处理支付
  │     ├── 调用 Resend 发送邮件
  │     └── 调用 Supabase 存取数据
  └── Middleware (src/middleware.ts) — 路由鉴权
```

### 职责划分

| 谁负责 | 做什么 |
|--------|--------|
| **后端老师** | 报告生成接口（输入 URL → SSE 推送各阶段数据 → 返回完整报告） |
| **你的 Next.js** | 调用后端接口、用户认证、支付、邮件、订单管理、数据库 |

---

## 业务规则

### 用户与 Credits 规则

| 规则 | 说明 |
|------|------|
| 新用户免费次数 | 注册后 `audit_credits = 1`，可免费执行 1 次 Trust Audit |
| Credits 字段 | 余额统一使用 `audit_credits`，报告权益来源用 `reports.access_type` 记录 |
| 次数用完 | `audit_credits = 0` 时进入 Dodo Payments Checkout |
| 支付成功 | `audit_credits += 1`（按次付费，买 1 次跑 1 次） |
| 报告生成成功 | `audit_credits -= 1`（成功后扣减） |
| 报告生成失败 | 不扣减 credits（先支付 +1，失败不 -1） |
| 幂等原则 | 同一份 `pending` 报告只能完成一次；重复保存结果不重复扣减 credits |

### Credits 流转

```
新用户注册 → audit_credits = 1

执行报告（audit_credits > 0）:
  → 调后端接口生成报告
  → 成功 → audit_credits - 1
  → 失败 → 不扣

执行报告（audit_credits = 0）:
  → 跳转 Dodo Payments Checkout
  → 支付成功回跳 /reports?payment=success
  → 服务端确认支付成功 → audit_credits + 1
  → 调后端接口生成报告
  → 成功 → audit_credits - 1
  → 失败 → 不扣（用户保留刚充的 credit）
```

### 报告可见性

| 规则 | 说明 |
|------|------|
| 免费报告可见范围 | 报告 `status = free_preview`，只能看前 2 个阶段（Executive Summary + Page Level），后 3 个阶段显示解锁遮罩 |
| 付费报告 | 报告 `status = paid_full`，5 个阶段全部可见 |
| 解锁旧报告 | 用户可以对历史 `free_preview` 报告单独付费解锁 → 调 `POST /api/reports/[id]/unlock` → `status` 改为 `paid_full` |
| 权益来源 | `access_type = free_trial` 的成功报告为 `free_preview`；`access_type = paid_credit / unlocked` 的报告为 `paid_full` |

---

## 核心业务流程

### 流程 1：Run a Trust Audit（统一主流程）

> 两个入口（独立按钮 / 内嵌表单）使用相同的判断顺序：填信息 → 判断登录 → 判断 credits → 跑报告或支付

#### 入口 1：页面独立按钮 "Run a Trust Audit"

```
用户点击 "Run a Trust Audit" 按钮
  ↓
弹出 AuditFormModal（填写表单）
  - URL（必填）
  - GBP URL（必填）
  - Page Type（选择：Service Page / Location Page 等）
  ↓
填完点击弹窗上的 "Run a Trust Audit" 按钮
  ↓
必填项是否完整？
  ├── 否 → 提示补填
  └── 是 ↓
是否登录？
  ├── 否 → 弹出 GoogleLoginModal → 登录成功后继续
  └── 是 ↓
audit_credits > 0?
  ├── 是 → 调后端接口跑报告（SSE）→ 见"报告生成流程"
  └── 否 → 跳转 Dodo Payments Checkout
              → 支付成功并由服务端确认 → audit_credits + 1
              → 调后端接口跑报告（SSE）→ 见"报告生成流程"
```

#### 入口 2：页面内嵌表单 AuditForm

```
用户填写 URL / GBP URL / Page Type
  ↓
点击表单上的 "Run a Trust Audit" 按钮
  ↓
必填项是否完整？
  ├── 否 → 提示补填
  └── 是 ↓
是否登录？
  ├── 否 → 弹出 GoogleLoginModal → 登录成功后继续
  └── 是 ↓
audit_credits > 0?
  ├── 是 → 调后端接口跑报告（SSE）→ 见"报告生成流程"
  └── 否 → 跳转 Dodo Payments Checkout
              → 支付成功并由服务端确认 → audit_credits + 1
              → 调后端接口跑报告（SSE）→ 见"报告生成流程"
```

### 报告生成流程（SSE 长连接，替代轮询）

```
前端调 POST /api/generate-report
  → Next.js 校验登录、URL、GBP URL、credits
  → 根据本次消耗来源创建 reports 记录：
      status = pending
      access_type = free_trial | paid_credit
  → Next.js 调后端 POST /api/v1/analyze { url, page_type, language, gbp_url }
  → 后端返回 { task_id }
  → 更新 reports.task_id
  → 返回 { task_id, report_id } 给前端
  ↓
前端跳转到 /reports?task_id=xxx&report_id=xxx
  ↓
前端建立 SSE 连接：GET /api/v1/task/{task_id}/stream
  → 后端持续推送消息，每条结构：
    {
      "task_id": "xxx",
      "status": "scraping | analyzing | reporting | done | failed",
      "progress": {
        "stage": "loading",
        "percent": 30,
        "message": "正在读取页面…"
      },
      "result": null,
      "error": null
    }
  → 前端根据 progress.percent 更新进度条
  → 收到 status === "done"
      1. 取 result 对象
      2. 解析 result.score：去除 ```json ``` 包裹，JSON.parse
      3. 拆分为 5 个模块，通过 POST /api/report-status 保存到 reports 表
      4. 服务端只允许 pending → 完成状态的一次迁移
      5. 按 access_type 决定报告状态：
          - free_trial → free_preview
          - paid_credit → paid_full
      6. audit_credits - 1（成功扣减，且只扣一次）
      7. 关闭 SSE 连接，渲染完整报告
  → 收到 status === "failed"
      1. 取 error 信息
      2. 不扣减 audit_credits
      3. 关闭 SSE 连接，展示错误提示
```

### SSE 连接说明

```
前端（浏览器）                 后端（Railway）
     │                              │
     │── GET /task/{id}/stream ───→ │
     │                              │
     │←─ event: progress 30% ──────│
     │←─ event: progress 55% ──────│
     │←─ event: progress 80% ──────│
     │←─ event: done + result ─────│
     │                              │
     │── 关闭连接                   │
```

**为什么用 SSE 替代轮询：**
- 轮询每 3 秒一次 HTTP 请求，浪费资源
- SSE 是服务端主动推送，实时性更好
- 前端只需连一次，根据推送更新进度
- Vercel 300s 超时足够（报告生成通常 30-90 秒）

**SSE 安全边界：**
- MVP 可以由浏览器直连 Railway SSE，但必须确认后端支持 CORS、`task_id` 不可枚举、SSE 不返回跨用户敏感数据
- 生产更推荐 Next.js 增加 `/api/tasks/[task_id]/stream` 代理：先校验当前用户拥有该 `task_id`，再转发后端 SSE

### 流程 2：支付流程（Dodo Payments 跳转式 Checkout）

```
audit_credits = 0，用户点击 "Run a Trust Audit"
  ↓
前端调 POST /api/checkout
  → 创建 Dodo Payments Checkout
  → 携带 order_id、clerk_user_id、待继续执行的表单数据
  ↓
跳转到 Dodo Checkout 页面
  → 用户完成支付（信用卡 / PayPal 等）
  ↓
支付成功回跳 /reports?payment=success
  → 前端调 POST /api/checkout/confirm 或轮询订单状态
  → 服务端向 Dodo 验证支付状态
  → 幂等更新 orders 表（status = paid）
  → 幂等执行 audit_credits += 1
  → 确认到账后，前端自动继续执行报告生成流程
  ↓
Dodo Payments 服务端 webhook（异步确认）
  → POST /api/webhook/dodo
  → 后端验证签名
  → 确保订单状态和 credits 已更新（幂等）
```

**为什么 MVP 先用跳转式 Checkout：**
- 集成更简单，支付页由 Dodo 托管，合规、3DS、钱包支付、异常态都更省心
- 用户离站再回跳会损失一点连续感，但对单次 $19 的工具型购买可以接受
- 弹窗 overlay 对浏览器拦截、移动端体验、SDK 加载失败、回调可靠性更敏感，建议等主链路稳定后再做

### 流程 3：查看报告页

```
/reports 页面
  ├── 左侧：历史报告时间列表（按日期分组）
  │     └── 点击某条报告 → 右侧更新为该报告内容
  └── 右侧：报告内容（5 个阶段 Tab）
        ├── paid_full → 5 个阶段全部可见
        └── free_preview → 只看前 2 个阶段，后 3 个阶段显示解锁遮罩
```

### 流程 4：导出 PDF / 发送邮件

```
报告页点击 "Export PDF" 或 "Send to Email"
  ↓
判断当前报告是否已支付（status === paid_full）？
  ├── 否 → 提示需要先解锁
  └── 是 ↓
      ├── Export PDF → 前端生成 PDF 下载
      └── Send to Email → 调 /api/send-report → Resend 发邮件
```

---

## 数据库设计（Supabase）

### 表关系

```
users 1 ──── N reports     （一个用户有多份报告）
users 1 ──── N orders      （一个用户有多笔订单）
```

### 建表 SQL

```sql
-- ============================================
-- 表 1：users（用户表）
-- ============================================
CREATE TABLE users (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clerk_user_id VARCHAR(255) UNIQUE NOT NULL,
  email         VARCHAR(255) NOT NULL,
  name          VARCHAR(255),
  audit_credits INT DEFAULT 1 NOT NULL,    -- V2 改动：新用户 1 次（V1 是 5 次）
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX idx_users_clerk_id ON users (clerk_user_id);

-- ============================================
-- 表 2：reports（报告表）
-- ============================================
CREATE TABLE reports (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id             VARCHAR(50) UNIQUE NOT NULL,
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  page_url              TEXT NOT NULL,
  page_type             VARCHAR(100),
  gbp_url               TEXT NOT NULL,
  task_id               VARCHAR(100),
  status                VARCHAR(20) DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'free_preview', 'paid_full', 'failed')),
  access_type           VARCHAR(20) NOT NULL CHECK (access_type IN ('free_trial', 'paid_credit', 'unlocked')),
  completed_at          TIMESTAMP WITH TIME ZONE,
  trust_status          TEXT,
  ranking_potential     TEXT,
  risk_level            TEXT,
  generated_at          TEXT,
  module_1_overview     JSONB,
  module_2_page_level   JSONB,
  module_3_key_problems JSONB,
  module_4_eight_layers JSONB,
  module_5_optimization JSONB,
  created_at            TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX idx_reports_user_id ON reports (user_id);
CREATE INDEX idx_reports_created_at ON reports (created_at DESC);

-- ============================================
-- 表 3：orders（订单表）
-- ============================================
CREATE TABLE orders (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id          VARCHAR(255) UNIQUE NOT NULL,        -- Dodo Payments order ID
  amount            INT NOT NULL,                         -- 支付金额（单位：分）
  credits_purchased INT NOT NULL DEFAULT 1,               -- 购买的审计次数
  status            VARCHAR(20) DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  paid_at           TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_orders_user_id ON orders (user_id);
CREATE INDEX idx_orders_order_id ON orders (order_id);
```

### V1 → V2 数据库变更

```sql
-- 1. 新用户 audit_credits 从 5 改为 1（仅影响新注册用户，已有用户不受影响）
-- getCurrentUser() 兜底逻辑中 audit_credits: 5 → audit_credits: 1

-- 2. reports 表 status 增加 'pending' 和 'failed' 状态
-- 已有 CHECK 约束需要先删除再添加
ALTER TABLE reports DROP CONSTRAINT reports_status_check;
ALTER TABLE reports ADD CONSTRAINT reports_status_check
  CHECK (status IN ('pending', 'free_preview', 'paid_full', 'failed'));

-- 3. reports 表增加 access_type，用于记录报告权益来源，避免靠 credits 余额反推
ALTER TABLE reports ADD COLUMN access_type VARCHAR(20);
UPDATE reports
SET access_type = CASE
  WHEN status = 'paid_full' THEN 'paid_credit'
  ELSE 'free_trial'
END
WHERE access_type IS NULL;
ALTER TABLE reports ALTER COLUMN access_type SET NOT NULL;
ALTER TABLE reports ADD CONSTRAINT reports_access_type_check
  CHECK (access_type IN ('free_trial', 'paid_credit', 'unlocked'));

-- 4. reports 表增加 completed_at，用于幂等判断和排查问题
ALTER TABLE reports ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE;

-- 5. GBP URL 改为必填。执行前需先处理历史 gbp_url 为空的数据。
-- UPDATE reports SET gbp_url = 'legacy-missing' WHERE gbp_url IS NULL;
ALTER TABLE reports ALTER COLUMN gbp_url SET NOT NULL;

-- 6. orders 表 order_id 说明变更（Lemon Squeezy → Dodo Payments）
-- 字段结构不变，存储的值从 Lemon Squeezy transaction_id 变为 Dodo Payments order_id
```

---

## API 路由设计

### 你的 Next.js API（全部在 src/app/api/ 下）

| 路由 | 方法 | 功能 | V2 变更 |
|------|------|------|---------|
| `/api/generate-report` | POST | 创建报告任务 | 校验 URL/GBP URL/credits，创建 `pending` 报告并记录 `access_type`，不立即扣减 credits |
| `/api/report-status` | POST | 保存报告结果 | SSE 完成后由前端调用；服务端做 `pending` 幂等判断，成功后只扣减一次 |
| `/api/reports` | GET | 获取报告列表 | 无变更 |
| `/api/reports/[id]` | GET | 获取报告详情 | 无变更 |
| `/api/reports/[id]/unlock` | POST | 解锁报告 | 支付确认后把 `status` 改为 `paid_full`，`access_type` 改为 `unlocked` |
| `/api/checkout` | POST | 创建 Dodo Payments 支付 | **新增**，替代 Lemon Squeezy |
| `/api/checkout/confirm` | POST | 确认支付结果 | **建议新增**，回跳后同步向 Dodo 验证支付并幂等加 credit |
| `/api/webhook/dodo` | POST | Dodo Payments 回调 | **新增**，替代 Lemon Squeezy webhook |
| `/api/send-report` | POST | 发送邮件 | 无变更 |
| `/api/user/credits` | GET | 查询可用次数 | 无变更 |

### 后端老师的接口（Railway）

| 接口 | 地址 | 说明 | V2 变更 |
|------|------|------|---------|
| 创建任务 | `POST /api/v1/analyze` | 传 `{ url, page_type, language, gbp_url }` → 返回 `{ task_id }` | GBP URL 必填 |
| 轮询结果（旧） | `GET /api/v1/task/{task_id}` | 返回 `{ status, progress, result, error }` | **弃用** |
| SSE 流 | `GET /api/v1/task/{task_id}/stream` | SSE 长连接，持续推送进度和结果 | **新增** |

### SSE 消息结构

```json
{
  "task_id": "xxx",
  "status": "scraping | analyzing | reporting | done | failed",
  "progress": {
    "stage": "loading",
    "percent": 30,
    "message": "正在读取页面…"
  },
  "result": null,
  "error": null
}
```

### 前端 SSE 处理逻辑

```typescript
function connectSSE(taskId: string): Promise<SSEResult> {
  return new Promise((resolve, reject) => {
    const eventSource = new EventSource(
      `https://seo-backend-production-6f2b.up.railway.app/api/v1/task/${taskId}/stream`
    );

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      // 更新进度条
      updateProgress(data.progress);

      if (data.status === "done") {
        eventSource.close();
        resolve(data.result);
      }

      if (data.status === "failed") {
        eventSource.close();
        reject(data.error);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      reject(new Error("SSE connection failed"));
    };
  });
}
```

---

## 页面与组件设计

### 核心组件变更

| 组件 | 类型 | V2 变更说明 |
|------|------|------------|
| `RunAuditButton` | 修改 | **改为先弹 AuditFormModal 再判断登录**（V1 是先判断登录再弹表单） |
| `AuditForm` | 修改 | **改为先填信息再判断登录**，增加 Dodo Checkout 跳转逻辑 |
| `AuditFormModal` | 修改 | 同上，增加登录判断 + credits 判断 + Checkout 跳转 |
| `AuditModalProvider` | 修改 | 适配新流程：填信息 → 登录 → credits → Checkout/跑报告 |
| `ReportPage` | 修改 | **轮询改为 SSE**，进度条实时更新 |
| `PaymentModal` | 新增 | 站内确认弹层，点击后跳转 Dodo Checkout |
| `ReportContent` | 不变 | 5 阶段 Tab + 解锁遮罩 |
| `ReportHistory` | 不变 | 左侧历史时间列表 |
| `UserDropdown` | 修改 | 动态显示 audit_credits |

### 统一判断顺序（V2 核心变更）

```
V1（旧）：
  点击 Run → 判断登录 → 判断 credits → 弹表单 → 提交

V2（新）：
  点击 Run → 弹表单 → 填完提交 → 判断登录 → 判断 credits → 跑报告/支付
```

### 防重复提交

- 前端：点击 "Run a Trust Audit" 按钮后立即 `disabled + loading`，直到流程结束
- 后端：`generate-report` 接口增加幂等校验（同一用户 + 同一 URL 60 秒内只能生成一次）

---

## 路由结构

| 路径 | 页面 | 是否需要登录 | 状态 |
|------|------|-------------|------|
| `/` | 首页 | 否 | ✅ 已完成 |
| `/framework` | 框架说明页 | 否 | ✅ 已完成 |
| `/sample-report` | 案例报告页 | 否 | ✅ 已完成 |
| `/use-cases` | 用例页 | 否 | ✅ 已完成 |
| `/pricing` | 定价页 | 否 | ✅ 已完成 |
| `/policy` | 隐私政策页 | 否 | ✅ 已完成 |
| `/reports` | 历史报告页 | 是 | ✅ 已完成 |
| `/sample-case` | 案例报告全文 | 否 | ✅ 已完成 |

---

## Dodo Payments 支付集成

### 为什么选 Dodo Payments

| 对比项 | Dodo Payments | Lemon Squeezy | Paddle |
|--------|--------------|---------------|--------|
| 个人注册 | ✅ 支持个人 | ✅ 支持 | ❌ 需要企业验证 |
| AI 产品 | ✅ 友好 | ⚠️ 有限制 | ❌ 明确禁止 |
| 支付体验 | ✅ 支持跳转 Checkout，也可后续接 overlay | ❌ 跳转 | ✅ 支持 |
| 费率 | ~5% + $0.50 | 5% + $0.50 | 5% + $0.50 |
| Next.js 适配 | ✅ 有 SDK | ⚠️ 需要自封装 | ✅ 有 SDK |

### 环境配置

**测试环境（Sandbox）：**

```env
NEXT_PUBLIC_DODO_PUBLIC_KEY=test_xxxxxxxxxxxx
DODO_API_KEY=test_xxxxxxxxxxxx
DODO_WEBHOOK_SECRET=test_xxxxxxxxxxxx
DODO_ENV=sandbox
```

**生产环境：**

```env
NEXT_PUBLIC_DODO_PUBLIC_KEY=live_xxxxxxxxxxxx
DODO_API_KEY=live_xxxxxxxxxxxx
DODO_WEBHOOK_SECRET=live_xxxxxxxxxxxx
DODO_ENV=live
```

### 前端跳转支付流程

```typescript
// 1. 前端调 /api/checkout 获取支付参数
const res = await fetch("/api/checkout", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ formData }),
});
const { checkout_url, order_id } = await res.json();

// 2. 跳转到 Dodo 托管支付页
window.location.href = checkout_url;

// 3. 支付成功回跳 /reports?payment=success&order_id=xxx
// 前端调用 /api/checkout/confirm 确认支付状态
// 确认 credit 到账后，再自动继续跑报告
```

### 后端 Webhook 处理

```
POST /api/webhook/dodo
  → 验证签名（DODO_WEBHOOK_SECRET）
  → 解析事件类型：
    - payment.succeeded
      → 验证 order_id
      → UPDATE orders SET status = paid
      → 幂等 UPDATE users SET audit_credits = audit_credits + 1
    - payment.failed
      → UPDATE orders SET status = failed
    - payment.refunded
      → UPDATE orders SET status = refunded
      → UPDATE users SET audit_credits = audit_credits - 1（不低于 0）
  → 返回 200 OK
```

---

## 环境变量清单

```env
# Clerk（已配置）
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx

# 后端报告生成接口
REPORT_API_BASE_URL=https://seo-backend-production-6f2b.up.railway.app/api/v1

# Dodo Payments（待配置）
NEXT_PUBLIC_DODO_PUBLIC_KEY=
DODO_API_KEY=
DODO_WEBHOOK_SECRET=
DODO_ENV=sandbox

# Resend（已配置）
RESEND_API_KEY=

# Supabase（已配置）
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

---

## 项目改动清单（V1 → V2）

### 需要修改的文件

| 文件 | 改动内容 | 优先级 |
|------|----------|--------|
| `src/components/common/RunAuditButton.tsx` | 改为先弹 AuditFormModal 再判断登录 | P0 |
| `src/components/common/AuditFormModal.tsx` | 增加：登录判断 → credits 判断 → Checkout/跑报告逻辑，GBP URL 必填 | P0 |
| `src/components/common/AuditForm.tsx` | 增加：登录判断 → credits 判断 → Checkout/跑报告逻辑，GBP URL 必填 | P0 |
| `src/components/common/AuditModalProvider.tsx` | 适配新流程：填信息 → 登录 → credits → Checkout/跑报告 | P0 |
| `src/app/reports/page.tsx` | 轮询改为 SSE 长连接，进度条实时更新 | P0 |
| `src/app/api/generate-report/route.ts` | 创建 `pending` 报告，记录 `access_type`，不立即扣减 credits | P0 |
| `src/app/api/report-status/route.ts` | 改为 POST，SSE done 后保存结果；只允许 `pending` 报告完成一次并扣减一次 | P0 |
| `src/lib/auth.ts` | 兜底创建用户 audit_credits: 5 → 1，移除 console.log | P1 |
| `src/components/pricing/PricingHero.tsx` | Buy 按钮对接 Dodo Payments Checkout | P1 |
| `src/app/pricing/page.tsx` | FAQ "Secure via Paddle" 改为 "Secure via Dodo Payments" | P1 |

### 需要新建的文件

| 文件 | 说明 | 优先级 |
|------|------|--------|
| `src/components/common/PaymentModal.tsx` | 站内购买确认弹层，点击后跳转 Dodo Checkout | P0 |
| `src/app/api/checkout/route.ts` | 创建 Dodo Payments 支付 session | P1 |
| `src/app/api/checkout/confirm/route.ts` | 支付回跳后同步确认订单并幂等加 credit | P1 |
| `src/app/api/webhook/dodo/route.ts` | Dodo Payments webhook 回调处理 | P1 |
| `src/lib/dodo.ts` | Dodo Payments API 封装 | P1 |

### 需要删除的文件

| 文件 | 说明 |
|------|------|
| 无 | 旧的 Lemon Squeezy / Paddle 相关代码本就未集成，无需删除 |

### 数据库变更（Supabase SQL Editor 执行）

```sql
-- 1. reports 表 status 增加 'pending' 和 'failed' 状态
ALTER TABLE reports DROP CONSTRAINT reports_status_check;
ALTER TABLE reports ADD CONSTRAINT reports_status_check
  CHECK (status IN ('pending', 'free_preview', 'paid_full', 'failed'));

-- 2. 新注册用户 audit_credits 默认值改为 1
-- 注意：这通过 auth.ts 兜底逻辑控制，数据库 DEFAULT 值也建议改为 1
ALTER TABLE users ALTER COLUMN audit_credits SET DEFAULT 1;

-- 3. reports 表增加 access_type，并先给历史数据回填默认值
ALTER TABLE reports ADD COLUMN access_type VARCHAR(20);
UPDATE reports
SET access_type = CASE
  WHEN status = 'paid_full' THEN 'paid_credit'
  ELSE 'free_trial'
END
WHERE access_type IS NULL;
ALTER TABLE reports ALTER COLUMN access_type SET NOT NULL;
ALTER TABLE reports ADD CONSTRAINT reports_access_type_check
  CHECK (access_type IN ('free_trial', 'paid_credit', 'unlocked'));

-- 4. reports 表增加 completed_at
ALTER TABLE reports ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE;

-- 5. GBP URL 改为必填。执行前需先处理历史 gbp_url 为空的数据。
-- UPDATE reports SET gbp_url = 'legacy-missing' WHERE gbp_url IS NULL;
ALTER TABLE reports ALTER COLUMN gbp_url SET NOT NULL;
```

---

## 开发节奏（V2）

| 阶段 | 内容 | 依赖 | 状态 |
|------|------|------|------|
| 1 | 页面 UI + 交互 | 无 | ✅ 完成 |
| 2 | 用户认证（Clerk） | 无 | ✅ 完成 |
| 3 | AuditFormModal 弹窗组件 | 阶段 2 | ✅ 完成 |
| 4 | ReportContent 公用组件（5 模块渲染 + 锚点滚动 + 解锁遮罩） | 无 | ✅ 完成 |
| 5 | 数据库（Supabase）建表 | 无 | ✅ 完成 |
| 6 | 邮件发送（Resend） | 无 | ✅ 完成 |
| 7 | 后端 API 对接（创建任务 + 轮询） | 后端接口 | ✅ 完成 |
| 8 | Clerk 用户集成（API 路由获取真实 user_id） | 阶段 2 | ✅ 完成 |
| 9 | 报告页 UX 优化（加载态、左侧固定滚动、解锁遮罩毛玻璃） | 阶段 7 | ✅ 完成 |
| **10** | **轮询 → SSE 长连接改造** | 阶段 7 | ❌ 待开发 |
| **11** | **统一入口流程（填信息 → 登录 → credits → 跑报告）** | 阶段 8 | ❌ 待开发 |
| **12** | **Dodo Payments 支付集成（跳转 Checkout + confirm + webhook）** | 阶段 8 | ❌ 待开发 |
| **13** | **防重复提交（前端 disable + 后端幂等）** | 阶段 10 | ❌ 待开发 |
| **14** | **审计次数动态获取（UserDropdown + 支付后刷新）** | 阶段 12 | ❌ 待开发 |
| 15 | PDF 导出 | 阶段 4 + 产品模板 | ❌ 待开发 |
| 16 | 部署上线（Vercel） | 全部完成 | ❌ 待开发 |

### 下周待办（按优先级）

#### P0 — 核心流程改造

**10. SSE 长连接改造**
- 修改 `reports/page.tsx`：移除轮询逻辑，改为 EventSource 连接后端 SSE 接口
- 修改 `generate-report/route.ts`：移除扣减 credits（改为成功后扣减）
- 修改 `report-status/route.ts`：改为 POST 接口，由前端在 SSE done 后调用，保存结果 + 扣减 credits
- 进度条实时更新：根据 `progress.percent` 更新 UI

**11. 统一入口流程**
- 修改 `RunAuditButton.tsx`：点击直接弹 AuditFormModal，不再先判断登录
- 修改 `AuditFormModal.tsx`：提交时先判断登录 → 再判断 credits → 再跑报告/弹支付
- 修改 `AuditForm.tsx`：同上逻辑
- 修改 `AuditModalProvider.tsx`：适配新流程

**13. 防重复提交**
- 前端：提交按钮点击后立即 `disabled + loading`
- 后端：`generate-report` 加幂等校验（同一用户同一 URL 60 秒内不重复）

#### P1 — 支付

**12. Dodo Payments 集成**
- 注册 Dodo Payments 账号，获取 API Key
- 新建 `src/lib/dodo.ts`：API 封装
- 新建 `src/app/api/checkout/route.ts`：创建支付 session
- 新建 `src/app/api/checkout/confirm/route.ts`：支付回跳后同步确认订单并幂等加 credit
- 新建 `src/app/api/webhook/dodo/route.ts`：支付成功回调
- 新建 `src/components/common/PaymentModal.tsx`：站内购买确认弹层，点击后跳转 Dodo Checkout
- 修改 `PricingHero.tsx`：Buy 按钮对接 Dodo

**14. 审计次数动态获取**
- UserDropdown 显示 audit_credits（动态）
- 支付成功后自动刷新 credits
- 报告生成成功后自动刷新 credits

#### P2 — 部署上线

**16. Vercel 部署**
- Clerk 升级为 Production 模式
- 配置自定义域名 `trysearchtrust.com`
- 环境变量全部配置到 Vercel
- 移除调试日志
- Dodo Payments 切换为 Live 环境

---

## 已验证通过的本地测试流程（V1）

1. Google 登录 → `getCurrentUser()` 自动在 users 表创建用户（audit_credits = 1）
2. 点击 Run a Trust Audit → 填写 URL → 提交 → 跳转 /reports 显示轮询进度
3. 后端返回 done → 解析 score 存入 Supabase → 渲染完整报告（5 个 Tab）
4. 前 2 个阶段免费可见，后 3 个阶段显示毛玻璃解锁遮罩
5. 历史报告列表左侧固定定位，点击切换报告
6. 解锁遮罩按钮跳转 /pricing 页面
