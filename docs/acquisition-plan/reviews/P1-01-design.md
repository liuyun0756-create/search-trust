# P1-01 设计说明：模块 A「目标词现状」

日期：2026-11-12。**状态：待验收人确认，仅设计，未实施。** 依据 PLAN 第 1.2 节、P1-01 任务卡与规格 3.A；下文新增入口、字段、版本、阈值及成本开关均是提案，不视为已批准。正文为审阅摘要；附录保留成本、六站核对和验收细节。本轮只提交本文件，不改 PLAN、实现代码、SQL、规则或冻结文件；不采集、不扣费、不部署。

## 审阅摘要

| 必答项 | 拟议设计与必须确认的边界 |
| --- | --- |
| 数据与成本 | 复用同次已确认 discovery 的 SERP；当前每词 **2 次**请求：Google Maps 一次、Google Search 一次，后者同时含 Local Pack 和 organic。展示已有数据增加 **0 次**；满足完整自然前20可能每词再需1次分页，必须独立开关、默认关闭，批准后才实施。见附录 A。 |
| 目标词入口 | **第2步确认商家/服务/市场时编辑3–5词，在收费竞品发现前确认**。coverage / planning 回显并锁住本 workflow 的词表；不在已收费 workflow 中静默换词。复用 append-only `case_planning_settings`，新增 v2 settings，不给 client_cases 增加第二份词表。见附录 B。 |
| 位置与身份 | Organic 按确认网站域名；Map Pack 取 **Google Search 的 local_pack**、绑定 P1-05 已确认 GBP 分支；Google Maps 单列为参考，不冒充 Map Pack。只显示已验证位置；覆盖不足、身份不明、失败均为未检查。见附录 C。 |
| 可见度推断 | 建议按渠道分别算“已检查词中的样本命中比例”，至少2个不同词有合格数据才分强/中/弱；不混合 Maps / Local Pack，不把未知当0，不做全市场曝光推断。比例与阈值待 D3 确认。 |
| 合约与历史 | 提议新 **public v14 / report 2.2.9 / manifest v4**，新增结构化 `keyword_visibility`；旧 v1–v13 走原路径、字段缺省不序列化，已存报告不更新，历史重放逐字节不变。见附录 D。 |
| 客户/顾问 | 客户仅看词、结果类型、观测位置/中性缺口、日期及有依据的推断；坐标、语言、设备、rank_source、内部标识、错误码与覆盖审计只在顾问技术区。 |
| 六站与人工答案 | 拟以各站已冻结3词为候选，不按排名挑选词；负责人确认后才作为 P1-01 目标集。六站 Local Pack 都不足以断言位置；自然结果仅 PR 首词有域名位置3，其余未命中不能直接写前20未出现。见附录 E；不填或改 truth.json。 |

## 附录 A：已采到什么、可复用范围和成本

### A1. 代码已确认的现状

- `SearchTrust-RD/app/collectors/serp_market_requests.py`：3–5词，每词按顺序规划 `google_maps(type=search)` 与 `google`；后者代码带 `num=20`。当前预算最多10个逻辑请求，每请求最多3次 provider attempts；**计划模型明确禁止 start 分页**。
- `serp_market_models.py`：记录 query、maps/local_pack/organic、position、rank_source（provider_position / response_order）、URL/domain、CID/place_id/data_id、电话、地址、来源 checksum、时点和采样条件；每词每类型最多保留20条。`run.complete` 只代表两次调用都 succeeded，**不代表前20覆盖完整**。
- 刚修的 `serp_market.py` 缓存解析版本为 **serp_market_v3**：支持 local_results 的 list / dict.places；Local Pack 网址按 `website → links.website → link → links.link` 取首个安全值；sanitizer 只保留受限 links.website/link。无 URL 的 Local Pack 仍记录 limitation。它已通过解析夹具测试，不等于旧快照丢失的 links 已恢复，也不等于真实采集已验证。
- 当前 sanitizer 没有保存完整分页/结束、窗口覆盖和所有广告审计元数据；不能仅靠返回条数、HTTP成功或请求num参数证明“前20均已检查”。新设计不对旧快照补造此元数据。
- `market_observations.py` 当前只对 maps / organic 的域名命中产生位置事实；没有 Local Pack 位置模块。P1-01 不能把现有 maps 事实改名当作 Map Pack。
- 当前合约最高为v13 / 2.2.8，但普通旧身份入口的 `PUBLIC_RULESET` 仍为v12，身份v2路径才用v13；不能只替换一个全局常量就宣称所有入口完成升级。

### A2. 复用规则

复用既有 discovery 的已确认 snapshot_id / checksum，且词表、顺序、Case、经营身份、目标市场、实际采样点、语言/设备和时点资格一致；不为展示再调API。新 discovery 缓存使用当前解析版本；历史按 snapshot_id 的固定读取保持原样，绝不重解析后覆盖原快照。

现有缓存 digest 包括 **case_id、business_identity、primary_service、整个 market_context（含有序词表）**，TTL 默认86400秒。它不是可按任意单词跨Case复用的缓存。3词改5词、换顺序或换市场可能导致整组 miss；不能承诺“只多采新增2词”。同一任务已有请求 checkpoint 才能沿现有幂等恢复。离线历史重判按 P1-05 的 evidence_as_of 语义使用原样本，不能刷新日期冒充实时数据。

### A3. 方案与费用（仅估算，未授权采集）

- **方案 A，复用优先**：已有同范围样本增加0次；新目标集在正常获客中仍是2N次，N=3–5。覆盖不足保留未检查。成本最低，但现有自然样本多数不足20，无法保证得到前20缺席结论。
- **方案 B，建议确认后采用**：复用首轮2N次，再允许每词**最多1次** Google Search 第二页，单点合计最多3N次。只在前20尚未覆盖时补齐；预算耗尽或分页不足仍未检查，不继续无界翻页。Local Pack 只使用第一页，第二页不与其合并排名。新增付费行为独立默认关闭，拟名 `V22_TARGET_KEYWORD_TOP20_ENABLED=false`。这是额外采集协议，需 D2 批准，不因确认设计而自动开启。
- **方案 C，多点位/网格**：成本按采样点数增长，超出本任务建议范围；不实施。单点结果不能声称多点位覆盖。

新目标词编辑/模块本身拟放在 `V22_TARGET_KEYWORDS_ENABLED=false` 后，新增分页另有上述独立开关；二者均默认关闭，旧入口继续原3词行为。相对当前全新3词报告的6次搜索，选4/5词首轮分别多2/4次，按$0.015折算多$0.030/$0.060；若原3词整组本可命中缓存，换词后则可能完整新增8/10次，不能只按差额预算。覆盖任何新增外部调用的开关、上限和费用须一起确认。

SerpAPI 官方于核对日列 Developer $75/5000 searches，即折算 **$0.015/search**；另用 Starter $25/1000 的 **$0.025/search** 作保守估算。这里是套餐摊销，不是本账户的实际结算单价或额外收费金额。成功/缓存/失败是否计费以供应商账单为准；内部请求次数与账单单位分别记，未配置价格保持unknown。[官方价格及计费口径](https://serpapi.com/pricing)。

| 场景，单点 | N=3 | N=4 | N=5 |
| --- | ---: | ---: | ---: |
| 现有结果纯复用：增加调用/估算费用 | 0 / $0 | 0 / $0 | 0 / $0 |
| 新词组首轮，现有2N次，按$0.015估算 | 6 / $0.090 | 8 / $0.120 | 10 / $0.150 |
| B方案新增，最多N次分页，按$0.015估算 | 3 / $0.045 | 4 / $0.060 | 5 / $0.075 |
| B方案搜索总计，最多3N次，按$0.015估算 | 9 / $0.135 | 12 / $0.180 | 15 / $0.225 |
| B方案总计，按$0.025保守估算 | $0.225 | $0.300 | $0.375 |
| 若每请求均达3次尝试：总attempts / 按$0.025预算压力值 | 27 / $0.675 | 36 / $0.900 | 45 / $1.125 |

最后一行仅是尝试全部按付费单位计的保守预算压力值，**不是断言失败重试实际收费**。需分别设逻辑/尝试/美元预算，不能改开关而不改限额。当前10次逻辑/30次尝试模型无法承载B方案的15/45，必须只给新版本建立独立预算与测试，不放宽旧版本。

以上只计目标词搜索；沿用的GBP详情、竞品详情/评论、地点解析不是“新增每词成本”，仍进原报告台账。若目标点已有经纬度，不增加地点解析请求；不得因此打开 P1-05 额外身份查找。目标词模块额外 **Firecrawl=0、LLM=0**；建议词只用已有数据和模板。本轮实际新增 provider调用=0、实际消费=0。

官方分页说明明确 Google Search 不再因num参数返回更多条，每次最多10条，下一页使用start=10；本地保存的自然结果也确为5–10条。不能把代码num=20当覆盖证明。[SerpAPI 官方分页说明](https://serpapi.com/blog/filtering-google-search-and-google-news-results/)。第二页 position 可能是页内序号，必须用已验证offset生成窗口位置并保存换算依据，不能把第二页position=1当总排名1。

## 附录 B：目标词来源、入口和保存

1. 第2步业务确认区增加英文 `Target keywords (3–5)`，SEO逐词编辑/排序并显式确认。草稿允许尚未完成；收费启动要求3–5个非空、去首尾空白、大小写去重、每词≤300字符，保留SEO确认的实际拼写，不在后台自动加城市或改写near me。确认商家保存Case后，在收费前保存词表；加载/保存失败明确提示并可重试，不重复静默守卫问题。
2. 建议优先级：已保存SEO词表 → 已确认 primary_service + target_market 的确定性模板 → 已匹配GBP类别、已有页面 title/H1 中明确服务短语作候选。GBP类别只表示类别，不证明搜索需求；Home/Legal等通用标题不作服务词。已保存且同市场的SERP可辅助后续建议，但不能根据“该词排名好”自动替换。首份报告没有历史SERP时不用它，也不为建议新增搜索、Firecrawl或LLM。所有建议标“待SEO确认”，附来源，不宣称搜索量。
3. **不新增 client_cases 顶层目标词列**。提议扩展现有append-only `case_planning_settings.settings` 为 `v22_planning_settings_v2`，保留原字段，新增 `target_keywords=[{query, origin:seo|system_accepted, suggestion_refs}]` 与确认记录。确认人/时间来自服务端。复用Case/revision主键、RLS、所有权、expected_revision和幂等；旧v1设置继续可读，不批量回填猜词。
4. query文本列表是唯一实际采集输入；discovery冻结该词表的digest及来源planning revision。生成时校验与已确认discovery的词表完全一致；coverage只能回显。其他planning设置可保存新revision，但查询digest必须一致。改词留给下一次新workflow，明确成本，不在原扣费流程自动重采。
5. 本地草稿版本拟从 `2.2-new-case-v2` 升为v3，保存编辑中的词与确认引用；旧运行中草稿保留已提交查询/原规则路径，不凭默认模板给它补一份新词表，也不丢弃其幂等键或已保留点数。尚未收费的旧草稿可显式重新确认词表。

## 附录 C：位置、缺口与可见度判定

### C1. 各结果类型与身份

| 类型 | 拟取值/身份依据 | 不允许的替代 |
| --- | --- | --- |
| Organic | 确认的site_url规范域名（沿用现有host：小写、去www）；同一词/同窗口多个页面取最佳已验证位置，并保留全部命中引用 | 不凭商家名、竞品页提及、任意子域或重定向猜归属；额外域名/别名需另确认 |
| Map Pack | **engine=google 的 local_pack**。先复用 P1-05 的域名/电话正向门槛确认客户GBP，再按已选CID/place_id/data_id的明确映射定位同一分支；无ID时，仅已验证域名/电话且唯一归属该分支才可匹配 | 不把google_maps结果标成Map Pack；不凭名称相似跨分支合并；Seamless不因品牌名异于域名排除；Volcanoes不因短链只有地址就认定 |
| Google Maps参考 | 原maps样本按同一已确认GBP分支匹配；独立结果类型与位置，客户扩展行或顾问区单列，待D1定展示位置 | 不用Maps的2/2/1填Map Pack；不跨类型取最小名次 |

D/P用来确认“哪个是客户GBP”，不意味着所有共享域名/电话的分支都是所选分支；多分支无选择或ID冲突时未检查。GBP未确认不阻止独立Organic域名检查。身份匹配只用已保存证据，不自动发付费补查。

位置来自已验证记录的整型position和rank_source，不解析finding文案中的数字。provider_position作为供应商名次；response_order只能称“返回样本中的位置”，保留不同依据、不混算绝对排名。新增分页的global_position需保存page_offset与page_position，确定性换算并去重。位置证据须进入专用模块证据引用，不依赖每卡20条裁剪后再从文案回补。缺引用只降级该行，不让展示逻辑否决整份报告。

### C2. 行状态与文案

- **observed**：目标匹配且位置、查询/渠道/身份绑定及来源调用均可验证。只说明该样本观测到的位置；有正向命中但窗口未完整时仍可展示该已知位置，另记coverage incomplete。
- **not_detected**：渠道已有效检查、身份可判、覆盖审计无影响判定的丢项，目标未匹配。只有Organic / Google Maps **前20窗口已证明完整**时，客户用“采样中未出现在前20”（英文拟为 `Not observed in the sampled top 20 results.`），不是“没有排名”或“>20的确定排名”。
- **not_checked**：未请求/开关关闭、失败、schema不合法、Local Pack缺段、URL/身份不足、分页/覆盖不完整、位置来源矛盾、样本不相关/不本地等；position=null，不能当0、21或不存在。
- Map Pack只展示实际返回的包内位置；包中未出现可说“本次地图包样本中未观察到”，**没有Map Pack前20这一偷换**。段未返回且无法证明页面确实没有地图包时，用未检查，不推断业务不在其中。广告与非自然记录不得混进organic/包内名次，缺少区分证据不能猜。
- 请求成功、run.complete、返回20条、请求num=20，均不能单独证明完整覆盖。需要起止窗口/分页、有效条目、解析丢弃情况与身份归属审计；现有source只有部分元数据时，宁可未检查。
- 保留P1-00的query relevance与locality准入，不因新增模块放宽外地near-me样本。相同输入反复生成输出一致。

### C3. 可见度计算（提案，D3待裁定）

每个渠道单独计算、只针对同一确认采样点与时点范围，不输出一个混合Maps/Local Pack/Organic的总分。设 **K** 为有完整、可归属、相关且位置依据合格的不同目标词数，**H** 为其中目标在规定窗口出现的词数：Local Pack=实际地图包；Organic=前20。`sample_presence_ratio=H/K`。同词多页、多条、多个结果类型不能凑成“2个词”。

- K<2：`assessment=not_assessed`，ratio=null，客户“未评估”。
- K≥2：建议ratio≥2/3为strong；1/3≤ratio<2/3为medium；ratio<1/3为weak。展示“本次已核对K/N词的样本”，不隐去未检查词，不把单点推广到整个城市或多点位。
- response_order、部分窗口和身份未确认的行可显示有限位置事实，但不进入此分级的K；不把未知当0。
- K的负向样本资格必须来自**已确认的检查覆盖事实及可核对匹配计数**，不能把现有not_detected/low finding升级为confirmed依据。推断引用合格窗口的coverage及match证据，原finding状态不改；若不能证明这些事实，排除该词。负责人需确认这种分母口径；不能满足“只有confirmed事实可作推断依据”时维持未评估。
- 这是“样本命中覆盖”而非点击率、流量或排名原因；排名1与20在本提案中均算命中，明示其局限。若负责人要求排名加权评分，需要另定权重，不擅自选择。

## 附录 D：报告、版本及兼容范围

提议只为新生成的获客报告增加 `keyword_visibility` 模块；**不把它自动变成行动或修改现有finding的触发/优先级**。模块包含：

- `schema_version=keyword_visibility_v1`；已确认目标词及query_set_ref（Case、planning revision、digest）。
- 每词独立 `local_pack` / `organic` 结果；Maps参考独立字段，不能共用rank。每项有state、可空position、rank_basis、identity_ref、evidence_refs、sample_ref、checked_window与coverage_reason。技术字段保留在顾问投影，客户使用专用白名单投影。
- 渠道级 `assessment`（inference）、K/H/N、可空ratio、rule_version与evidence_refs；未评估给中性理由。
- 顾问 `sampling`：来源snapshot/checksum、时间、坐标、语言、设备、实际请求窗口、分页/裁剪/身份/质量审计。客户只显示日期/明确的样本范围，不泄漏内部元数据。

**新版本提案**：public ruleset **v14**、report **2.2.9**、manifest **v4**，保留P1-05的identity v2及营业地/目标市场拆分；manifest新增query_set_ref并纳入新输入checksum。旧版本不接受新字段，序列化不补null或空数组，旧历史执行分支原样保留。若选择方案B，新增 `serp_rank_window` 来源及 `keyword_rank_window_snapshot_v1`，保存受限分页/窗口审计、第二页结果和首轮不可变引用；不修改原serp_market_snapshot_v1。新的source与预算只进v14/v4，旧快照/schema/checksum不改。该新增来源方案也须D4确认。

v14只由新入口显式确认的目标词集启用；开关关闭或恢复旧workflow时仍走原v12/v13。此版本提案用于本次新增输入/报告合约，不撤销此前在v12/v13内完成零行动呈现变更的裁定；历史不变性的基线是本轮开始前的已确认代码与冻结输出。

实施时需要的范围（本轮**不修改**）：

1. Python能力报告/manifest/来源枚举、生成/身份重判dispatch、规则版本集合与专用模块生成；v14新增，不修改v12/v13计算。新增推断分类必须登记；纯位置事实不得进入select_public_action_skeletons。历史zero-action摘要与finding顺序不能顺手改。
2. 前后端合约导出、TS schema白名单、校验/投影、网页/分享/PDF专用模块；旧报告缺模块时保持原布局，不凭旧finding拼出模块。
3. 新迁移：planning v2严格校验与读写；manifest/ruleset/source白名单、store与candidate_pool/report版本映射；身份重判/批准/交付/分享/首次服务与 `get_v22_completed_plan_source` 等消费者的版本兼容。既有函数改动沿用 `pg_get_functiondef + replace`、目标缺失raise。不改freeze计算逻辑来做性能优化。
4. 现有identityReviewAvailable只认v13；新v14应显式允许新身份合约，同时继续拒绝v12及以前。新报告身份重判保留已冻结词表，不能悄悄换词或采集；旧v13重判仍走原v13，不自动升级。首次服务旧规则链保持原结果，新增报告转入服务的映射需兼容测试。
5. 已批准交付与分享/PDF固定原版本；新报告仍须另行审核批准。历史新字段缺省不序列化；冻结输入、recipe、报告和truth文件逐字节保护。

## 附录 E：六站目标词候选与预期（不是新人工答案）

以下**按已冻结SERP实际顺序**只读提取，建议负责人确认后作为首批3词；第4/5词须负责人另给，不能依据当前排名挑词。`—`表示没有域名命中，**不是“前20未出现”**。Maps数字只是规范域名命中的原始候选，尚不是P1-05所选分支复核后的Map Pack答案。

| 站点 / 已确认经营模式 | 拟沿用的3词（依次） | 已保存Maps域名位置候选（依次） | Organic现有可复核正向位置 / 缺口 |
| --- | --- | --- | --- |
| Nova / service_area | Plumbing repair Fresno；best Plumbing repair Fresno；Plumbing repair near me | 5；8；5 | 三词均无域名命中；各返回9/10/5条，不能判前20缺席 |
| PR / hybrid | Plumbing repair Fresno；Plumbing repair near me；best Plumbing repair Fresno | 1；1；1 | 第一词域名位置3；其余无命中；各9/10/9条 |
| All Star / service_area | Plumbing repair Fresno；Plumbing repair near me；best Plumbing repair Fresno | —；—；— | 无命中；各9/10/9条。不得用67cb的Plumbing Services三词/另一时点Maps 2/2/1代替这份Plumbing repair基线 |
| Vision-Tech / service_area | AV installation Swansea；audio visual company Swansea；commercial AV integration Swansea | —；—；5 | 无命中；各10/10/10条；营业地Llanelli不取代目标市场Swansea |
| Seamless / service_area | gutter installation Pensacola；seamless gutters Pensacola；gutter installation near me | 18；11；— | 无命中；各9/9/8条；GBP为Gutter Solutions & Home Improvements，不能要求品牌名等于域名 |
| Volcanoes / meeting_point | volcano tours Big Island；guided volcano hike Hawaii；Hawaii Volcanoes National Park tour | —；1；— | 无命中；各8/10/10条；沿用裁定Hilo采样点，不把集合点当经营地址或新搜索点 |

六站Local Pack都为0条；Nova和其余五站对应旧保存样本均有缺段/section invalid等历史缺口，**预期模块显示未检查，而不是全站没排名**。Volcanoes第三词没有该invalid标签，也不因此把0条升级为完整已检查。

只复用这些冻结样本时：PR第一词Organic可输出已验证域名位置3；其余Organic负向结论覆盖不足，仍未检查；每站合格不同词K不足2，Local Pack与Organic可见度均预期“未评估”。Maps候选是否属于所选分支需另核对，不能拿它填Map Pack或凑该渠道的K。

人工标注由负责人/验收人完成：确认最终目标词/排序、确认GBP分支及允许的域名别名、逐词逐渠道核对位置/未检测/未检查和窗口资格、批准阈值后确认预期分级。使用**独立P1-01标注覆盖文件**（精确词+渠道+snapshot_ref+target），评估显式指定才计分；不改6个truth.json，不用系统当前输出当人工答案。缺完整前20/Local Pack证据的真实答案留未知；用合成夹具覆盖完整窗口验收，不假造真实排名，也不申请本轮付费补齐。

## 附录 F：客户/顾问投影与拟验收

客户网页、分享页和PDF同用白名单展示：目标词、清晰区分的渠道、可验证的位置/“采样中未出现在前20”/“未检查”、日期、覆盖词数和满足条件的推断。所有客户UI为英文；中文是本设计说明中的口径。若使用response_order，只说返回样本位置，不把技术枚举直接给客户。

顾问技术区才出现坐标、语言、设备、地图缩放、rank_source、窗口offset、CID/内部ID、规则版本、snapshot/checksum、payload路径和错误码；沿用P0-01的网页/分享/PDF清理，新增结构化模块不得绕过reader净化。事实不可用不阻止其他模块或整个报告生成；不生成“重搜一次”行动。

确认后实施的自动化验收计划（**本轮尚未运行这些产品测试**）：

- 3/5词输入、空白/重复/超长、确认前后词表一致、刷新/旧草稿、revision冲突、加载失败重试；coverage改词不能默默重采或使用旧discovery。
- Local Pack平铺/嵌套网址、缺URL但明确同分支ID、身份冲突/多分支、Maps不得充当Map Pack；Seamless/Vision-Tech/Volcanoes沿P1-05保存证据回归。
- provider_position / response_order、第二页页内位置换算、重复结果/缺页/失败/parse丢弃/外地near-me；仅完整前20允许负向文案。
- K=0/1/2、N=3/5、阈值边界、未知不记0、同词不得跨渠道凑数量、无confirmed依据不推断；与旧finding/行动状态隔离。
- 同一数据的客户网页/分享/PDF净化；顾问保留完整技术信息。证据被展示上限裁剪时模块降级，不抛错、不解析文案取数字。
- 全部现有历史黄金/字节回归（包括现有v1–v11的32份基线），新增v12/v13冻结前后逐字节断言；旧批准版本、分享、PDF和身份重判继续可用。
- 本地数据库真实freeze/store/candidate_pool及全部版本消费者；导出检查、前后端测试/类型检查；无网络6站重放含原营业时间覆盖，旧基线不变，新模块用单独人工覆盖计分。
- provider mocks证明纯展示新增0调用；B方案开关关闭0额外、打开最多N次分页、预算/重试/checkpoint缓存幂等；没有价格时费用unknown。

本轮已做的验证仅为读取代码/迁移/官方文档、只读解析6站冻结查询与结果计数、核对待提交文件范围；没有声称已通过上述尚未实施的测试。

## 待决问题（未答复前不实现）

| ID | 请负责人/验收人裁定 | 建议及影响 |
| --- | --- | --- |
| **D1** | Map Pack是否严格指Google Search地图包？“前20”验收是否只适用于Organic/独立Maps窗口？Maps参考是否也给客户看？ | 建议严格区分；主表Map Pack+Organic，Maps独立参考，不允许改名偷换。包内未出现使用包内文案，不能说前20。 |
| **D2** | 是否把最多每词1次的自然结果分页纳入P1-01？是否批准新版本15逻辑/45尝试的预算上限方案？ | 建议方案B设计，默认关闭、另行批准采集；当前只复用仍可先显示已知位置与未检查。未完整窗口不承诺前20结论。费用见A3，余额0，本轮不采集。 |
| **D3** | “2词有数据”的K是否接受已确认完整覆盖且匹配计数为0的样本？是否采用H/K与2/3、1/3阈值、单点渠道独立分级？ | 建议采用可核对覆盖事实，不引用弱finding作依据；承认排名1/20同算命中的局限。若不批准该分母或阈值，保持未评估，不自行发明加权分数/多点规则。 |
| **D4** | 是否批准入口在第2步、planning v2持久化、coverage锁定，以及v14/2.2.9/v4版本方案？若含B，是否批准独立rank_window来源协议？ | 建议批准这一完整版本边界；不能原地改变v12/v13合约/重放。历史运行中草稿不升级；新词只进新workflow。 |
| **D5** | 六站是否采用E表已有3词？是否有第4/5词或不同目标服务？请确认所选GBP分支及任何域名别名，并由负责人给独立标注答案。 | 建议先用已保存词，不按当前排名换词。旧样本Local Pack/自然前20缺口保留未知；不改truth、不自动采集补答案。 |

其他风险：旧缓存不能恢复被丢弃links；Google结果/分页可能变化；缺少广告或窗口审计时不能假设完整；新增补充来源会增加合约/数据库消费者的兼容工作。凡确认过程中新增的预算、身份别名、分支合并、排名权重或采样点规则，继续追加待决，不在实现时自行裁决。

---
## 设计确认（由负责人/验收人填写）

待确认。
