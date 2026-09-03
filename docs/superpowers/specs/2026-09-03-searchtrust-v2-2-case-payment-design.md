# SearchTrust v2.2 Case 级支付设计（V22-041）

日期：2026-09-03

## 目标

将获客流程的 `$19` 付款从旧的通用 Credit 模型中分离。每笔 v2.2 付款只解锁一个指定 Case 的第一份 `prospect` 报告；旧 Credit 入口暂时保持兼容。

## 用户流程

1. 用户匿名完成预检、商家确认、竞品确认和 Coverage。
2. 登录后，服务端用 `draft_case_id` 创建正式 Case；同一 UUID 的重复请求按已有 Case 恢复。
3. 用户明确点击后才创建 Dodo 托管 Checkout。页面不会自动发起付款，也不会在浏览器中持有 Dodo 密钥。
4. Checkout metadata 固定包含 `clerk_user_id`、`case_id`、本地 `order_id` 和 `purchase_kind=case_prospect_report`。
5. Dodo 回跳先读取已由 webhook 写入的权益；如 webhook 尚未到达，再由服务端向 Dodo 查询 `payment_id` 并确认。
6. 成功后显示该 Case 拥有一份可用的 Prospect Report 权益；V22-042 接续报告生成与阅读界面。

## 数据与幂等

- `orders` 增加 Case、购买类型和 Checkout Session 字段；旧订单默认为 `legacy_credit`。
- `case_report_entitlements` 独立保存 `available / reserved / consumed / payment_refunded` 生命周期。
- 同一 Case 同时只能存在一个 pending/paid Prospect Checkout；重复点击复用已创建的托管 Checkout。
- `fulfill_v22_case_payment` 在单个数据库事务中校验用户、Case、订单和支付引用，并幂等创建权益。
- 同一 Case 只能有一份 Prospect Report 权益；重复 webhook 不重复发放。

## 生成失败返还

报告任务开始前通过数据库函数把权益从 `available` 原子预留为 `reserved`。持久任务回调在同一事务中处理终态：

- 技术失败：`reserved -> available`，允许安全重试；
- 成功且已绑定 Report：`reserved -> consumed`；
- 重复、乱序或终态倒退回调不会再次变更权益。

## 安全边界

- Webhook 必须先验证 Standard Webhooks/Svix 签名，并使用原始请求正文。
- 不记录 webhook 正文、认证头、签名、客户信息或支付 metadata。
- 回跳的查询参数不是付款事实；只有 Dodo API 查询或已签名 webhook 可以兑现权益。
- 当前用户、付款 metadata、本地订单和 Case 必须完全一致，跨用户或跨 Case 请求被拒绝。
- 浏览器只接受 `https://*.dodopayments.com` 托管结账地址。

## 配置

- `DODO_API_KEY`
- `DODO_WEBHOOK_SECRET`
- `DODO_PROSPECT_REPORT_PRODUCT_ID`
- `DODO_BASE_URL`（缺省为测试 API）
- `NEXT_PUBLIC_BASE_URL`

生产开关、真实支付烟测和部署不在本次本地实现范围内。
