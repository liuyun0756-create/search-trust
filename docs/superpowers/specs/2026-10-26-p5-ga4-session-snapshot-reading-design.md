# P5 GA4：已保存的自然搜索会话数对照

状态：2026-10-26 用户已确认书面规格；本地实现与验证完成。默认关闭，未启用或部署。详见同日 `2026-10-26-v22-capability-p5-ga4-session-reading-verification.md` 验收记录。

## 1. 本批目的与已确认边界

让独立 SEO 看见两个等长时间段在采集时返回的自然搜索会话数，了解数值变化，并保留专业判断。只读取已保存的观察，不重新请求 Google，不消耗点数，不修改原报告。

这是新增的“快照数值对照”，不是宣布 GA4 已处理完成，也不是解除原有指标资格限制。旧资格中的 `not_comparable` 和旧审计的 `comparisons_available=false` 保持原样；它们属于原规则，不能被本次展示覆盖。新的输出使用独立版本和状态，不写回旧证据。

用户已确认：

- 仅开放 sessions 的前期数值、后期数值、数量差、相对变化。
- 数据缺失、采样、截断或相关限制存在时，不展示差值，解释原因。
- 标明采集时间、数据可能修订；不判断改善、实施成效、统计显著性或因果。
- 关键事件、互动会话、互动率、关键事件率继续保持限制。
- 不新增权限，不新增采集，不扣点，不修改旧报告、PDF 或分享内容。

## 2. 方案选择

1. **采用：独立、只读的会话数快照展示。** 可以提供实用数据，且与原资格、人工检查和付费报告隔离；需要清楚解释“数值对照”和“效果判断”的差别。
2. 延后：同时开放全部 GA4 指标并补齐历史配置。范围更大，现有权限无法证明完整历史，更不能保证处理终结。
3. 不采用：继续隐藏全部数值。最保守，但不能帮助 SEO 阅读已经保存的数据。

本批不包含真实指标校准，也不宣称 P5 或整个产品已完成。

## 3. 数据入口与不变性

唯一输入为当前用户有权访问的、成功完成的 GA4 collection。绑定用户、Case、报告、交付版本、collection、实施记录版本与 checksum、action、scope、windows，以及原 observation checksum。

服务端从现有存储读取和验证完整 collection，不接收浏览器提交的计数、资格、范围或人工解锁指令。按 collection 当时绑定的实施版本解释历史数据，不把历史记录套用到最新实施版本。

仅接受包含六组截断元数据的 exact observation v2。v1 仍可查看原审计，但本功能返回“旧记录未保存所需截断信息”，不推断无截断、不回填元数据、不自动补采集。

原 observation、qualification、审计和 checksum 不变。新展示是可重算的纯投影，不新增数据库表或迁移，不保存一份可被误认为新源数据的副本。

## 4. 展示资格

必须同时满足以下条件，否则返回有限的原因代码和解释，不返回计数或差值：

1. 已完成存储记录通过现有结构、绑定和完整性校验；畸形或绑定错误是读取错误，不降级为合法证据。
2. v2 截断检查完整且有效；未知截断原因也保守阻止对应视图。
3. 前后使用相同 property、确认的网站 hosts、property timezone、Organic Search 过滤条件及可选的精确 landing path。
4. 沿用原窗口规划：7、14、28 或 90 个当地日，两段等长，排除实施日期覆盖的当地日；在实际开始采集时，后期窗口已结束。不能用今天的日期替旧采集补上资格。
5. 前后 totals 均恰好有一行；dates 包含每一个请求日期，没有缺失、重复或越界。
6. 两段的 totals 与 dates 均没有采样、阈值处理标志、other-row 数据损失、provider empty reason、行数截断或截断原因；sessions 没有指标限制。

日期行缺失不是零；不做零填充。完整日期行也不证明 GA4 已最终处理完成。

key_events 视图独有的限制或配置变化不单独阻止 sessions 展示；但整份快照若结构无效，仍拒绝读取。其他指标的限制不能被泛化成 sessions 限制，sessions 的限制也不能被忽略。

没有人工“确认后强制展示”选项。SEO 检查保留在原位置，不作为算法输入，也不证明历史测量设置没有变化。

## 5. 计算与输出契约

独立输出版本：`v22_ga4_session_snapshot_reading_v1`。提供 `available` 或 `withheld` 状态，不使用 `comparable` 作为新状态。

- 输出绑定信息、原观察 checksum、scope、windows、采集起止时间。
- 计数取各时段 **totals 中的 sessions**，不将每日数据相加代替总数。
- `difference = after - before`，使用整数精确计算。
- 前期大于零：`relative_change_percent = difference / before * 100`；后端十进制定点计算，四舍五入到两位小数，以十进制字符串传输，避免浮点大数误差；零统一为 `0.00`。
- 前期等于零：百分比为 null，显示 `Not calculated: the before count is zero.`；数量差仍显示，不使用无穷大或虚构百分比。
- `withheld` 时四个数值字段均为 null，原因列表非空；不将 null 显示成 0。
- 固定保留 `processing_completeness=not_attested`、`measurement_history=unverified`、`effect=null`、`causal_attribution=false`。输出不含显著性或置信度评分。
- 每次读取同一观察得到相同业务投影；不加入当前时间、最新人工检查或当前配置作为推导依据。

## 6. 接口与访问控制

后端新增独立只读服务及内部受认证接口，复用 collection 所有权读取规则。前端新增登录用户 GET 入口，将路由绑定与服务端身份转交内部接口；浏览器不得指定 user_id。内部采用 POST 传递绑定参数也必须保持纯读取语义。

前后端使用独立默认关闭的 `V22_GA4_SESSION_SNAPSHOT_READING_ENABLED`，并同时受现有 GA4/实施入口开关约束。前端不暴露内部密钥。关闭时隐藏入口并返回 404，不能只隐藏按钮。

身份或报告绑定不符返回不可用/不存在，不泄漏其他用户记录。输入、响应有明确大小上限，UUID、枚举、数值和绑定关系严格校验。响应 `private, no-store`，不共享缓存。失败只允许重试读取，不触发采集、队列、人工检查保存、报告生成或扣费。

授权复用前须验证已归档或已失效的 Case 行为符合现有访问策略，不能因为持有 collection ID 绕过访问限制。已撤销 Google 权限不触发实时验证或自动重新授权；读取历史证据仍由当前 Case/报告访问权限控制。

## 7. SEO 页面内容与交互

在成功 collection 的原资格说明旁新增按需入口，默认不为所有历史记录请求新数据。不调整营销页。

入口：`View saved session counts`

标题：`Organic-search sessions · saved snapshot`

说明：`Counts returned during this collection. They may change as GA4 processes data. This is not a measure of the effect of your work.`

展示顺序：

1. 来源范围：property、website、landing path 或全部落地页、Organic Search、时区和采集时间。
2. 两段明确日期：`Before`、`After`，分别显示 sessions。
3. 中性结果：`Count difference`、`Relative change`；数值带正负号，但不用绿色提升、红色退步、成功或失败评价。
4. 固定限制：`Processing finality and historical measurement settings are not verified. Engagement and key-event comparisons remain unavailable.`
5. 原审计及 SEO 检查仍独立可访问，不混入数值卡片。

旧成功状态文案改为 `Collected · review limitations`。原资格区域标为 `Original metric qualification`，说明 `Finalized performance comparisons remain unavailable. Saved session counts, when eligible, are shown separately.`，避免一边显示差值、一边说一切数值对照都不存在。

阻止展示时用明确原因，例如 `Some requested dates were not returned. Missing rows are not treated as zero.` 或 `This older observation does not include the required truncation metadata.`。不得向用户显示原始异常或 provider 自由文本。

加载、不可用、受限与可展示四种界面状态独立；切换记录时清除旧结果并取消旧请求，防止来源串位。键盘可操作，状态可被读屏感知，窄屏纵向排列，长路径换行，不增加自动滚动。

## 8. 验收范围与实施顺序

本节是书面设计的验收约束，审核通过后再细化实施清单；writing-plans 技能当前不可用，沿用项目现有清单格式。

1. 保存当前工作基线，只修改相关文件。
2. 实现纯投影及严格契约；覆盖 v1、v2、畸形快照、范围错配、未结束窗口、DST、缺失日期、采样、阈值、截断、未知原因及 sessions 限制。
3. 测试前后上升/下降/不变、双零、前零后非零、最大允许整数、比例舍入；断言 totals 来源、不以每日求和替代。
4. 实现 owner-bound 只读接口及前端转发；覆盖未登录、跨用户/Case/报告/交付版本、失败 collection、归档策略、响应大小、默认关闭及上游异常。
5. 加入页面入口与展示；覆盖零基数、受限解释、异步串位、重复读取、键盘和手机布局。
6. 重跑原资格、旧 checksum、人工检查、GSC、报告输出和扣费回归；证明 Google provider、队列和信用账本没有写入调用。
7. 执行受影响及完整测试、类型检查、构建、隔离数据库验证和浏览器检查，记录实际结果，不把模拟数据验证写成生产验收。

不对真实客户数据调用 Google，不启用开关，不执行生产迁移或部署。诊断正常交付但没有足够依据提出行动时，仍消耗 1 点且不返还；本次免费快照读取不改变这条规则。

## 9. 依据与自审

- [GA4 数据新鲜度](https://support.google.com/analytics/answer/11198161?hl=en)：处理时间不能作为最终性保证；不采用等待 48 小时或两次读取一致来证明完整。
- [Data API ResponseMetaData](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/ResponseMetaData)：按返回的限制元数据保守处理。
- [Data API 指标定义](https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema)：sessions 与涉及关键事件的互动指标分开处理。

已对照本地 `ga4_comparison_models.py`、`ga4_evidence_audit.py`、`ga4_evidence_review.py`、窗口规划和现有前端入口核查边界。自审通过：没有人工解锁、处理终结保证、虚构效果或新增采集；新输出与旧资格独立；缺失数据不填零；本批不承担付费复核报告接入、真实校准、生产发布。

设计流程检查：上下文调查完成；方案比较、产品方向与书面规格已确认；无新的视觉方向决策；书面规格与自审完成；本地代码实施及验证完成。真实指标校准和部署验收仍未进行。
