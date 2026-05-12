# SearchTrust 技术方案文档

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
| 支付 | Lemon Squeezy | 全球支付，支持多种支付方式，无需企业资质 |
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
  │     ├── 调用后端老师的报告生成接口（第三方）
  │     ├── 调用 Stripe 处理支付
  │     ├── 调用 Resend 发送邮件
  │     └── 调用 Supabase 存取数据
  └── Middleware (src/middleware.ts) — 路由鉴权
```

### 职责划分

| 谁负责 | 做什么 |
|--------|--------|
| **后端老师** | 报告生成接口（输入 URL 等参数 → 返回各阶段报告数据） |
| **你的 Next.js** | 调用后端接口、用户认证、支付、邮件、订单管理、数据库 |

### 跨域说明

**不存在跨域问题。** 浏览器只跟 Next.js API 通信（同域），Next.js 再调后端老师的接口是服务器对服务器，不受跨域限制。

---

## 核心业务流程

### 流程 1：Run a Trust Audit（核心主流程）

```
用户点击 "Run a Trust Audit"（任意位置）
  ↓
判断是否登录？
  ├── 未登录 → 弹出 GoogleLoginModal 登录弹窗
  └── 已登录 ↓
判断可用审计次数 > 0？
  ├── 可用次数 = 0 → 跳转支付页（/pricing）→ Stripe 支付 → 支付成功后次数 +N
  └── 可用次数 > 0 ↓
弹出 AuditFormModal（填写表单）
  - URL（必填）
  - GBP URL（选填）
  - Page Type（选择：Service Page / Location Page / City Page 等）
  ↓
点击弹窗上的 "Run a Trust Audit" 按钮
  ↓
可用审计次数 -1
  ↓
跳转到 /reports（当前窗口）
  ↓
调用后端老师的报告生成接口
  ↓
后端返回各阶段数据 → 渲染报告页面
```

### 流程 2：查看报告页

```
/reports 页面
  ├── 左侧：历史报告时间列表（按日期分组）
  │     └── 点击某条报告 → 右侧更新为该报告内容
  └── 右侧：报告内容（5 个阶段 Tab）
        ├── 已支付报告 → 5 个阶段全部可见
        └── 未支付报告 → 只看前 2 个阶段，后 3 个阶段显示解锁遮罩
```

### 流程 3：Sample Report（案例页面）

```
/sample-report 页面（无需登录）
  ├── 左侧：无时间列表，纯案例展示
  └── 右侧：与 /reports 相同的报告组件，5 个阶段全部可见
  → 点击 "View Sample Report" 在新窗口打开
```

### 流程 4：导出 PDF / 发送邮件

```
报告页点击 "Export PDF" 或 "Send to Email"
  ↓
判断当前报告是否已支付？
  ├── 未支付 → 提示需要先解锁
  └── 已支付 ↓
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
  audit_credits INT DEFAULT 5 NOT NULL,
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
  url                   TEXT NOT NULL,
  page_type             VARCHAR(100),
  gbp_url               TEXT,
  status                VARCHAR(20) DEFAULT 'free_preview' NOT NULL CHECK (status IN ('free_preview', 'paid_full')),
  trust_status          VARCHAR(50),
  trust_status_desc     TEXT,
  ranking_potential     VARCHAR(50),
  ranking_potential_desc TEXT,
  risk_level            VARCHAR(50),
  risk_level_desc       TEXT,
  stage_1_html          TEXT,
  stage_2_html          TEXT,
  stage_3_html          TEXT,
  stage_4_html          TEXT,
  stage_5_html          TEXT,
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
  order_id          VARCHAR(255) UNIQUE NOT NULL,
  amount            INT NOT NULL,
  credits_purchased INT NOT NULL,
  status            VARCHAR(20) DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  paid_at           TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_orders_user_id ON orders (user_id);
CREATE INDEX idx_orders_order_id ON orders (order_id);
```

### 字段说明

**users 表**

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID (PK) | 主键 |
| `clerk_user_id` | VARCHAR(255) | Clerk 用户 ID（唯一，关联 Clerk） |
| `email` | VARCHAR(255) | 用户邮箱 |
| `name` | VARCHAR(255) | 用户名 |
| `audit_credits` | INT | 可用审计次数（新用户默认 5） |
| `created_at` | TIMESTAMP | 注册时间 |
| `updated_at` | TIMESTAMP | 更新时间 |

**reports 表**

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID (PK) | 主键 |
| `report_id` | VARCHAR(50) | 报告唯一标识（如 RPT-250512-001） |
| `user_id` | UUID (FK) | 关联 users.id |
| `url` | TEXT | 用户检测的网址 |
| `page_type` | VARCHAR(100) | 页面类型（Service Page / Location Page 等） |
| `gbp_url` | TEXT | Google Business Profile URL |
| `status` | VARCHAR(20) | `free_preview` / `paid_full` |
| `trust_status` | VARCHAR(50) | 信任状态（Medium / High / Low） |
| `trust_status_desc` | TEXT | 信任状态描述 |
| `ranking_potential` | VARCHAR(50) | 排名潜力（Moderate / Strong / Weak） |
| `ranking_potential_desc` | TEXT | 排名潜力描述 |
| `risk_level` | VARCHAR(50) | 风险等级（Medium-High / Low / High） |
| `risk_level_desc` | TEXT | 风险等级描述 |
| `stage_1_html` | TEXT | Executive Summary HTML |
| `stage_2_html` | TEXT | Page Level HTML |
| `stage_3_html` | TEXT | Key Issues HTML |
| `stage_4_html` | TEXT | Six-Layer Model HTML |
| `stage_5_html` | TEXT | Optimization Path HTML |
| `created_at` | TIMESTAMP | 报告生成时间（后端返回） |

**orders 表**

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID (PK) | 主键 |
| `user_id` | UUID (FK) | 关联 users.id |
| `order_id` | VARCHAR(255) | Lemon Squeezy Order ID |
| `amount` | INT | 支付金额（单位：分） |
| `credits_purchased` | INT | 购买的审计次数 |
| `status` | VARCHAR(20) | `pending` / `paid` / `failed` / `refunded` |
| `created_at` | TIMESTAMP | 创建时间 |
| `paid_at` | TIMESTAMP | 支付成功时间 |

---

## API 路由设计

### 你的 Next.js API（全部在 src/app/api/ 下）

| 路由 | 方法 | 功能 | 说明 |
|------|------|------|------|
| `/api/generate-report` | POST | 生成报告 | 调用后端老师的接口，存入 reports 表，扣减 audit_credits |
| `/api/reports` | GET | 获取报告列表 | 查询当前用户的所有报告（左侧时间列表） |
| `/api/reports/[id]` | GET | 获取报告详情 | 查询单个报告的各阶段数据 |
| `/api/reports/[id]/unlock` | POST | 解锁报告 | 将报告 status 从 free_preview 改为 paid_full |
| `/api/checkout` | POST | 创建支付 | 创建 Lemon Squeezy Checkout |
| `/api/webhook/lemonsqueezy` | POST | Lemon Squeezy 回调 | 支付成功后更新 orders 表，给 users.audit_credits 加次数 |
| `/api/send-report` | POST | 发送邮件 | 用 Resend 发送报告 PDF 到用户邮箱 |
| `/api/user/credits` | GET | 查询可用次数 | 返回当前用户的 audit_credits |

### 后端老师的接口（你调用）

| 接口 | 说明 |
|------|------|
| `POST {后端地址}/generate` | 输入 URL、page_type、gbp_url → 返回 5 个阶段的数据 |

---

## 页面与组件设计

### 页面复用关系

```
/sample-report（案例页，无需登录）
  └── 复用 ReportContent 组件（5 阶段全部可见，无左侧列表）

/reports（历史报告页，需登录）
  ├── 左侧：ReportHistory 组件（时间列表）
  └── 右侧：复用 ReportContent 组件
        ├── 已支付 → 5 阶段可见
        └── 未支付 → 前 2 阶段可见，后 3 阶段显示解锁遮罩
```

**建议：案例页和历史报告页共用 ReportContent 组件，通过 props 控制差异。**

### 新增/修改的组件

| 组件 | 类型 | 说明 |
|------|------|------|
| `AuditFormModal` | 新增 | 填写 URL / GBP URL / Page Type 的弹窗 |
| `ReportContent` | 新增 | 报告右侧内容组件（5 个阶段 Tab + 解锁遮罩） |
| `ReportHistory` | 新增 | 报告左侧历史时间列表组件 |
| `RunAuditButton` | 新增 | 公用的 "Run a Trust Audit" 按钮（封装登录判断 + 次数判断逻辑） |
| `GoogleLoginModal` | 已有 | 登录弹窗 |
| `UserDropdown` | 修改 | 新增"可用审计次数"入口 |

### RunAuditButton 公用逻辑

```typescript
// 所有页面复用同一个按钮逻辑
function handleRunAudit() {
  // 1. 判断是否登录
  if (!isSignedIn) {
    setLoginOpen(true);  // 弹出登录弹窗
    return;
  }

  // 2. 判断可用次数
  if (auditCredits <= 0) {
    router.push('/pricing');  // 跳转支付页
    return;
  }

  // 3. 弹出填写表单弹窗
  setAuditFormOpen(true);
}
```

### UserDropdown 新增入口

```
┌─────────────────────────┐
│  用户名                  │
│  user@email.com         │
├─────────────────────────┤
│  📊 可用审计次数：3       │  ← 新增
│  📄 My Reports           │
│  🚪 Sign Out             │
└─────────────────────────┘
```

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
| `/reports` | 历史报告页 | 是 | 🔶 UI 框架完成 |

**跳转方式：**
- "View Sample Report" → 新窗口打开 `/sample-report`
- "Run a Trust Audit" → 当前窗口跳转 `/reports`
- 历史报告列表点击 → 右侧更新（不跳转）

---

## 第三方服务

### 1. Clerk — 用户认证

| 项目 | 说明 |
|------|------|
| 费用 | 免费 10,000 MAU |
| 登录方式 | Google + Email |
| 环境变量 | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` |

### 2. Lemon Squeezy — 支付

| 项目 | 说明 |
|------|------|
| 费用 | 每笔交易 5% + $0.50 |
| 支付方式 | 信用卡、PayPal、Apple Pay、Google Pay 等 |
| 优势 | 无需企业资质，个人即可接入，全球收款 |
| 测试模式 | 开发阶段用测试密钥，不产生真实扣款 |

**支付流程：**

```
用户可用次数 = 0，点击 "Run a Trust Audit"
  → 跳转 /pricing 页面
  → 选择套餐 → 调 /api/checkout
  → 后端创建 Lemon Squeezy Checkout
  → 跳转 Lemon Squeezy 托管付款页
  → 支付成功 → Lemon Squeezy 回调 /api/webhook/lemonsqueezy
  → 后端更新 orders 表（status = paid）
  → 后端更新 users.audit_credits += 购买次数
  → 前端展示可用次数已更新
```

### 3. Resend — 邮件发送

| 项目 | 说明 |
|------|------|
| 费用 | 免费 3,000 封/月 |
| 前提 | 当前报告必须是已支付状态才能发送 |

### 4. Supabase — 数据库

| 项目 | 说明 |
|------|------|
| 费用 | 免费 500MB 存储 |
| 3 张表 | users / reports / orders |

---

## 环境变量清单

```env
# Clerk（已配置）
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx

# 后端老师的报告生成接口（待配置）
REPORT_API_URL=
REPORT_API_KEY=

# Lemon Squeezy（待配置）
LEMONSQUEEZY_API_KEY=
LEMONSQUEEZY_STORE_ID=
LEMONSQUEEZY_WEBHOOK_SECRET=

# Resend（待配置）
RESEND_API_KEY=

# Supabase（待配置）
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

---

## 开发节奏

| 阶段 | 内容 | 依赖 | 状态 |
|------|------|------|------|
| 1 | 页面 UI + 交互 | 无 | ✅ 完成 |
| 2 | 用户认证（Clerk） | 无 | ✅ 完成 |
| 3 | AuditFormModal 弹窗组件 | 阶段 2 | ✅ 完成 |
| 4 | RunAuditButton 公用逻辑 | 阶段 3 | ✅ 完成 |
| 5 | ReportContent 公用组件 | 无 | ✅ 完成 |
| 6 | 数据库（Supabase）建表 | 无 | ✅ 完成 |
| 7 | 邮件发送（Resend） | 无 | ✅ 完成 |
| 8 | 域名 + DNS 配置 | 无 | ✅ 完成 |
| 9 | 报告生成接口对接 | 阶段 2 + 后端接口 ready | ❌ 待开发 |
| 10 | Clerk 用户集成（API 路由对接真实用户） | 阶段 2 | ❌ 待开发 |
| 11 | 支付（Lemon Squeezy） | 阶段 6 | ❌ 待开发 |
| 12 | PDF 导出 | 阶段 5 + 产品提供模板 | ❌ 待开发 |
| 13 | 审计次数动态获取（UserDropdown 对接 /api/user/credits，支付后 +N，Run Audit 后 -1） | 阶段 10 + 11 | ❌ 待开发 |
| 14 | 部署上线（Vercel） | 全部完成 | ❌ 待开发 |


## 邮件发送需要配置DNS
那你去 Resend 后台的 Domains 页面，点击 "Add Domain"，输入 trysearchtrust.com。

添加后 Resend 会给你几条 DNS 记录（MX、SPF、DKIM 等），你需要去你的域名注册商后台（域名在哪买的就去哪）添加这些 DNS 解析记录。验证通过后就能用 noreply@trysearchtrust.com 发邮件了。

## Lemon Squeezy 支付
 https://www.lemonsqueezy.com
 注册流程：

用 Google 或邮箱注册
注册后它会让你设置店铺（Store）名称，填 SearchTrust 就行
进入后台后需要拿到几个凭据给我：
API Key（Settings → API）
Store ID（Settings 里能看到）
另外你还需要在 Lemon Squeezy 后台创建产品（Products → Create Product），对应你的定价页上的套餐，比如：

单次审计（1 credit）— $X
5 次审计（5 credits）— $X
10 次审计（10 credits）— $X

去注册吧，拿到 API Key 和 Store ID 后告诉我。另外顺便把 BillingDetails 里写的 "Secure via Paddle" 改成 "Secure via Lemon Squeezy"，你用的是 Lemon Squeezy 不是 Paddle。