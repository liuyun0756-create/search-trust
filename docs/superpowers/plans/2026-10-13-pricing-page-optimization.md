# Pricing 页面完整改动计划

日期：2026-10-13

状态：2026-10-13 已完成本地实施与验收，未发布；详见 [验收记录](2026-10-13-pricing-page-verification.md)。下文保留原计划要求。

页面：`/pricing`。

执行仓库：`/Users/liuyun3/Documents/SearchTurst前后端/search-trust`。

## 1. 本次定位与范围

页面的核心逻辑：**先用赠送的五点体验实际成果，觉得有用，再按需要购买。**

用户不需要先学习整条客户服务流程、计算一个客户会消耗几次，才能开始体验。

### 已确认的规则，不调整商业模式

- 新账号一次性获得 5 点，永久有效。
- 加购每点 $19 USD，现有购买单位为 1 点。
- 点数可用于 Prospect 分析或 Verified Action Plan 生成；一次生成使用 1 点。
- 重新生成会再次使用 1 点；没有订阅、自动续费或定期赠送。
- 因技术原因导致付费工作流失败，返还本次使用的 1 点；不是直接退现金。
- 保持现有业务权限、服务阶段前置条件、扣点、批准交付和退款规则。

### 本次要实现

1. 首屏与新版其他营销页保持相同设计语言。
2. 免费体验与加购关系明确，不设计成 Free/Pro 功能套餐。
3. 具体展示“一点能得到什么”，不是列抽象功能。
4. 删除点数组合教学和重复规则，保持一张简单规则表。
5. 登录后显示真实余额，区分有余额、零余额、加载和异常。
6. 购买与返回确认状态可理解，可恢复，避免诱导重复付款。
7. 更新 FAQ、页面描述和测试，保留现有埋点，不增加精细转化追踪。

### 本次不做

- 不改价格、赠送数量、有效期和后端计费算法。
- 不新增套餐、折扣、批量购买、订阅、用量计算器或客户成本预算器。
- 不讲“一个完整客户需要两点”“两位客户还剩一点”等组合示例。
- 不扩大报告生成能力、增加完整编辑工作台或假下载/分享操作。
- 不清理用户其他改动、不全站重做首屏、不自动上线。

## 2. 当前实现审查与改动结论

| 当前部分 | 观察 | 处理 |
| --- | --- | --- |
| PricingHero | Georgia 衬线大标题、左对齐；与 Sample Reports / Client Scenarios 差异明显 | 换成居中无衬线首屏，压缩标题与留白 |
| 两张价格卡 | 规则正确，但免费卡以“five paid workflows”解释，登录后仍以赠送为主体 | 改为实际体验/按需加购，登录后左卡显示余额 |
| 五步扣点流程 | 用户先看到如何计费，再看到成果 | 从主体移除，详细时机进 FAQ |
| 两工作流卡 | 主要是 findings / actions / requirements 等名词 | 换成具体报告节选，并提供样例链接 |
| 五点组合 | 五家企业、两个连续客户、任意组合三张卡 | 整组移除 |
| 收费边界 | 与前面的流程和 FAQ 重复 | 合并为四行简单规则表 |
| BillingDetails | 独立大区讲支付、入账、失败、退款 | 改成紧凑保障条与政策链接 |
| 注册按钮 | 文案说创建账号，RunAuditButton 实际先去 /cases/new | 使用准确的身份入口，登录后再开始 Case |
| 账户余额 | Pricing 没有直接显示；现有全局上下文已有余额和刷新方法 | 复用并补齐加载/失败状态，避免再造独立余额源 |
| 付款返回 | 一次确认后无手动重查；没有刷新共享余额 | 补状态、同一订单重查和余额同步 |
| PricingFAQ.tsx | 有“每次购买仅单 URL”等旧内容，但当前 page.tsx 未使用 | 不误判为当前页面文案；查引用后清理或保持不挂载，不顺手启用 |

## 3. 页面最终顺序

```text
全站导航（保持）
条件性付款返回状态条（普通访问完全不占空间）

01 首屏
   居中 Eyebrow → 两行标题 → 简短说明 → 主次按钮
   免费体验/当前余额卡 + $19 加购卡
   技术失败返点轻量提示

02 一点能拿到什么
   Prospect Evidence Report · 1 credit
   Verified Action Plan · 1 credit
   具体成果节选 + 完整样例入口

03 简单点数规则
   生成 / 重新生成 / 使用已有报告 / 技术失败
   支付与退款轻量说明

04 开始体验或按需加购
   根据登录与余额状态展示下一步

05 FAQ

全站 Footer（保持）
```

不增加第六个大型促销模块。桌面正常阅读路径控制在约 4–5 屏的量级，作为排版检查目标而非固定高度；手机以完整可读为先。

## 4. 首屏与其他页面保持一致

### 4.1 设计参照

首要参照当前：

- `src/components/sampleReport/SampleReportsV22.tsx` 与 `sample-deliverable.module.css`。
- `src/components/useCase/UseCasesV22.tsx` 与 `practice-workbench.module.css`。

对齐它们的「居中 Eyebrow → 无衬线标题 → 居中说明 → 主次按钮 → 下方实际内容」结构。Method 首屏部分为左右布局，仅参考字体、颜色和按钮语言，不强行复制其具体布局。

### 4.2 视觉规格

| 项目 | 设计要求 |
| --- | --- |
| 字体 | 继承全站 `var(--font-geist-sans), Arial, sans-serif`；移除 Georgia，包括价格数字 |
| 背景 | `#f8faf7` 附近浅绿，允许与 Client Scenarios 相同的低对比径向浅绿背景 |
| 文字 | 深绿约 `#213b2e`，辅助文字约 `#617367` |
| 文本居中区 | 最大宽度约 650–720px |
| H1 | `clamp(38px, 4vw, 56px)`，weight 650，line-height 1.1，letter-spacing 约 -0.05em |
| 副标题 | 16px，line-height 1.8，最大宽度约 640px |
| Eyebrow | 10–11px，大写，字距约 0.16em，非价格信息主体 |
| 首屏内容宽度 | 约 1200px；左右留白桌面 32–36px，手机 16–20px |
| 首屏顶距 | 从导航后约 64–80px 开始；手机约 40–48px |
| 按钮 | 深绿实底主按钮、浅底描边次按钮，约 48px 高，焦点描边清晰 |
| 两卡位置 | 按钮后约 32–40px；不再用过大留白切断标题与价格 |
| 卡片 | 白/浅绿底、细边框、16–20px 圆角，轻阴影，与报告页同一风格 |

不使用新的金币插画、礼物爆炸图、倒计时、Most popular 徽章。价格卡本身就是首屏主要视觉，不额外放浮动卡片遮挡金额。

在 1440×900、1280×720 两种桌面视口核对首屏。目标是无需大幅滚动即可看见优惠、$19 和主要操作；不通过缩小文字强塞所有条款。

### 4.3 未登录首屏文案

Eyebrow：`PRICING · NO SUBSCRIPTION`

H1：

> Start with 5 free credits.
> Buy more when you need them.

第二行可采用 Sample Reports 的低饱和绿色强调；不将整段变成浅灰导致对比不足。

说明：

> Try SearchTrust with five included credits. One credit starts a Prospect Evidence Report or a Verified Action Plan generation. Additional credits are $19 each and never expire.

主按钮：`Get my 5 free credits` → 现有 Clerk 登录/注册入口。

次按钮：`See what one credit delivers` → 本页 `#pricing-deliverables`。

按钮旁辅助：`For new accounts · Granted once · No expiration`。

不写“五个客户”“完整客户全流程”“无任何使用条件”等超出事实的承诺。Verified 前置条件在对应成果卡说明。

### 4.4 免费体验卡

标签：`INCLUDED WITH A NEW ACCOUNT`

主数字：`5 credits`

价格：`$0`

说明：

> Use your included credits to generate actual reports and plans—not just browse a demo.

三项：

- `Granted once to each new account`
- `The same report-generation features as purchased credits`
- `Never expire`

按钮：`Get my 5 free credits`。

不称 Free plan，不将体验卡和付费卡做不同功能对比。若实施核查发现赠送点存在实际功能限制，必须先校正文案，不擅自承诺等同。

### 4.5 加购卡

标签：`BUY WHEN YOU NEED MORE`

价格主显示：`$19`；相邻文本：`USD / credit`。

说明：`One additional credit for your account. No recurring payment.`

三项：

- `One-time purchase`
- `Works across your Cases`
- `Never expires`

按钮：`Buy 1 credit · $19`。

按钮下方：`Checkout with Dodo Payments`。

本轮没有数量选择器、购买套餐或不同折扣。展示货币单位，但不新增未经核实的含税/免税或其他支付承诺，沿用真实结账配置。

### 4.6 简短失败保障

价格卡下方一条小型图标提示：

> Technical failure? The credit used for that generation is returned automatically.

这不是“所有不满意都退款”的保证。不再在首屏展开“返还后重试再扣”全过程。

## 5. 登录状态与余额显示

首屏保持相同布局，文本和左卡按状态变化。右侧 $19 卡保留，避免页面结构跳动。

| 状态 | 标题/左卡 | 主操作 |
| --- | --- | --- |
| 身份加载中 | 保留公共价格信息；账户区域中性加载，不闪现假余额或赠送到账 | 身份相关操作暂不可提交 |
| 未登录 | 五点免费体验卡 | Get my 5 free credits |
| 已登录、余额加载中 | Your credits / Loading your balance… | 可保留 Start a Case 导航；不展示“余额不足” |
| 已登录、余额 > 0 | Your balance / X credits / Never expire | Start a Case |
| 已登录、余额 = 0 | Your balance / 0 credits / Add a credit when you’re ready for your next report. | Buy 1 credit · $19 |
| 已登录、余额失败 | Your balance / Balance unavailable / 明确 Refresh 操作 | Retry balance；不要将未知值当 0 |

### 已登录首屏文案

有余额：

> Your next report starts here.
> Use your credits when you need them.

说明：`Use your available credits for a Prospect Evidence Report or a Verified Action Plan generation. Your balance never expires.`

零余额：

> Ready for your next report?
> Add a credit when you need one.

说明：`Additional credits are $19 each. No subscription, no recurring charge and no expiration.`

加载/异常时使用中性标题 `Reports when you need them. No subscription.`，不误称还有赠送点。

已登录左卡不显示“已送你五点”的到账事实，除非实际账户记录支持；新账户政策不是当前余额。单复数正确处理 `1 credit` / `X credits`。

### 注册与购买入口

- `Get my 5 free credits` 必须进入身份流程，不再借用只导航到 `/cases/new` 的 RunAuditButton。
- 优先调用现有 `useAppAuth().openSignIn()` 所提供的 Clerk 入口，支持现有账号登录与新账号注册；身份组件真实支持什么就展示什么。
- 避免先弹出当前带旧版 “Deep Trust Diagnostics” 文案的中间 GoogleLoginModal；本轮不为此重写全站登录组件。
- 登录/注册完成后回到 Pricing，显示真实余额和开始入口；不因为新登录在前端自行加 5，不重发赠送。
- 已登录主按钮 `Start a Case` 沿用现有工作入口及导航保护逻辑。
- 未登录点击购买先完成身份验证；返回后仍需用户明确点击购买，不自动创建支付会话。
- 取消身份操作没有账户/点数副作用，焦点回到触发按钮。

### 余额数据策略

复用 `AuditModalProvider` 中 `credits` 和 `refreshCredits`，以真实响应为准。它当前没有显式 loading/error，需以兼容方式补充，不为 Pricing 各区域各发一份请求。

首屏和底部 CTA 共用一次账户状态；登录、退出、切账号时清理前一用户状态和请求结果，迟到响应不得覆盖新用户余额。

购买确认成功后强制刷新共享余额。确认响应代表当时余额，随后刷新若失败可保留已确认数值并标识状态；不能随后被旧缓存覆盖。通过请求序号或等效机制处理竞争。

## 6. 模块二：一点能拿到什么

Eyebrow：`WHAT ONE CREDIT DELIVERS`

标题：`See the work behind one credit.`

说明：`A report for the prospect conversation, or a plan for the client work. Here is what the material looks like.`

两张成果卡并排，卡内直接展示成果。不要再放独立五步流程，也不要完整复制 Client Scenarios 的长报告。

### 6.1 样例内容来源

复用已经存在的 `src/components/useCase/client-work-example.ts` 中 Oak & Vale Cooling 的结构化案例数据；通过 Pricing 的轻量投影挑选必要字段，不复制两份数字和事实。

本轮不必为了文件目录美观移动共享数据；若未来移动，另行处理相关引用。公共页面样例不得从真实用户报告读取。

整个成果区保留一处 `Sample report · Oak & Vale Cooling`，不每行重复模拟提示。12,400 展示、310 点击、2.5% CTR 是示例基线，不是优化结果。日期固定显示 Aug 31–Sep 27, 2026，不永远称“最近 28 天”。

### 6.2 Prospect 卡具体内容

顶栏：`Prospect Evidence Report` + `1 credit`。

用途标题：`Bring a specific diagnosis into the first conversation.`

报告节选：

**Finding**

> The AC repair page exists, but visitors must look further down to understand the repair service and find a booking route.

**Evidence**

> The opening reads “Fast, reliable cooling solutions.” Repair problems are described later; the phone number is in the footer and the booking form follows the main content.

**First action**

> Clarify the existing page’s repair offer and bring the contact route forward before proposing another page for the same service.

**For the first conversation**

> Confirm that AC repair is a business priority and that the publicly listed service areas are still current.

边界短句：`Public observations—not a conclusion about lost enquiries.`

用途：`For first calls, a focused diagnosis and an initial scope discussion.`

链接：`Read the sample report →` → `/sample-report#sample-prospect`。

样例页可能使用不同企业；不用“Read this client’s full report”。

### 6.3 Verified 卡具体内容

顶栏：`Verified Action Plan` + `1 credit`。

用途标题：`Get a plan you can put to work.`

**Decision**

> Improve the confirmed AC repair page before creating another page for the same service.

**Supporting evidence**

> The page recorded 12,400 impressions and 310 clicks from Aug 31 to Sep 27, 2026. The client confirms its purpose and current service areas.

**Work to carry out**

> State the service and coverage in the opening. Bring common repair problems forward. Add a booking action and a tap-to-call link, then test both on mobile.

**Completion and review**

> Check the live page and contact route, then review comparable search activity and verified contact events where available.

边界短句：`Proposed work, not yet implemented. Contact events are not qualified enquiries.`

用途：`For work planning, execution handoff and client delivery.`

链接：`Read the sample plan →` → `/sample-report#sample-verified`。

卡底条件：`Available when continuing a completed Prospect Case with eligible client data.`

只说明进入条件，不额外解释两阶段合计几次。当前 direct-service 路径尚未开放，不能用 “any existing client, immediately” 文案掩盖限制。

### 6.4 设计细节

- 桌面双列报告式卡片，手机单列；每卡英文约 140–190 词，实际信息优先，不硬凑字数。
- `1 credit` 在标题旁清晰可见；不重复把每卡价格换算为美元，也不暗示赠送点要支付 $19。
- 企业/页面信息、判断、证据、行动形成层级；正文不小于约 15px。
- 只展示摘要，无展开详情、嵌套滚动、切换角色或可编辑假表单。
- 完整样例链接使用轻量文字箭头，不与首屏注册/购买主 CTA 争抢。

## 7. 模块三：简单点数规则

标题：`Simple credit rules.`

只保留四行，不在每行旁加一段长解释：

| 行为（上线英文） | 规则（上线英文） |
| --- | --- |
| Generate a Prospect report or Verified plan | 1 credit |
| Generate a new version | 1 additional credit |
| View, share or download an existing report | No additional credit |
| Generation fails for a technical reason | The credit used is returned |

下面一行：`Credit use is shown before you start a charged analysis.`

这句话发布前必须核对 Prospect 和 Verified 实际触发按钮；现有 goal-website-step 已显示扣点边界，但不能仅凭这一处就推断全流程一致。若缺少确认提示，记录缺口并最小补齐或改为不超出事实的文案，不擅自重做扣点逻辑。

接着放紧凑保障条，不再单独开大模块：

> One-time purchases through Dodo Payments. Credits are added after payment confirmation.

链接：`Refund policy →` → `/refund-policy`。

这一模块不出现企业数量、工作流组合、每个 Case 终身额度、完整客户成本、收益预测或 ROI 计算器。

## 8. 模块四：简短收尾 CTA

未登录标题：`Try the reports before buying more.`

正文：`New accounts receive five credits to experience the actual work. No subscription. No expiration.`

主按钮：`Get my 5 free credits`；次入口：`Read the sample reports`。

已登录有点：`Your next report is ready to start.`；显示余额；主按钮 `Start a Case`，加购作为文字次入口。

已登录零点：`Add a credit for your next report.`；主按钮 `Buy 1 credit · $19`；现有报告查看作为次入口 `/reports`。

加载/错误状态沿用首屏模型。首屏和页尾的购买忙碌状态必须同步，防止一处正在跳转时另一处仍可重复创建请求。

设计：一块紧凑浅绿横条，左文案右按钮；手机上下排列。不要再用与 H1 同量级的大标题或重复整张价格卡。

## 9. FAQ 完整文案

只保留七项。使用同一内容数组生成页面 FAQ 与 FAQPage JSON-LD，不在旧 PricingFAQ.tsx 另维护一份。

### 1. What can I use the five free credits for?

> The credits use the same report-generation features as purchased credits. You can use them for Prospect analysis or eligible Verified Action Plan generation. They are granted once to a new account and do not expire. The Verified stage requires a completed Prospect Case and eligible client data.

### 2. Is there a subscription, and do credits expire?

> No subscription or recurring charge is required. Both included and purchased credits stay in your account without an expiration date. Additional credits cost $19 USD each.

### 3. When is a credit used?

> One credit is used when competitor discovery starts a complete Prospect analysis, or when a Verified Action Plan generation starts. Entering a website, confirming the business and connecting or synchronizing supported client data do not use a credit. Correcting a competitor or resuming the same active workflow does not use another credit.

### 4. Is editing a plan the same as generating a new one?

> No. Reviewing or editing the supported action-plan fields does not start a new analysis. Generating a new report or plan version uses one credit. Viewing, sharing and downloading an existing report do not use another credit; the existing review and approval requirements still apply to client delivery.

实施时核对现有编辑与批准路径没有扣点副作用，不把样例页的全部叙述编辑都写成真实工作区能力。

### 5. What if a generation fails?

> If a charged generation fails for a technical reason, the credit used is returned automatically. Starting a new generation after the return uses one credit again. This is a credit return, not a cash refund.

### 6. Can I use it for a client I already serve?

> You can continue client work from a completed Prospect Case, with client confirmation and eligible data access. A direct service-only start for a client without a Prospect Case is not available yet. Opening the entry page does not use a credit.

### 7. How do payment and refunds work?

> Purchases are processed through Dodo Payments, and credits are added after payment confirmation. An unused purchased credit may be refunded after the provider confirms the reversal. Used credits require manual review. See the Refund Policy for the applicable process.

FAQ 中不新订退款承诺、期限或“无条件退款”；沿用当前政策。初始可全部收起，使用已有 FAQAccordion 的可访问交互；不为本页另造组件，必要时加兼容的初始展开配置。

## 10. 付款状态与恢复设计

这是本次 Pricing 改动中的功能项，但仅改善前端状态和恢复，不重写付款服务。

### 10.1 购买前

- 身份未知时不自动开登录弹窗、不创建订单；按钮先进入中性等待状态。
- 已登录用户明确点击 `Buy 1 credit · $19` 后调用现有 checkout 接口。
- 首屏与底部共享单次购买 busy 状态；双击或两处连点只产生一个前端请求。
- 保留 HTTPS 和 Dodo 域名校验；不能接受返回的任意跳转地址。
- 发起失败在按钮附近显示：`Checkout could not be opened. Please try again.`，必要时保留安全可读的具体说明。
- 不显示原始堆栈、密钥、支付 ID 或提供方内部数据。

### 10.2 付款返回状态

状态条放导航与 Hero 之间；没有返回参数时不渲染外层空白容器。

| 状态 | 内容与操作 |
| --- | --- |
| 身份等待 | `Sign in to confirm this purchase.` / Sign in；不在身份未准备好时调用确认接口 |
| 确认中 | `Confirming your purchase…`；不展示再次购买主操作 |
| 已确认 | `Purchase confirmed. Your balance is X credits.` / Start a Case；刷新共享余额 |
| 服务明确返回 pending | `Payment is still being confirmed. Please do not pay again.` / Check payment status |
| 网络或未知异常 | `We couldn’t confirm the status yet. Check again before making another purchase.` / Check payment status + 现有真实支持渠道 |
| 提供方明确失败 | 使用已验证的失败状态与可执行下一步，不根据通用 HTTP 错误自行推断支付失败 |
| 用户取消 | `Checkout was cancelled. If you completed a payment elsewhere, check its status before trying again.`；不凭 URL 参数声称没有扣款 |
| 缺少 payment_id | `We couldn’t identify this payment return.` / 支持入口；不发缺失参数请求，不显示成功 |

当前确认接口返回 `ok`、`credits_added`、`credit_balance`、`already_confirmed`。实施时只映射服务实际提供的错误码；如果没有 pending 语义，使用“暂时无法确认”，不能把所有错误都说成处理中或未付款。

### 10.3 重查与幂等

- `Check payment status` 重查同一 payment_id，不创建新的 checkout、不再次购买。
- 默认一次自动确认；后续手动重查，busy 期间禁用重复点击。无需无限自动轮询。
- `already_confirmed` 属于成功，不显示“又到账一点”；以服务返回余额为准。
- 未确认之前保留恢复所需 payment_id；不用它做余额或到账判断依据。
- 确认成功后只移除相关支付参数，保留其他查询参数、hash 和 history state；不粗暴 replace 为裸 `/pricing`。
- 不把支付标识发送到新增埋点或第三方日志；现有错误信息也不在 UI 泄露敏感内容。
- 登出/切账号/组件卸载时取消或忽略旧确认结果，防止把前一用户结果展示给后一用户。
- 支持入口复用站内已存在且实际可用的联系方式；实施前确认，不编造邮箱或空链接。如果站内没有可靠支持入口，交付时明确指出该缺口。

## 11. 代码改动范围

以下相对路径均位于上述前端仓库。

| 文件 | 计划改动 |
| --- | --- |
| `src/app/pricing/page.tsx` | 新顺序；FAQ/schema 同源；状态条无空白占位 |
| `src/components/pricing/PricingHero.tsx` | 居中首屏、免费/余额卡、加购卡；消除 Georgia 与旧组合教学 |
| `src/components/pricing/WhatOneCreditStarts.tsx` | 重写为两份成果摘要；删除五步流程、mixes 与重复边界块 |
| `src/components/pricing/BillingDetails.tsx` | 收敛成四行规则及紧凑保障条，组件名可暂保留避免无必要迁移 |
| `src/components/pricing/PricingCTA.tsx` | 短 CTA，复用身份/余额状态与购买动作 |
| `src/components/pricing/CreditPurchaseButton.tsx` | 购买 busy 协调、状态错误与同订单重查；可拆付款状态组件避免文件过大 |
| `src/components/pricing/PricingExperience.tsx`（新增） | Pricing 局部协调：购买状态、身份入口、付款确认；不引入全局状态库 |
| `src/components/pricing/pricing-content.ts`（新增） | 公共文案、四条规则、FAQ、样例投影与可靠链接，作为唯一内容源 |
| `src/components/pricing/pricing-v22.module.css` | 统一首屏与页面样式，删除不再使用的 journey/mix 布局，避免尾部堆叠覆盖 |
| `src/components/common/AuditModalProvider.tsx` | 兼容补充余额加载、错误、刷新与账户切换防护；不修改赠送或扣点业务 |
| `src/lib/seo.ts` | 仅更新 pricing 条目 |
| `src/components/pricing/PricingContent.test.tsx` | 替换旧组合教学断言，测试成果与简洁规则 |
| 新的 PricingHero / CreditPurchaseButton 状态测试 | 登录、余额、购买、返回恢复及幂等展示 |
| `e2e/pricing-experience.spec.ts`（新增） | 内容、响应式、身份入口、购买返回的本地桩测试 |

现有 `PricingFAQ.tsx`、`WhoThisIsFor.tsx` 不在当前页面挂载，不因名字相近误用。若要删除未引用旧文件，先检查全部引用并在实施变更清单记录；不把清理设为页面完成的必要条件。

现有后端 `src/lib/credit-payments-v22/*` 和 `credits-v22/*` 作为契约参考；本次不改金额校验、幂等入账、所有权校验和退款业务。

### 组件与状态契约

- `PricingExperience` 持有购买协调状态：idle/opening/error；付款返回状态独立于购买状态。
- `PricingHero` 与 `PricingCTA` 消费同一 `authState + balanceState + purchaseState`，不各自算一次余额。
- `balanceState` 明确区分 loading/ready/error；ready 内 balance 可为 0；错误不会隐式转 0。
- `CreditPurchaseButton` 的实际 checkout 行为由同一协调动作触发；保持其他调用处兼容。
- `WhatOneCreditStarts` 与 `BillingDetails` 仅渲染静态内容，无身份/计费副作用。
- 报告样例与用户余额完全隔离；页面静态 $19 不能用来决定服务端付款是否有效。

## 12. 页面 SEO 与文案一致性

页面标题建议：`Pricing: 5 Free Credits, Then $19 per Credit | SearchTrust`

描述建议：`Try SearchTrust with five free credits. Generate Prospect reports or eligible Verified Action Plans, then buy more credits for $19 each. No subscription or expiration.`

- `/pricing` 地址、导航名称与 canonical 规则不变。
- FAQPage 结构化内容必须与可见 FAQ 相同。
- 不添加免费/付费两套不存在的产品套餐 schema。
- 不写未经证实的“No card required”，除非实际完整注册/赠送流程已验证。
- 不写“Guaranteed results”“5 clients free”“one credit covers a client forever”。
- 全站别处文案若与当前规则冲突，只记录并做必要的最小一致性修正，不全面改写其他页面。

## 13. 实施顺序

### T1｜冻结文案与数据投影

完成 pricing-content：首屏、价格卡、两份报告摘要、四条规则、七项 FAQ；链接至共享样例事实。核查赠送能力、真实扣点确认和支持入口。

完成标准：没有五点分配教学；公共数据与私有数据阶段正确；没有占位或未经确认的商业承诺。

### T2｜首屏视觉与静态页面重排

完成无衬线居中首屏、两卡、成果区、简化规则、收尾 CTA。先用未登录静态状态审阅。

完成标准：与 Sample Reports、Client Scenarios 并排截图时像同一网站；优惠、价格、按钮易发现；不存在 Free/Pro 功能层级误导。

### T3｜接入身份与余额

接入已有身份入口与共享余额，补充加载/错误状态、登录退出刷新和零余额差异。首屏与底部一致。

完成标准：登录用户看到真实余额；未知不等于 0；旧账号不会被承诺再次领取；免费按钮确实进入身份流程。

### T4｜购买与返回确认恢复

统一购买 busy；确认一次、手动同单重查、成功刷新余额、取消/缺失参数/异常处理。复用后端接口，不改变计费规则。

完成标准：连点不会创建重复前端请求；未知状态不显示支付失败；重查不发新订单；重复确认不重复显示到账。

### T5｜自动化、响应式与跨页回归

按下一节测试，修复本次引入的问题；现有无关失败单独列出，不混同为本次通过。

完成标准：内容、身份、付款状态、本地测试与构建达到验收要求；跨页样例和入口可用。

### T6｜交付与上线前检查

交付预览、首屏对照截图、各账户状态截图与测试报告。本计划不授权实际支付；本地支付流程使用桩，不以测试名义在生产扣款。

上线应独立执行现有发布流程，核对实际价格、功能开关和 Dodo 配置。不能用本地桩测试证明生产付款已经验证。

## 14. 验收与测试清单

### 内容与视觉

- 保留 $19、5 点、永久有效、无订阅；没有改规则。
- 不出现完整客户消耗表、五点组合、客户数量算式。
- 两份成果都有真实形态的具体内容，不退回功能名词列表。
- 退款与技术失败返点清楚区分，重要扣点信息在 FAQ 可找到。
- 首屏字体、标题宽度、按钮、背景和间距与其他 Tab 一致；无 Georgia。
- FAQ 可见文本与 JSON-LD 一致；当前页面不引用旧单 URL 购买文案。

### 身份与余额测试

- 未加载、未登录、加载余额、余额 5/1/0、错误均有明确状态。
- API 返回非法或缺失余额不能显示为有效余额。
- 退出后清除显示；切账号时旧请求不能覆盖新状态。
- 首屏与底部状态一致，购买成功后余额及时更新。
- 刷新页面/重复登录不会在前端重复赠送五点。
- 免费入口进入身份组件，而不是与文案不一致地先导航录入流程。

### 购买与付款返回测试

- 未登录不创建 checkout；已登录明确点击才创建。
- 主次购买入口连点、双击时只允许一个进行中的请求。
- 不安全/缺失 checkout_url 不跳转。
- 成功、重复确认、pending（若契约支持）、401、5xx、超时、取消、缺少 ID 均覆盖。
- 同单重查调用 confirm 而非 checkout；刷新重复返回仍依赖服务器幂等。
- 确认未完成前不清除恢复信息，确认成功仅清理支付参数。
- 身份未加载时不提前确认；切账号/卸载不应用旧结果。
- 不显示“付款一定未扣款”“重试购买即可修复”之类无依据判断。

### 响应式与可访问性

- 320、390、768、1024、1440px；额外测试 1280×720 首屏与 200% 缩放。
- 价格卡与成果卡窄屏单列，无内部横滚/纵滚和文字裁切。
- 金额、USD、/credit 不能因换行变得难以理解。
- 按钮点击区至少 44px；Tab 顺序、focus-visible、FAQ 展开可键盘操作。
- 状态更新使用合理的 role=status / role=alert；加载有文字，不只旋转图标。
- 没有自动轮播、长动画；reduced motion 正常。
- 普通访问没有付款状态空白占位，加载余额不造成整块布局大幅跳动。

### 回归与安全

- 现有样例深链接、Cases 入口、Header 与 Footer 正常。
- 全局余额上下文修改不破坏已有工作区消费方。
- 页面加载、浏览样例、FAQ 展开不能生成分析、扣点或创建 checkout。
- 测试网络使用现有外部请求保护；不访问真实 Dodo 支付或运行付费分析。
- 不增加插件、状态库或精细埋点，不记录支付标识到第三方分析服务。

### 计划中的验证命令

```bash
npm run typecheck
npm test -- src/components/pricing
npm test -- src/lib/credit-payments-v22 src/lib/credits-v22
npm run test:e2e -- e2e/pricing-experience.spec.ts e2e/marketing-navigation.spec.ts e2e/work-entry.spec.ts
npm test
npm run build
```

共享余额上下文的新测试应同时运行其实际文件路径。现有 E2E 默认测试身份为登录用户，未登录场景需正确的本地身份桩/配置，不能靠点击退出或修改真实 Clerk 账户来造状态。

上述是未来实施的验证要求；本计划编写时没有运行产品测试或支付操作。

## 15. 最终交付清单

1. 完整 Pricing 页面，包含静态内容、身份/余额状态和付款恢复。
2. 最终英文文案与同源 FAQ，具体成果摘要与共享事实一致。
3. Pricing / Sample Reports / Client Scenarios 的桌面首屏对照截图。
4. 手机 Pricing 首屏、成果区和账户/付款状态截图。
5. 测试结果、未完成或需生产核验事项、精确变更文件清单。

验收核心：**用户能直接理解“先免费体验实际成果，之后按需补点”，不用先算一个客户会消耗多少，也不会因为简化宣传而在实际扣点或购买时感到意外。**
