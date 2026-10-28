# Pricing 改版验收记录

日期：2026-10-13。状态：本地实施完成，未发布、未进行真实付款。

## 已完成

- 居中无衬线首屏，免费体验／账户余额与 $19 单点加购双卡；沿用营销页的深绿与浅绿视觉语言。
- 两份报告式成果摘要，复用 Oak & Vale Cooling 的共享事实和固定日期；公开证据与客户权限后证据分开。
- 四行点数规则、简短账户状态 CTA、七项 FAQ；FAQ 与 JSON-LD 同源。
- 直接进入现有 Clerk 身份入口并返回 Pricing；登录后不会自动创建购买会话。
- 全站共享余额增加加载、错误、重查和账户隔离；未知值不当成零，迟到请求不能覆盖新账户／付款确认余额。
- 全部购买入口共用进行中锁；只接受 HTTPS Dodo 地址；错误不展示提供方原始信息。
- 付款返回支持身份等待、确认中、成功、重复确认、明确 pending、未知异常、明确失败、取消与缺失标识；手动重查同一订单。
- 成功确认后强制刷新共享余额，只清除支付查询参数；保留其他查询、锚点与浏览器历史状态。
- FAQ 的默认交互保持其他页面兼容，Pricing 可以全部收起；移除固定答案高度，避免手机长答案裁切。

没有修改价格、赠送、扣点、支付所有权、幂等入账、退款及批准交付的后端规则。旧 PricingFAQ、WhoThisIsFor 仍未挂载。

## 验证结果

| 检查 | 结果 |
| --- | --- |
| `npm run typecheck` | 通过 |
| `npm test` | 133 个文件、1,199 项测试通过 |
| Pricing／身份／现有支付与点数契约定向测试 | 通过，已纳入全量结果 |
| Pricing、marketing-navigation、work-entry 浏览器回归 | 15 项通过 |
| `npm run build` | 生产构建通过 |
| `git diff --check` | 通过 |
| 320／390／768／1024／1440，1280×720 | 无横向溢出；小屏报告单列，金额与单位清楚 |
| 200% 缩放重排 | 使用等效 640×450 CSS 视口验证 1280×900 下的重排；未声称系统浏览器缩放实测 |
| 键盘及辅助状态 | FAQ Enter 展开／收起，清晰焦点；状态文字与可恢复操作；本地身份弹窗取消恢复焦点 |

浏览器测试使用本地身份／API 桩和既有外部请求保护，不访问真实 Dodo，不运行收费分析。Clerk 生产身份入口参数通过组件测试核对；真实注册、生产赠送到账和真实付款须上线前独立核验。

首轮浏览器检查发现本地弹窗焦点与共享 FAQ 兼容问题，已修复。截图最初写入开发服务未忽略的目录，触发热刷新干扰测试；最终截图改至既有忽略目录，完整回归重新通过。

## 截图与预览

本地预览：<http://127.0.0.1:3100/pricing>。当前运行本地测试身份，显示的是本地测试账户，不是生产余额。

截图目录：`output/playwright/pricing-review/`。

- `pricing-desktop-guest.png`、`pricing-full-page.png`：未登录首屏与完整页面。
- `sample-report-desktop.png`、`use-cases-desktop.png`：同站首屏对照。
- `pricing-guest-1280.png`、`pricing-guest-390.png`、`pricing-mobile-deliverables.png`：低高度桌面与手机。
- `pricing-balance-5.png`、`pricing-balance-1.png`、`pricing-balance-0.png`、`pricing-balance-loading.png`、`pricing-balance-error.png`：账户状态。
- `pricing-payment-pending.png`、`pricing-mobile-payment-pending.png`、`pricing-payment-success-desktop.png`、`pricing-payment-success.png`：确认与恢复。
- `pricing-payment-unknown.png`、`pricing-payment-cancelled.png`、`pricing-payment-missing.png`：异常、取消、缺少标识。
- `pricing-200-percent.png`：等效 200% 缩放重排。

## 本次变更文件

以下均相对仓库根目录，不含本次开始前已有的其他页面改动。

- `src/app/pricing/page.tsx`
- `src/components/pricing/PricingHero.tsx`
- `src/components/pricing/WhatOneCreditStarts.tsx`
- `src/components/pricing/BillingDetails.tsx`
- `src/components/pricing/PricingCTA.tsx`
- `src/components/pricing/CreditPurchaseButton.tsx`
- `src/components/pricing/PricingExperience.tsx`（新增）
- `src/components/pricing/PricingPrimaryAction.tsx`（新增）
- `src/components/pricing/use-payment-return.ts`（新增）
- `src/components/pricing/pricing-content.ts`（新增）
- `src/components/pricing/pricing-v22.module.css`
- `src/components/pricing/PricingContent.test.tsx`
- `src/components/pricing/PricingExperience.test.tsx`（新增）
- `src/components/common/AuditModalProvider.tsx`
- `src/components/common/AuditModalProvider.test.tsx`（新增）
- `src/components/common/FAQAccordion.tsx`
- `src/lib/client-auth.tsx`（身份返回位置与仅本地 E2E 启用的游客身份桩）
- `src/lib/client-auth.test.tsx`
- `src/lib/seo.ts`（仅本次 Pricing 条目）
- `e2e/pricing-experience.spec.ts`（新增）
- 本验收记录及原计划的完成状态。

## 发布前独立确认

按现有发布流程核对 Dodo 商品／金额／环境、功能开关、实际身份注册和赠送到账，以及真实支付回调；本地通过不代表生产付款已经验证。本次未提交、未部署，也未清理其他未提交改动。
