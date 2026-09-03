# SearchTrust v2.2 新入口与预检 UI 设计

日期：2026-09-03
里程碑：V22-040
状态：产品流程、页面方向、接口桥接、失败恢复与验收标准已由用户逐项确认；等待设计文档最终审阅后进入实施计划。
主要仓库：`search-trust`；`SearchTrust-RD` 需要两项受控调整：匿名草稿与正式 Case 的 ID 衔接，以及把正式竞品数量从“恰好 3 个”改为“至少 1 个、最多 3 个”。

## 1. 目标

把当前以单页审计和 Credit 为中心的新建入口，升级为面向 Local SEO 顾问的客户工作入口。用户应能在登录、付款或 Google 授权之前完成一次低摩擦但可核验的公开数据预检，并明确知道：

- 系统识别的是哪一家商家；
- 主要服务、主要地点和目标市场是什么；
- 哪 1—3 个商家会作为正式竞品；
- 哪些公开数据和报告模块可用；
- 哪些数据缺失、受限或尚未连接；
- 后续交付需要多长时间，以及下一步为何需要登录。

本里程碑不输出核心诊断结论、竞争差距优先级或三项行动。预检不是免费报告预览。

## 2. 两种工作目标

入口提供两个互斥目标：

1. `Win a new client`：使用公开数据证明 Local SEO 机会；覆盖预览后登录并进入 $19 的 Prospect Opportunity Report 付款衔接。
2. `Work with an existing client`：先确认客户身份和公开数据基础；覆盖预览后登录、保存 Case 并进入 Connection Center 准备，后续再由用户主动连接 GSC、GBP 和 GA4。

两种目标共享相同的公开数据预检和身份确认，不在入口处维护两套不同的客户事实。

## 3. 已确认的产品流程

采用独立 `/cases/new` 工作台，使用左侧四步导航和右侧主内容区：

1. Goal & website
2. Business match
3. Competitors
4. Coverage

两条路径在 Coverage 之后才分流：

- 获客：登录/注册 → V22-041 Case 级付款 → 创建/确认 Case 与报告任务；
- 现有客户：登录/注册 → 保存 Case → Connection Center 准备。

匿名阶段不得请求 Google OAuth、不得扣费、不得创建归属于某个用户的持久 Case。首页现有 `Run a Trust Audit` 新建入口和相关弹窗触发器统一切换到 `Start free preflight` 并导航至 `/cases/new`。历史报告阅读、PDF 和 v2.1 已有记录保持可用。

## 4. 页面设计

### 4.1 Goal & website

同一屏展示两个工作目标和网站输入：

- `Client website` 必填；接受用户省略协议的输入，提交前规范化并在服务端再次校验；
- `Google Business Profile link` 可选且默认收起；
- 页面明确说明这是公开数据检查，不需要账户、付款或 Google 权限；
- 唯一主动作是 `Run free preflight`。

不继续沿用 v2.1 的 page type、single/multi-location 和 Credit 文案。v2.2 的分析范围由 Case 的业务身份、服务和市场表达。

### 4.2 Business match

预检成功后显示最可能的网站身份和公开 GBP 候选，并把以下字段逐项比较：

- business name；
- phone；
- address；
- service area。

结果使用明确文字而非黑箱总分：

- Exact match；
- Partial match；
- Not matched；
- Missing / error。

一侧有值、另一侧没有值时为 `Not matched`。必需 GBP 信息两侧都没有时为错误或明确缺口，不能显示为匹配。总览可显示最严重的字段级结果，但不能覆盖字段明细。

用户必须明确确认商家，或选择其他候选。正式分析范围同时确认：

- business name；
- operating model：storefront / service area / hybrid；
- primary service；
- primary location；
- target market；
- optional public GBP URL。

候选值可编辑；修改会使依赖旧上下文的竞品发现结果失效。

### 4.3 Competitors

低成本同步预检不会伪造竞品候选。商家、服务和市场确认后，前端提交既有 V22-023 异步竞品发现任务，并显示真实阶段和进度。

成功后最多展示 6 个候选，默认选中排序最高的 3 个；候选不足 3 个时默认选中全部候选。每个候选至少显示：

- business name 与网站；
- 与目标市场的关系；
- query appearance count；
- best position；
- relevance reason；
- confidence；
- public GBP 是否可用。

用户必须明确确认 1—3 个竞品，可从候选中替换或移除。产品继续以 3 个作为推荐目标，但 1 个是不可降低的严格下限。用户补充已知竞品网站时，最多 3 个补充网址，并由后端执行站点与身份安全校验；不能把用户输入直接当成已验证候选。

当只有 1—2 个合格候选时，允许用户继续，但竞品覆盖明确显示为 `Limited`，后续证据、Finding 和文案只能按实际竞品数量陈述，不得写成“三个竞品”或把样本不足伪装成完整市场共识。

当没有任何合格候选时，流程严格阻断。页面要求用户至少提供一个已知竞品网站；后端完成 URL、身份、市场相关性和公开可采集性校验并形成至少一个合格候选后，流程才能继续。用户可以同时修改服务/市场或重试发现。不能提供“跳过竞品”，不能把未验证网址直接计入最低数量，也不能生成替代假数据。

### 4.4 竞品数量合同调整

当前后端以“恰好 3 个”为冻结前提：`AnalyzeRequest`、发现就绪判断、选择校验、`CompetitorCollectionSnapshot`、Evidence 上下文及 `ReportV22.competitor_analysis` 都存在三家基数约束。新的业务规则不能只在前端放宽，必须在 UI 接入前完成一次受控合同修订：

- 正式确认和分析输入改为最少 1 个、最多 3 个唯一竞品；
- `ready_for_confirmation` 在至少 1 个合格候选时为真，0 个时必须携带 blocking gap；
- 选择校验按实际长度验证 ID、规范域名、用户确认和发现候选绑定；
- 竞品采集快照与报告竞品摘要改为 1—3 个，供应商调用预算仍保留现有三家总上限，不随竞品减少而放大；
- 依赖多竞品共识的规则继续执行其原有最低证据门槛；样本不足时不触发该 Finding，并写入可追溯 limitation；
- 所有固定写死 `three/all three/三个竞品` 的确定性陈述、样例、Schema、生成 TypeScript 类型和测试同步改为按实际数量表达；
- 旧的 3 竞品输入仍完全合法，已有三家样例的事实含义不变。

该变更修改了此前冻结的 v2.2 合同，因此必须先在后端设计/计划中列出全部受影响合同并重新导出、双端校验和冻结。不得让前端先放行 1 个竞品，而正式分析仍拒绝。

### 4.5 Coverage

覆盖页是匿名预检的终点。它只显示：

- 规范化商家与市场摘要；
- 模块可用性及原因；
- data gaps、是否阻断和解决方式；
- 已确认竞品数量、推荐数量、最低门槛及竞品发现时效；
- 预计分析时长桶；
- 继续后可获得的交付物。

模块状态使用文字、图标和颜色共同表达，至少包含 Available、Limited、Unavailable/Blocked、Not connected。只有 1—2 个竞品时，竞品模块必须为 `Limited` 并显示实际数量；0 个时为 `Blocked`。页面不得根据前端猜测把若干字段合成为“Strong”覆盖；如需要总体标签，必须由版本化的确定性映射产生并有测试。

以下内容保持锁定：核心问题、机会优先级、竞争差距结论、三项行动和 30/60/90 计划。

获客目标显示 $19 Prospect Opportunity Report 说明和 `Sign in & continue`。现有客户目标显示 `Save client project & prepare connections`。两者都不得在本页发起 OAuth。

## 5. 路由和组件边界

建议新增：

```text
src/app/cases/new/page.tsx
src/components/cases/new-case-workspace.tsx
src/components/cases/new-case-stepper.tsx
src/components/cases/goal-website-step.tsx
src/components/cases/business-match-step.tsx
src/components/cases/competitor-confirmation-step.tsx
src/components/cases/coverage-step.tsx
src/lib/preflight-v22/**
src/app/api/v2/preflight/route.ts
src/app/api/v2/competitors/discover/route.ts
src/app/api/v2/competitors/tasks/[id]/route.ts
src/app/api/v2/competitors/tasks/[id]/retry/route.ts
```

具体拆分可在实施计划中按现有约定调整，但必须保留以下边界：

- 页面组件不持有后端内部令牌；
- Next.js 服务端代理负责调用 `SearchTrust-RD` 的内部 v2 API；
- 请求与响应在服务端和客户端边界都执行严格、版本化校验；
- 预检、竞品发现和 Case 创建各自保持独立错误模型；
- SSE 若在当前部署边界不适合由浏览器直连，可先使用带退避的状态轮询，但恢复依据始终是持久任务状态，不使用模拟进度。

## 6. 匿名草稿与 Case 身份衔接

### 6.1 为什么需要草稿 UUID

既有 V22-023 `CompetitorDiscoveryRequest` 必须包含 `case_id`，发现结果和正式分析也会核对同一个 Case。与此同时，已确认的用户体验要求在 Coverage 之后才登录和创建正式 Case。

采用受控的匿名草稿 UUID 解决这个身份桥接：

1. 新流程开始时生成独立 `draft_case_id`；不得使用可能来自共享预检缓存的 `preflight_id` 代替；
2. 匿名竞品发现以 `draft_case_id` 作为现有内部 `case_id`；
3. 登录后创建正式 Case 时，在可信服务端边界把同一个 UUID 写为 Case 主键；
4. 正式分析继续使用该 UUID，因此竞品发现上下文无需伪造、重绑或复制；
5. UUID 冲突、重复 Case 或身份摘要不一致时停止，不静默覆盖既有 Case。

浏览器可以携带 UUID，但不能决定用户归属、分析权限或后端绑定是否有效。服务端仍需校验登录用户、Case 重复规则、发现任务的输入摘要、候选摘要、时效和竞品集合。

若登录后发现同一用户已有相同域名和地点的 Case，界面提示打开既有 Case；草稿发现结果不能直接冒充该 Case 的发现结果。后续继续分析前，应使用既有 Case ID 重新发现或由独立、严格验证的迁移能力处理。本里程碑不实现静默合并。

### 6.2 草稿保存

匿名草稿只在当前浏览器会话保存经过筛选的非秘密状态：

- schema version；
- created/updated/expiry time；
- work goal；
- draft Case UUID；
- URL 输入；
- preflight ID 和经合同校验的预检结果；
- 用户确认的业务范围；
- discovery job ID、状态摘要和最终候选；
- 用户确认的 1—3 个 competitor IDs。

不保存内部 API token、供应商请求 URL、原始供应商响应、OAuth token 或其他凭据。草稿按 24 小时失效；过期的预检或发现结果不能仅靠修改浏览器时间继续使用，服务端负责最终时效校验。

## 7. 状态与失效规则

工作台使用显式状态机，而不是若干互不约束的表单状态：

```text
goal_website
  -> preflight_running
  -> business_confirmation
  -> competitor_discovery_running
  -> competitor_confirmation
  -> coverage
  -> auth_handoff
```

每个运行状态都有成功、可重试失败、不可重试失败和过期分支。

失效规则：

- 修改网站或 GBP URL：清除预检、业务确认、竞品发现、竞品确认和覆盖；
- 修改商家身份、主服务、主地点或目标市场：保留原始 URL，但清除竞品发现、竞品确认和覆盖；
- 只更换同一有效发现结果中的 1—3 个选择：保留发现结果，重新计算覆盖展示；
- 发现任务超过 24 小时：清除确认资格并要求重新发现；
- 页面刷新：从会话草稿恢复，并向后端重新读取持久任务状态；
- 草稿损坏或版本不兼容：只恢复已安全验证的目标和 URL，从最近可信步骤重新开始。

浏览器后退、刷新和重复点击不得创建重复发现任务。提交使用独立 discovery job UUID 和 Idempotency-Key；同键不同请求必须显示冲突而不是复用错误结果。

## 8. 错误与降级体验

- URL 不安全、不可访问或格式错误：在 URL 字段附近显示稳定、可操作错误；不回显内部地址或解析细节。
- 预检功能关闭：说明 v2.2 preflight 尚不可用，并允许返回首页；不得回退到 v2.1 付费审计冒充同一产品。
- 公开 GBP 未找到或不可靠：允许依据后端 gap 继续，并明确说明 GBP 覆盖受限；不得显示“匹配”。
- 竞品任务排队/运行：显示后端真实阶段；刷新后恢复。
- 竞品发现失败：依据 `retryable` 显示重试或修改输入，不自动无限重试。
- 1—2 个合格候选：允许继续但标记有限覆盖；0 个候选：强制用户补充并验证至少 1 个，否则阻断。
- 会话过期：保留安全输入，重新运行受时效影响的步骤。
- Case 重复：显示既有 Case 入口，不覆盖、合并或篡改归属。
- 网络中断：保留本地草稿并重新读取服务端状态，不把未知状态显示成成功。

所有错误文案必须安全、稳定、可行动。诊断细节通过 request/job/diagnostic UUID 关联服务端日志。

## 9. 安全与隐私

- 浏览器只调用同源 Next.js API；`V22_INTERNAL_API_TOKEN` 仅存在于服务端环境。
- Next.js 代理只转发白名单字段和稳定错误，不透传任意上游正文、响应头或供应商 URL。
- URL 规范化、DNS、重定向与 SSRF 边界继续由后端执行，前端校验不视为安全边界。
- 匿名接口需具备按部署条件配置的速率限制和请求体大小限制；不得将 OAuth 或支付风控混入预检。
- 埋点只记录阶段、结果类别和耗时桶；不记录完整 URL 查询、客户敏感文本、搜索词全集或候选原始资料。
- 草稿数据到期后在读取时删除；退出流程提供清除当前草稿动作。

## 10. 可访问性与响应式

- 工作目标使用真正的 radio 语义；两张卡片均可通过键盘选择。
- 步骤导航具有当前步骤、已完成和不可用语义，移动端收敛为顶部进度而不是完全丢失上下文。
- 匹配、覆盖和任务状态不能只依靠颜色；文字标签始终存在。
- 动态进度与错误使用合适的 live region，避免高频朗读每个百分比。
- 表格在窄屏转换为带字段标签的卡片，不能简单横向裁切关键对比值。
- 所有编辑、替换、重试、返回和继续操作有可见焦点与明确名称。
- 尊重 reduced motion；本流程不依赖装饰动画表达状态。

## 11. 测试与验收

### 11.1 合同与服务端代理

- 预检、竞品发现、状态、重试和 Case 创建请求/响应严格校验；
- 未知字段、错误类型、额外响应字段和不安全 URL 被拒绝；
- 内部令牌只由服务端添加，浏览器和日志中不可见；
- 上游 401/422/409/503 和网络故障映射为稳定同源错误；
- discovery UUID、Idempotency-Key、轮询恢复和过期语义正确；
- draft Case UUID 只在认证后的可信创建边界成为正式 Case ID；
- UUID 冲突、重复 Case 和上下文不匹配不会产生错绑。

### 11.2 状态机与组件

- 两种工作目标都能匿名完成四步；
- URL 与可选 GBP 展开/校验；
- 候选选择、更换和字段编辑；
- Exact、Partial、Not matched、单侧缺失、双侧必需信息缺失；
- 默认最多前三、替换、重复竞品拒绝、1—3 个确认和 0 个阻断；
- 修改上游字段精确清除依赖状态；
- 空候选、1—2 个有限覆盖、补充网址验证以及 blocking/non-blocking gap；
- 任务成功、可重试失败、不可重试失败、过期和刷新恢复；
- Coverage 不显示 finding、action 或内部供应商成本；
- 两种目标在 Coverage 后显示不同衔接动作。

### 11.3 页面级验收

- 桌面和移动视口；
- 键盘操作、焦点顺序、屏幕阅读器标签和非颜色状态；
- 首页所有新建审计入口均进入 `/cases/new`；
- v2.1 历史报告、PDF 和报告列表回归；
- 构建、类型检查、lint、组件/合同测试和关键浏览器流程通过；
- 自动化测试只使用脱敏固定响应和假服务，不调用真实 SerpAPI、Google 或客户网站。

## 12. 本里程碑交付边界

V22-040 包含：

- 新入口与四步工作台；
- 同源预检和竞品任务代理；
- 匿名草稿、状态恢复和受控 Case UUID 衔接基础；
- 后端竞品数量合同从恰好 3 个受控修订为 1—3 个，并重新冻结双端产物；
- 已确认数据的覆盖展示；
- 首页入口切换；
- 自动化测试与可访问性验收。

V22-040 不包含：

- Dodo 实际结账和 webhook 交付，属于 V22-041；
- 完整 v2.2 报告阅读，属于 V22-042；
- PDF 和安全分享，属于 V22-043；
- GSC、GBP、GA4 OAuth 与 Connection Center 实现；
- 启用生产功能开关、真实供应商烟测、推送或部署；
- 伪造完整分析结果，或除已批准的竞品数量基数之外扩大 Report v2.2 输出合同。

## 13. 实施顺序建议

设计获批后编写独立实施计划，并按以下依赖推进：

1. 后端竞品 1—3 基数合同影响清单、受控修订、重新导出和双端冻结；
2. 前端严格合同、服务端代理和匿名草稿状态机；
3. draft Case UUID 的可信创建衔接与回归；
4. 四步页面和错误/加载状态；
5. 首页入口切换；
6. 合同、组件、可访问性与浏览器验收；
7. 在默认关闭生产开关的前提下完成本地全量回归。
