# 首页产品价值与首次体验设计

日期：2026-10-07

## 1. 已确认的方向

面向本地 SEO 顾问与小型机构，让访客能回答：SearchTrust 替我完成什么、我保留什么决定、拿到什么、如何判断是否值得继续使用。

用户已同意四项方向：专业工作对比、产品与 SEO 分工、可核查的报告素材、首次体验指引。本文件将其收敛为可实施的文案、布局和验收约束，等待书面设计确认。

不重做整站风格，不修改计费、生成、报告权限或后端接口，不部署线上。保留当前浅色、导航同款无衬线字体、少分隔线和统一按钮。已有用户改动保持不变。

## 2. 检查结果与事实边界

已检查首页组件、FAQ、样例数据、网站/报告能力差距文档，以及真实报告证据抽屉、行动计划编辑和交付组件。

- 首页首屏、沟通示例、默认判断案例和报告预览重复核心服务页故事。保留其连续性，但不同模块只承担各自任务。
- 官网 `sample-report-data.ts` 明确是虚构案例，无真实客户数据、URL、时间或来源快照。
- `e2e/fixtures/report.ts` 引用合成测试数据；测试通过不等于公开客户成果。
- 在本次检查的官网素材和能力记录中，未确认有满足新版结构且获准公开的真实案例。旧报告、文档片段不能自动视作可发布素材；本次不访问生产客户数据或启动扣点分析。
- 真实 SEO 视图支持检查证据记录、来源定位、采集时间与限制，实际字段以报告可用数据为准。
- 真实工作区支持三个行动的顺序、标题、目标、步骤、完成标准、负责人、时间和复查字段编辑。保存草稿后可审批；原始证据不随编辑改变，改变范围需另行核实。
- 已编辑的草稿必须审批才能进行新的客户交付。不能宣传所有原始报告都强制经过同一审批门禁。
- 整份报告自由改写、自动执行网站修改、自动核实线索质量、完整实施历史与因果归因不是本轮可宣传能力。

相关代码：`src/components/report/v22/{advisor-report-view,delivery-plan-editor,report-v22-actions}.tsx`；差距记录：`docs/website-report-alignment-backlog.md`。

## 3. 方案取舍

采用已确认的“有限增补”：改现有对比，新增一块紧凑分工工作台，用短首次体验区替换泛化结尾。

不采用纯文案润色：仍难区分产品工作与人工工作。

不采用增加大量功能/案例卡片：会拉长页面并重复方法解释，且没有新的真实证明材料。

页面顺序：首屏 → 双入口 → 专业工作对比 → 产品/SEO 分工 → 专业判断 → 报告摘要 → 费用 → FAQ → 首次体验与最终入口。

## 4. 专业工作对比：改现有 ClientConversation

保留 Win the work / Deliver the work 两个阶段的可访问 Tab；不新增交互层级。中间示例文档仍明确为虚构，不表示实际客户反馈。

总标题：`Turn your research into a client decision.`

### 获客阶段

左侧不再以“只会说排名不好”为典型 SEO，而呈现已有专业工作后的难点：

- 标签：`THE WORK STILL TO DO`
- 主句：`You have findings. Which belong in the first proposal?`
- 一句解释：`Site checks and competitor research still need a business scope.`
- 客户要回答的问题：`Which service matters, and what should we tackle first?`

中间保留精简的 Discussion brief：服务与地域范围、具体观察、拟议工作、待确认条件，不新增数值或来源。

右侧三项产物：`A first discussion scope`、`Evidence to review`、`Client questions to resolve`，各配一句短说明。收束为 `Bring a business-specific scope—not the whole audit—to the first conversation.`

### 服务阶段

- 标签：`THE WORK STILL TO DO`
- 主句：`You have performance data. Which recommendation should change?`
- 一句解释：`Search and on-site trends still need to be connected to specific work.`
- 客户要回答的问题：`What should we keep, revise or defer?`

中间文档只示意现有页面的新增依据、拟议行动和复查条件。

右侧三项产物：`A supported next priority`、`Requirements for delivery`、`Checks for the next review`。收束为 `Connect the next decision to the evidence behind it.`

维持“工作难点 → 讨论材料 → 沟通产物”的一体化布局；不再把右侧理解包装为客户已发生的心理变化，也不宣称时间或成交率提升。

## 5. 新增紧凑的产品与 SEO 分工工作台

锚点：`#what-searchtrust-does`。放在沟通价值与专业判断之间。

小标签：`THE PRODUCT / THE PROFESSIONAL`

标题：`A reviewable plan. Not another pile of inputs.`

介绍：`SearchTrust connects available observations, findings and proposed actions in one Case. You check the evidence and decide what becomes the client plan.`

采用一张连续工作台，不做四张等高卡片，不添加另一套 Tab。四行分别展示工作对象、产品提供、SEO 决定：

| 工作对象 | SearchTrust prepares | You decide |
| --- | --- | --- |
| Business context | Website, public business and competitor context for the confirmed scope. | Confirm the business, services, area and relevant competitors. |
| Findings & evidence | Findings linked to available source records and their limitations. | Check the basis and add what only the client can confirm. |
| Proposed actions | Three recommendations with targets, work requirements and review guidance. | Reorder and edit the action plan to fit the engagement. |
| Client delivery | SEO and Client reading views, with PDF and sharing options. | Review the client version; save and approve edited plans before delivery. |

底部一句边界：`Edit the plan, not the source observations. A changed scope needs its own supporting evidence.`

左侧用小型线性图标标识背景/依据/计划/交付；不放平台 Logo 墙或假进度。列标题明确区分系统与人的职责。桌面约 20% / 40% / 40%，窄屏每行按“对象 → 系统 → 人”纵向阅读。使用浅色底、留白和一致对齐，无大量横线。

此处只解释能力，不模拟编辑/审批，不调用报告接口。可复用现有 `/sample-report` 入口，但不新增主转化按钮。

## 6. 报告预览与真实素材

保留刚完成的一页式摘要及两份报告 Tab，不再重排其主要版式。继续使用同一虚构案例，原始限制始终可见。

更新辅助说明，让访客知道能如何检验样例：

`Inspect the finding, its supporting basis and the proposed work. This fictional example demonstrates the report structure—not measured client results.`

完整样例链接仍分别定位 `/sample-report#sample-prospect` 与 `/sample-report#sample-verified`，不启动登录、分析或扣点。

本轮不新增“真实客户案例”模块。未来替换素材前，必须具备：对应当前产品版本的实际运行、可核查的来源/日期/范围、适合公开的材料及必要许可、敏感信息审查。公开网站分析也须注明非合作背书；服务阶段私有数据不能靠虚构补齐。

## 7. 费用与首次体验

费用规则不变：网站与商家确认免费；开始竞品发现及完整售前分析 1 点；生成或重新生成 Verified 计划 1 点；注册赠送 5 个永久点数；技术失败返还 1 点；$19/credit。

用首次体验区替换当前泛化最终 CTA，移到 FAQ 后，使访客在理解限制后得到具体开始路径。

标题：`Try it on a business you already understand.`

介绍：`Use the first report to judge whether the findings are specific, the evidence supports them and the proposed actions are worth discussing.`

三个紧凑编号步骤，桌面横排、手机竖排，不嵌套卡片：

1. `Bring the context` — `Have the website, main service and target area ready. Prospect does not require client analytics access.`
2. `Confirm before analysis` — `Website and business confirmation is free. Starting competitor discovery and the full Prospect analysis uses 1 credit.`
3. `Review the result` — `Check the findings, supporting evidence and three proposed actions before using them with a client.`

主按钮：`Start a Prospect Case`，复用现有行为和跟踪来源；次按钮：`Continue with a client Case` → `/cases/service`。

辅助文案：`5 permanent credits when you join. Choosing an entry does not use a credit.` 服务入口保留先有 Case 的说明，不承诺直接新建服务客户已可用。

FAQ 补两个产品选择问题，替换重复的“两个阶段有什么区别”问题并增加一项，以保持长度：

- `What does SearchTrust prepare, and what do I still review?` 说明组织依据与三项建议，由 SEO 核实业务、修改行动并审核交付，不自动实施网站修改。
- `Can I edit the report before sharing it?` 明确真实工作区编辑行动计划，不是任意重写整份报告；原始证据不变，已编辑草稿保存审批后再交付。

FAQ 展示和 JSON-LD 继续由同一数据源生成。

## 8. 组件边界与范围

- 修改 `ClientConversation.tsx` 和必要的模块 CSS，保持现有 Tab 状态及键盘行为。
- 新增独立的静态职责工作台组件与 CSS；无客户端状态或网络请求。
- 修改 `HomepageV22.tsx` 的组合与最终 CTA，必要时抽出 `FirstCaseGuide` 组件。
- `src/app/page.tsx` 管理 FAQ 与最终入口顺序，避免重复渲染 CTA。
- `ReportOutcomePreview.tsx` 只更新辅助说明；样例来源数据与报告页不改。
- 扩展 `e2e/work-entry.spec.ts`；不修改登录、计费、报告权限、其他页面或环境配置。

## 9. 验收

- 每个模块有独立职责，避免再次重复讲解完整服务页案例。
- 系统产物与人工检查始终同时可见，不把 SEO 自己需要测试的表单、事件或业务材料说成已自动验证。
- 报告仍标虚构，无客户评价、效果数字、实际快照或授权声明的杜撰。
- 首次体验准确说明输入、扣点节点、结果审核目标；既有赠送和购买规则一致。
- 原有两阶段 Tab、三个问题 Tab、报告 Tab、完整样例/方法/价格/工作入口继续可用且可键盘操作。
- 在 1440×900、1024×900 和 390×844 检查顺序、换行、无横向溢出、焦点和按钮。
- 以相同视口和默认 Tab 状态比较页面高度，新增职责区后尽量控制净增长不超过 15%；通过压缩重复文字和旧 CTA 控制，不缩小可读字号或隐藏限制。
- 执行类型检查、相关端到端测试及生产构建，提供本地预览；不部署。

## 10. 流程与自审

- [x] 项目和现有内容检查。
- [x] 用户已确认核心目标和四项改动方向。
- [x] 方案取舍、具体内容、布局与范围落成本文。
- [x] 自审：无未定义实施分支；真实案例不可用时确定保留虚构样例，不阻挡其余文案工作；产品编辑范围与现有代码一致。
- [ ] 用户审阅本文后进入实施计划与代码改动。

无需另开视觉方案比较：沿用已经确认的首页视觉，只改变指定内容和工作台结构。
