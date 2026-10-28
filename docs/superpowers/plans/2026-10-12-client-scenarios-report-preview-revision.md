# Client Scenarios：报告预览与可用成果模块改动计划

日期：2026-10-12  
状态：计划完成，未实施。  
页面：`/use-cases`。  
范围：首屏下方两张报告预览，以及故事区之后的角色分工模块。

## 1. 已确认的改动目标

核心表达：**产品已经把分析、建议与交付材料整理好。SEO 审阅后可以使用；有特殊需求时可以调整，但修改不是使用前提。**

本轮不再解释“这里会提供哪些内容”，直接展示内容本身：具体页面、发现、证据记录、数字、判断、执行步骤和客户说明。

- 模块一回答：获客与服务阶段，分别能拿到什么成果？
- 模块二回答：这些成果已经整理到什么程度，能省下哪些准备与交付工作？
- 两处使用同一家示例企业、同一个页面、同一组证据，避免互相矛盾。
- 使用虚构样例；每个独立模块只保留一个清晰、轻量的 `Sample report` 标识，不逐条强调模拟，也不将样例包装成实际客户业绩。
- 不编造优化后的增长，不使用客户评价、真实客户 Logo 或“已验证成功”等标识。

### 本轮明确保留

- 当前首屏 H1、主导航和原有两个首屏入口。
- 当前十五个场景内容及两个连续横向轮播（获客 6 个、服务 9 个）。
- 当前阶段选择、卡片记忆、旧链接和键盘逻辑。
- 页面底部工作入口、FAQ、计费与登录流程。

旧的整页计划曾设计组级 Tab；实际版本已经变成两阶段连续轮播。本轮以当前实现为准，不恢复组级 Tab，不顺带重新改场景区。

### 本轮明确删除/替换

- 首屏 `Observation / Client question / First direction` 等通用字段式预览。
- `The division of work`、`A working starting point. Your professional judgment.`。
- `SearchTrust helps prepare / You remain in control` 两列职责清单。
- 将“修改后的计划”写成默认必经步骤的正文。
- 上述两个模块中冗长重复的模拟免责声明；报告本身的证据限制继续保留。

## 2. 页面位置与信息层次

```text
现有首屏标题、介绍、两个入口（保留）
  ↓
模块一：两份具体报告摘要（替换现有 heroPreviews）
  获客报告：具体发现、建议起点、待确认项
  服务计划：数据依据、判断、三项行动
  ↓
现有十五个场景（保留）
  ↓
模块二：可用成果展开（替换现有 relationship 区）
  01 诊断记录：具体证据 → 判断 → 推荐理由
  02 执行任务：目标 → 步骤 → 完成标准 → 复核
  03 客户交付：默认 Client view，可切换 SEO view
  一条辅助说明：适合即可用，需要时也能调整
  ↓
现有底部入口与 FAQ（保留）
```

模块一是摘要，模块二是展开；不能把同一份长文完整复制两遍，也不能让模块一只剩功能介绍。

## 3. 统一案例与数据基线

单独建立共享样例数据，不从十五个场景或其他样例报告拼装。

| 项目 | 固定内容 |
| --- | --- |
| 企业 | Oak & Vale Cooling |
| 地点与业务 | Austin, TX · AC repair |
| 示例域名 | oakvalecooling.example（只作文本，不发起请求） |
| 目标页面 | `/ac-repair/` |
| 当前页面 H1 | `Fast, reliable cooling solutions` |
| 页面正文 | 常见维修问题在后半部：not cooling、water leaks、unusual noises |
| 服务范围 | North Austin、Central Austin；获客阶段待确认，服务阶段已确认 |
| 联系入口 | 电话在页脚，预约表单在正文末尾，首屏没有直接联系入口 |
| GSC 时间窗口 | Aug 31–Sep 27, 2026，28 天，固定日期而非永远称“最近 28 天” |
| GSC 页面展示 | 12,400 |
| GSC 页面点击 | 310 |
| GSC 页面 CTR | 2.5%，由 310 ÷ 12,400 得出 |
| 客户确认 | 此页面为 AC repair 主要承接页面；上述区域当前有效 |
| 建议 | 优先完善现有页面，暂不新增服务范围重叠的页面 |
| 实施状态 | Proposed · Not yet implemented |
| GA4 | 本例不编造已取得的 GA4 数据；只列未来可复核且需验证的事件方向 |

证据编号：

- E01：页面首屏文字。
- E02：服务内容的位置。
- E03：联系入口的位置。
- E04：GSC 页面数据及固定时间范围。
- E05：客户确认的页面用途与服务区域。

一致性规则：

1. Prospect 摘要只使用 E01–E03；不能提前出现 GSC 或已确认客户事实。
2. Verified 摘要与模块二使用 E01–E05。
3. 310 次点击是改动前的观察数据，不是产品带来的效果。
4. “缺少首屏信息”不能推导为“已流失多少客户”；联系事件不能直接当有效询盘。
5. 当前没有前后期对照数据，不画增长曲线、不加上升百分比。
6. 优先级使用有理由的定性建议，不虚构影响评分或收益预测。
7. 页面材料使用固定来源信息；不伪装成浏览器刚刚抓取或账户已连接的实时结果。

## 4. 模块一：两份具体报告摘要

### 4.1 公共展示结构

每卡依次展示：

1. 卡外阶段与价值标题。
2. 报告顶栏：企业、报告名称、页面或城市。
3. 一句明确诊断/决策。
4. 三项具体发现或行动。
5. 建议起点或复核说明。
6. 一条必要限制。
7. 卡外用途和进入相应场景的链接。

两张卡区域顶栏统一放 `Sample report · Oak & Vale Cooling`。报告名和状态不能使用“客户验证成功”等背书。

### 4.2 左卡上线英文内容

阶段：`BEFORE YOU WIN THE WORK`

价值标题：`A prospect report you can take into the conversation.`

报告顶栏：`OAK & VALE COOLING · Austin, TX` / `Prospect Evidence Report`

结论：

> The AC repair page exists. Its service coverage and booking route are not clear at the point of entry.

三条具体发现：

- **A broad opening.** The page opens with “Fast, reliable cooling solutions.” AC repair and the problems covered are not stated in the opening section.
- **Coverage takes another visit.** North and Central Austin are listed on a separate service-area page, not beside the repair offer.
- **Contact comes late.** The phone number is in the footer and the booking form is below the main content. There is no direct contact action in the opening section.

建议起点：

> **Start here:** Improve the existing page’s service explanation, coverage and contact route before proposing another repair page.

待确认：

> **One question for the first call:** Is AC repair a current priority, and are both areas still served?

用途：`For a first call, a focused diagnosis and an initial scope discussion.`

链接：`Explore prospect situations →` → `/use-cases#practice-first-conversation`。

说明：页面公开列出服务区域与客户是否实际继续覆盖，是两个不同事实；不将“公开出现”写成“客户已确认”。

### 4.3 右卡上线英文内容

阶段：`ONCE THE WORK BEGINS`

价值标题：`An action plan you can put to work.`

报告顶栏：`OAK & VALE COOLING · /ac-repair/` / `Verified Action Plan`

结论：

> Improve the existing AC repair page before adding another page for the same service.

依据：

> The page recorded **12,400 impressions and 310 clicks** in Google Search Console from **Aug 31 to Sep 27, 2026**. The client confirms it is the main AC repair page and that North and Central Austin are current service areas.

行动：

1. **Clarify the opening.** State AC repair, the confirmed service areas and the repair problems covered.
2. **Bring contact forward.** Add a booking action and a tap-to-call link near the opening; retain the full form below.
3. **Check and review.** Test the mobile contact path, then review comparable page-level search activity and verified contact events where available.

限制：

> Contact events are not qualified enquiries. These observations do not establish lost bookings or predict a ranking increase.

用途：`For work planning, execution handoff and the next review.`

链接：`Explore ongoing client work →` → `/use-cases#practice-revisit-recommendation`。

两处入口是通往相应阶段的故事，不称“查看这家企业的完整故事”；目标故事可能使用不同业务案例。

### 4.4 布局与长度

- 桌面两列，左右是同等重要的两种成果；标题下直接是报告，不加第二套功能列表。
- 预览宽度从当前约 950px 放宽到页面内容上限约 1200px，避免复杂内容挤成细长两列。
- 每卡约 180–230 个英文词；控制写作长度，不通过裁切或省略号隐藏结果。
- 主体 15–16px、行高约 1.6；来源和时间不小于 12px；不靠缩字塞进原卡片高度。
- 去掉原 `.heroPreview p` 的固定字段/值两栏网格；采用报告分段和列表。
- 两卡自然等高，不设会裁掉内容的固定高度；内部不出现纵向滚动条。
- 900px 以下转单列；卡间保留阶段区别，不添加新轮播。
- 调小原首屏装饰性留白，使新增内容不会把场景入口推得过远；不承诺所有内容塞进一个屏幕。
- 不添加优化后数值、仪表盘、假图表或装饰性实时状态。

## 5. 模块二：三份已经整理好的工作内容

替换职责分工，不新增“你必须做的工作”大面板。

Eyebrow：`LESS PREPARATION. MORE CLIENT WORK.`

标题：`From analysis to client-ready work.`

介绍：

> Findings, evidence, execution steps and a client explanation—organized into a report and action plan, without rebuilding the material from a checklist.

案例顶栏：`Sample report · Oak & Vale Cooling · /ac-repair/`。

三个成果章节始终展开。它们是报告内容的组织方式，不是三种新产品，也不意味着增加三个任务系统。

### 5.1 第一部分：诊断记录

小标题：`Findings you can explain.`

报告标题：`FINDING 01 · SERVICE PAGE CLARITY`

结论：

> The page is receiving search clicks, but service and contact information are not presented together at the point of entry.

检查对象：`oakvalecooling.example/ac-repair/`。

完整证据记录（默认可见）：

| ID / Source | Observed evidence |
| --- | --- |
| E01 · Page opening | H1: “Fast, reliable cooling solutions.” The opening does not explicitly name AC repair, the service areas or a booking route. |
| E02 · Page content | “Not cooling,” “water leaks” and “unusual noises” appear later in the page, separate from the opening explanation. |
| E03 · Contact path | The phone number is in the footer. The booking form follows the main content. No direct contact action appears in the opening section. |
| E04 · Google Search Console | Aug 31–Sep 27, 2026 · This page · 12,400 impressions · 310 clicks · 2.5% CTR. |
| E05 · Client confirmation | This is the main AC repair page. North Austin and Central Austin are currently served. |

判断面板：

**Recommendation**

> Improve the confirmed page before creating another page for the same service. Existing search visibility supports reviewing this page first; the content observations identify specific information and contact changes to make.

**Why this is a practical first action**

> The target is already confirmed, the gaps are located on the page, and the work does not require a new page or a site-structure change.

**What the evidence does not establish**

> It does not prove that these gaps caused lost enquiries or show how rankings will change after the work.

价值收束（只一句）：`The reason for the recommendation is already beside the work—not left for you to reconstruct.`

布局：桌面左约 62% 证据，右约 38% 判断；手机先证据再判断。证据文字是正文，不缩成表格脚注。窄屏将证据行改为带来源标题的堆叠记录，不能横向滚动才能看完。

### 5.2 第二部分：执行任务

小标题：`Actions with the next steps included.`

任务标题：`ACTION 01 · UPDATE THE EXISTING SERVICE PAGE`

主标题：`Clarify the AC repair offer and bring booking into the opening section.`

基础信息：

- Target：`/ac-repair/`
- Suggested priority：`Address first`
- Suggested implementation role：`Website editor / site maintainer`
- Status：`Proposed · Not yet implemented`

目标：

> Help visitors identify the repair service, confirm the service area and find a contact route without searching through the whole page.

四步说明：

1. **Make the opening specific.** Name AC repair and the confirmed Austin coverage. Describe the repair problems covered. Do not add unconfirmed promises such as 24-hour response or same-day attendance.
2. **Move repair details forward.** Bring the existing “not cooling,” “water leaks” and “unusual noises” information closer to the opening. Keep the detail relevant to the confirmed service.
3. **Add a direct contact route.** Use “Book AC repair” to reach the existing form. Add a tap-to-call link using the verified business number. Keep the full form and contact information below.
4. **Check the mobile path.** Confirm that the service text is readable, the button is unobstructed, the phone link works and the form can be submitted.

完成标准：

- AC repair and the confirmed service areas are explicit near the opening.
- Common repair problems can be found without reading the whole page.
- The booking action reaches the intended form.
- The phone link and form have been functionally checked.
- No unconfirmed service guarantees have been added.

后续复核：

| Review | What to inspect |
| --- | --- |
| Implementation | Check the live page against the completion criteria above. |
| Search activity | Compare page-level impressions, clicks and CTR over suitable, comparable windows. |
| Contact behavior | Review verified contact events where available; phone clicks are not completed calls and submissions are not qualified leads. |
| Next decision | Consider sample size, concurrent changes and client feedback before retaining or changing the plan. |

价值收束：`The recommendation already includes the target, steps and completion checks for a work handoff.`

布局：桌面左侧目标与步骤，右侧完成标准与复核；手机自然顺序展开。完成标准可用静态空框装饰，但不得渲染成可勾选、可保存的实施管理控件。不展示假负责人头像、虚构进度百分比或已完成时间线。

此任务是模块一行动 01 与 02 的展开，底层引用同一目标和步骤来源；模块一行动 03 对应这里的检查与复核。不另造一套互相矛盾的行动列表。

### 5.3 第三部分：客户交付

小标题：`A report you can review and share.`

控件：`Client view` / `SEO view`；默认 Client。

#### 默认 Client view 正文

报告顶栏：`OAK & VALE COOLING · AC repair page`

标题：`Make the existing repair page easier to understand and act on.`

引言：

> Your AC repair page recorded 310 Google Search clicks from Aug 31 to Sep 27, 2026. We recommend improving this page before adding another page for the same service.

**What we found**

> The page explains the repair service, but visitors need to look further down to find specific repair problems and the booking form. Service coverage is not stated beside the main offer.

**The proposed work**

1. State the repair service and confirmed coverage in the opening section.
2. Bring common repair problems into a more visible position.
3. Add a clear booking and phone route, then test it on mobile.

**Why start here**

> These changes address identified information and contact gaps on a page already receiving search clicks. They do not depend on creating another page first.

**How we will review it**

> First, check that the agreed page and contact changes work as intended. Then review comparable search activity and verified contact events where available. Whether qualified enquiries improve requires follow-up evidence and actual enquiry records.

状态：`Proposed work · Not yet implemented`。

#### SEO view 正文

不能只显示另一个短口号。显示同一结论的专业摘要：

- **Decision:** Improve `/ac-repair/`; defer a duplicate service page pending a distinct need.
- **Evidence:** E01–E03 locate the content/contact gaps. E04 records page-level search activity. E05 confirms page purpose and current coverage.
- **Baseline:** Aug 31–Sep 27, 2026 · 12,400 impressions · 310 clicks · 2.5% CTR.
- **Execution:** Opening specificity, repair details, booking/call route and mobile checks as defined in Action 01.
- **Acceptance:** Clear service/coverage, working contact path, no unconfirmed claims.
- **Review limits:** No implementation or post-change outcome is recorded here. Contact events require validation and do not represent qualified enquiries.
- **Status:** Proposed · Not yet implemented.

视图共用结论、指标、来源与状态，只改变解释的详细程度。Client view 同样保留关键不确定性，不通过简化产生更强的结论。

布局：报告纸张式区域，正文阅读宽度约 65–75ch；不要把客户说明挤成侧边窄卡。视图切换位于报告顶栏，不影响上面的诊断与任务内容。

底部链接：`View the complete sample reports →` → `/sample-report`。当前样例页可能是不同企业案例，因此不能写“Read this client’s full report”。不增加假 Export/Send/Approve 按钮。

### 5.4 辅助的可调整性说明

三个成果之后仅放一条轻量区域，不能再变成模块主角。

标题：`Ready to use. Flexible when needed.`

正文：

> When the plan fits the client, review it and use the existing delivery flow. When circumstances call for a change, adjust the action order, scope, steps and arrangements without rebuilding the plan.

辅助标签：`Order`、`Action scope`、`Steps`、`Owner & timing`、`Completion & review`。

小字：`Adjusting an action does not rewrite its original evidence.`

本轮不做修改前后演示或可编辑样例，避免再次让用户以为必须修改。现有产品的审阅与批准要求保持不变；不新增“必须编辑一次”要求，也不绕过交付批准。

## 6. 视觉与交互规格

### 视觉原则

- 延续现有深绿、浅绿/浅青、字体与圆角体系。
- 模块一两份摘要；模块二三段宽幅工作材料。不要整个页面都是相同两列大卡。
- 标题、结论、证据和状态有明显层级；不靠增加巨大标题和空白撑起价值。
- 默认全部展开，不用 Read more，不用轮播隐藏模块二内容。
- 报告内容是真实 DOM 文本，不是图片；支持选择、缩放和辅助技术阅读。
- 800px 以下诊断/任务双栏转单栏；320px 不出现全页横向溢出。
- 200% 缩放时不遮挡；标题允许换行，来源与日期不强制单行。
- 关键正文 15–16px 起，辅助信息 12–14px；不沿用旧 11–12px 的密集段落。

### 唯一新增交互：交付视图切换

- 使用独立 tablist，名称 `Report delivery audience`。
- 两个 tab 关联各自 tabpanel；只有当前 tab 可通过 Tab 键直接聚焦。
- 左右键切换，Home/End 到首尾；焦点留在选中 tab。
- inactive panel 不可见且不进入焦点序列；不修改故事区 tab 状态。
- 切换不改 URL、不写本地存储、不发请求、不触发整页滚动。
- 默认 Client，刷新恢复 Client；无需模拟加载或生成状态。
- 不自动播放，不做长过渡；reduced motion 下即时切换。
- 控件触摸区域至少 44px，focus-visible 清晰。

### 入口规则

- 首屏新增两处场景链接使用已有有效故事 hash；沿用现有恢复机制。
- 不新增会被现有 restoreFromHash 判为无效并重置故事的自定义锚点。
- 模块二只有样例报告导航，无真实分享、支付或生成行为。
- 示例域名与目标 URL 作文本；不链接虚构网站，不调用第三方数据服务。

## 7. 代码改动位置

仓库：`/Users/liuyun3/Documents/SearchTurst前后端/search-trust`。

| 文件（相对仓库） | 工作 |
| --- | --- |
| `src/components/useCase/UseCasesV22.tsx` | 将 heroPreviews 与 relationship 两块替换为新组件，保持其余编排。移除本文件中已无用途的图标导入。 |
| `src/components/useCase/client-work-example.ts`（新增） | 单一案例数据：企业、来源、指标、日期、判断、行动、状态与两种交付叙述。 |
| `src/components/useCase/ReportOutcomePreviews.tsx`（新增） | 模块一两份摘要；纯展示，无客户端状态。 |
| `src/components/useCase/ReadyToUseWork.tsx`（新增） | 模块二标题、诊断记录、执行任务、可调整性辅助说明。 |
| `src/components/useCase/ClientDeliveryPreview.tsx`（新增） | 独立 client component，仅管理 Client/SEO 两个视图。 |
| `src/components/useCase/client-work-preview.module.css`（新增） | 两模块专属布局、报告样式和视图状态，避免继续堆叠旧 CSS 覆盖规则。 |
| `src/components/useCase/practice-workbench.module.css` | 最小移除两块确定不用的旧规则/负边距，调整必要的首屏间距；不全文件格式化或清理故事样式。 |
| `src/components/useCase/client-work-example.test.ts`（新增） | 数据一致性、阶段证据隔离、指标计算与状态检查。 |
| `src/components/useCase/ClientWorkPreview.test.tsx`（新增） | 具体内容、可访问性、视图切换和只读行为。 |
| `src/components/useCase/UseCasesV22.test.tsx` | 整页组合回归；保留十五故事断言，新增模块定位断言。 |
| `e2e/use-cases-workbench.spec.ts` | 将现有全页面“只有一个 tablist”断言限定到故事区；不削弱故事行为覆盖。 |
| `e2e/client-work-preview.spec.ts`（新增） | 两模块响应式、视图切换、入口与无业务副作用检查。 |

不改 backend、数据库、报告 API、点数、认证、发布配置或共享样例报告数据。

### 数据与组件接口

- `ClientWorkExample` 包含 `business`、`page`、`period`、`metrics`、`evidence[]`、`decision`、`actions`、`deliveryCopy`、`implementationStatus`。
- 证据包含稳定 ID、来源、阶段权限（public/verified）、具体观察；指标保存数字，格式化统一生成。
- `ReportOutcomePreviews({ example })`：从同一数据挑选阶段摘要；禁止 Prospect 访问 verified-only 证据。
- `ReadyToUseWork({ example })`：渲染完整诊断与任务，组合交付视图。
- `ClientDeliveryPreview({ example })`：默认 audience=client；不对外暴露修改、保存、发送回调。
- 同一数字、日期、结论不能在不同组件独立手写；文案中引用结构化值。
- 示例数据不得导入生产报告生成/权限逻辑；也不得由真实账户数据填充此公共页面。

## 8. 执行任务与完成条件

### T1｜建立共享案例内容

将第 3–5 节整理为英文数据源与数据测试。核对 CTR、固定日期、前后阶段证据权限和“尚未实施”状态。

完成条件：不存在“已检查页面和相关证据”这种替代真实观察的占位句；两模块和两视图没有事实冲突。

### T2｜替换首屏预览

实现两份报告摘要、价值标题和场景入口；移除旧字段网格与长免责声明，保留轻量 Sample report 标识。

完成条件：不读功能介绍也能看到具体结论、发现和行动；桌面双列、手机单列；文字没有裁切。

### T3｜替换角色分工主体

实现诊断记录、完整执行任务和客户说明三个展开章节。先实现静态默认 Client 内容，再接入视图切换。

完成条件：用户能直接读到依据、工作步骤、完成标准和客户版说明；不再需要自己把三份职责列表拼成流程。

### T4｜补齐交互与辅助说明

完成 Client/SEO 切换、键盘焦点、辅助的可调整性说明和完整样例入口。

完成条件：默认成果可读，不操作也能理解价值；调整不是必选步骤；切换不影响当前故事位置。

### T5｜测试与视觉验收

覆盖数据、组件、浏览器、五档屏宽；更新原有过宽 tablist 断言；执行类型检查与构建。

完成条件：下节清单通过；如有现有无关失败，单独记录，不假称全部通过。

### T6｜交付审阅

提供本地预览、模块一桌面/手机截图、模块二三个部分截图，以及改动文件和测试结果。

完成条件：展示的是完整可用成果，不是功能目录；没有增加“SEO 每个环节都要改”的暗示。当前仅计划，本轮不实施或发布；未来实施也不自动捆绑发布或提交整个脏工作区。

## 9. 测试与验收

### 内容

- 企业、页面、区域、时间范围、12,400/310/2.5% 在各处一致。
- Prospect 无私有数据与已确认客户事实；Verified 有具体证据。
- 诊断包含五条实际观察，不能被抽象介绍句替换。
- 任务含四个步骤、完成标准及复核说明。
- Client/SEO 表达不同但事实、限制和状态一致。
- 没有“已经实施”“增长来自这次优化”或虚构业绩。
- 页面保留轻量样例标识；不出现重复大型提示。
- 修改能力仅辅助说明，默认可用成果是主体。

### 交互与可访问性

- 首屏两入口正确打开获客/服务故事，旧故事 hash 保持正常。
- 新视图切换的鼠标、键盘、Home/End 和焦点行为正常。
- 当前故事不会因切换 Client/SEO 被重置，URL 不受影响。
- 静态完成清单不可误操作，不存在假保存/导出/发送按钮。
- 无分析、支付、点数或真实报告写入请求；网络检查聚焦业务 mutation，不误伤正常资源请求。
- 页面没有新增高频动画，reduced motion 正常。

### 响应式与阅读

- 320、390、768、1024、1440px；200% 缩放另查。
- 首屏双卡在窄屏变单列；证据记录和任务侧栏顺序自然。
- 正文、来源、日期和状态可读；没有 line-clamp、固定高度裁切、卡内纵滚或全页横向溢出。
- 视图切换不会产生不必要的大幅页面跳动；不为了等高留整屏空白。
- 桌面与手机截图应覆盖完整底部，不能仅凭上半张截图判为通过。

### 回归

- 现有十五个故事、两阶段连续滑动与记忆不变。
- 原有主导航、首屏入口、底部入口与 FAQ 不变。
- 现有 Method/Sample Reports 链接保持工作，不假装完整样例就是本例企业。
- 没有新增付费请求、精细埋点或第三方依赖。

### 执行时验证命令

```bash
npm run typecheck
npm test -- src/components/useCase/client-work-example.test.ts src/components/useCase/ClientWorkPreview.test.tsx src/components/useCase/UseCasesV22.test.tsx src/components/useCase/practice-scenarios.test.ts
npm run test:e2e -- e2e/client-work-preview.spec.ts e2e/use-cases-workbench.spec.ts e2e/marketing-navigation.spec.ts e2e/work-entry.spec.ts
npm test
npm run build
```

上述命令是未来实施的验证要求，本计划编写时未运行产品测试。

## 10. 与旧计划的关系

本文件覆盖 `2026-10-12-client-scenarios-implementation.md` 中首屏报告预览和角色分工的旧方案，不删除旧计划，不追溯重写已实现的故事区。

执行基准：

1. 本文件：这两个模块的内容与实现要求。
2. 当前页面代码：故事区与其他保留区域的行为基线。
3. `docs/website-report-alignment-backlog.md`：能力边界；所见即所得应体现在报告内容和可用程度，不意味着复制不存在的工作台控件。

最终验收问题：**SEO 看完之后，是否已经看见原本需要自己整理的证据、任务和客户说明，而不是只看见产品说自己会提供这些东西？**
