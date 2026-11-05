# P1-05 设计说明（待确认）

日期：2026-11-05。范围为经营模式识别、营业地与目标市场拆分、GBP 身份查找、SEO 改选后的离线重判。覆盖任务卡 P0-09 补充①–④及第一批补充⑤–⑦。**本轮只写设计，尚未实施；待负责人确认后继续，不提交、不部署、不采集。** 下文新增字段、版本号、交互和边界均为拟议方案。

## 1. 已核对的现状

- `SearchTrust-RD/app/report_v22/models.py::BusinessIdentity` 只有 `storefront / service_area / hybrid`，`primary_location` 必填；`site_gbp_alignment.py::_validate_identity` 要求它与 `context.target_market` 整个对象相等。`site_business_selection.py` 又把该位置用于地址候选归属判断。因此只删除一个相等检查不足以完成拆分。
- `preflight_v22/gbp.py::_normalize_candidate` 目前“有地址 → storefront；service_area_business 为真且有地址 → hybrid”；`extractors.py` 也用 JSON-LD 地址/服务区组合直接推断。`business-match-step.tsx` 无候选时默认选 storefront。这些路径会把公开办公/登记地址误当接待门店。
- `LimitedGbpLookup` 当前先直接查档案或发一次组合搜索，最多读取前五项；有归一化候选便返回 found，没有先复用已保存市场结果，也没有在 found 出口统一执行域名/电话匹配门槛。不能把接口 found 当作身份确认。
- 当前地址适用性：service_area 不比较地址，storefront 不比较服务区，hybrid 两者均比较。三值枚举同时存在于 Python、TS、Case API、数据库约束及首次服务链路，不可只改下拉框。
- 当前 capability 为 public v12 / report 2.2.7 / manifest v1、v2 / delivery revision v3。manifest 的 acquisition 不允许 previous_report；after_acquisition 又要求私有来源，不能拿它冒充公开报告离线重判。保存的来源还有时效校验，不能修改采集时间来“通过”新重判。
- 负责人确认来源：PLAN 的 P1-05 任务卡、`P0-09-annotation.md` 的负责人决定，以及六站 `truth.json`。PR=hybrid、Vision-Tech=service_area、Volcanoes=meeting_point、Seamless=service_area；**All Star、Nova 的 value 仍是 null，不替负责人补填。**

## 2. 经营模式：定义、依据和优先级

### 2.1 判定对象与输出

模式针对“当前商家/所选分支的交付方式”，不针对某一个服务城市页面。四种已知值：

- `storefront`：有明确的客户到访、到店办理/消费场所。
- `service_area`：到客户所在地提供服务；办公/仓储/登记地址不因此成为接待门店。
- `hybrid`：同时有客户到访接待和上门服务的正向依据。
- `meeting_point`：行程/活动在指定或预订后确认的集合点开始，集合点不能当作经营门店地址。

未确定用 `value=null` 与独立 `state=unresolved`，不再给旧三值枚举增加一个假默认。输出包含 `suggested_value`、备选项、`state`（resolved / needs_confirmation / unresolved）、来源、逐条支持/冲突依据及置信度。展示“系统建议”与“已选模式”两个字段，不能把建议写成客户已确认事实。

### 2.2 优先级与冲突

1. **当前商家/分支绑定的 SEO 或客户确认优先。** 记录选择人、时间、理由和基础报告/证据校验值；旧预检自动填出的 operating_model 不算人工确认。人工选择不改页面或 GBP 原值，也不提高证据置信度。
2. **同一实体的明确服务方式描述**：contact/about/服务说明/FAQ 中的到访、上门、集合安排；保留原文、页面和 selector。仅从可用、未截断且已确认归属的快照提取。集合点使用正向组合，如 “meeting location” 与 “after booking / varies by experience”，排除办公预约、活动案例、其他商家和否定句。
3. **已匹配 GBP 的显式字段**：仅 `state=observed` 且真正布尔值的 `service_area_business`/`pure_service_area_business` 才是依据。`true` 支持服务区模式；即使同时返回地址也不自动改为 hybrid。`false` 仅否定该标志，不单独证明门店。字段缺失、null、not_returned、字符串 `"false"` 均不能被当作布尔事实。
4. **辅助线索**：公开地址、JSON-LD PostalAddress/areaServed、营业时间、地图钉、行业、服务城市列表。可给出建议和待确认提示，不能独立确认客户可到访，也不能由“未找到到访说明”推断禁止到访。

同等级证据冲突、多个分支混杂、地址用途不明或同时像集合点/门店时，交给 SEO；不按出现次数投票、不用 LLM 补事实。正向集合安排可给出 meeting_point 的明确建议；单有 GBP 地址不推翻它。明确到访与明确上门同时成立才可自动判 hybrid。行业为 plumber、gutter installer 等本身不够。

### 2.3 未确定时

预检/审核显示四个英文选项和 `Not sure yet`，默认无选择，列出原文与冲突原因；SEO 可选、改选或暂缓。模式未确定不阻断已有站点/搜索模块，但地址及依赖模式的服务区适用性记 `not_checked / operating_model_unresolved`，不生成缺地址、错地址或需要统一地址的行动。若现有收集入口要求完整身份，新增 v2 入口允许模式未定，不能为了通过旧入口填 storefront。

**保守原则需要确认：** PR 的“公开地址 + 15 城服务区 + 上门车辆”足以建议 hybrid，但并未独立证明接待到访；按上述规则，纯自动识别应请求确认。负责人已经确认 PR=hybrid，可作为验收中的人工选择输入；不能为了命中这一站而让所有“公开地址 + 上门”自动变成 hybrid。All Star、Nova 同理保留不确定。

## 3. 数据结构与版本边界

仅新增 public `v22_capability_public_v13`、报告 `2.2.8`、manifest `v22_analysis_input_v3`，新身份为 `business_identity_v2`，预检/获客 request 与 response 也用显式 v2 判别。排序继续使用 P1-07 的 v3。旧身份模型与三值枚举定义原样保留，旧 v3–v12、冻结 Nova v5 和历史交付走原路径。

拟议结构（示意，非本轮写入的数据）：

```text
BusinessIdentityV2
  schema_version: business_identity_v2
  business_name, site_url, normalized_domain, public_gbp_url
  operating_model: { value: four-mode | null, state, suggested_value,
                     alternatives, source, evidence_refs, conflicts,
                     confirmation_ref? }
  operating_location: { state: observed | seo_confirmed | not_checked,
                        location: Place | null,
                        role: customer_facing | office | registered | unknown,
                        source_refs, confirmation_ref? }
  selected_branch_ref: GBP CID/place_id | null
  identity_match: { state, matched_on, source_refs, rejected_candidates }
CaseContextV2
  target_market: TargetMarket             # 搜索/竞品采样市场，含采样点
BusinessScopeV2 / ManifestV3
  identity_version_id, identity_checksum
  target_market                          # 与 generation request 严格绑定
  evidence_as_of, evaluated_at, base_report_ref?
```

`Place` 与 `TargetMarket` 分开定义：前者只承载真实观察/确认的营业地、地址用途及可空位置字段，不从搜索点生成街道地址；集合位置另列为证据，不塞进 operating_location。`operating_location.location=null` 合法，不能拿 target_market 回填。GBP 原始地址仍在快照中原样保留；营业地址用途未知时标 unknown，不把网页 Trading Address 擅自解释为门店。

- Vision-Tech：目标市场仍 Swansea；营业地候选来自 Cross Hands / Llanelli 的 Trading Address 与匹配 GBP；不改 GBP 原文、不把 Llanelli 改成 Swansea。页面中的旧 Ammanford 地址保留为候选冲突，不用采样市场裁决。
- Volcanoes：目标市场 Hilo；GBP 的 Keaau 地址可记录为用途未知的观察，不能宣称是集合点；真正集合点列表来自页面安排。
- Seamless：GBP 未返回地址，营业地可为空；Pensacola 只作市场。
- 国家/电话归一化用可确认的经营主体国家上下文；没有可靠国家信息时保留无法比较。市场定位、near-me 本地化和服务覆盖用 target_market；地址候选归属用实体/分支及营业地，不再要求营业地等于市场。服务区与市场的包含关系和实体地址一致性是两件事。
- Case 当前以地点参与去重/绑定，新版明确延续“域名 + 目标市场”的 Case 口径；不因新增营业地改变既有 Case ID 或旧 location key。分支选择另绑定，不靠城市猜分支。
- 新版不得把 meeting_point 降级为 storefront 传给旧 API。新增版本入口与旧入口并存；初次服务/Google 身份等消费位置的路径需同时做版本识别，历史读取保持不变。**本任务是否要求新 v2 Case 立即进入旧首次服务流程，见第 8 节待确认；不能静默降级。**

## 4. GBP 身份查找的新顺序与“未找到”规则

### 4.1 顺序

1. 读取本 Case/商家已保存、可追溯的市场候选与详情，按原始来源 ID 去重；优先复用当前明确选中的匹配 CID。对所有候选执行下面的同一门槛，不能只看前五条或第一名而漏掉 Seamless。搜索样本可作为线索；过期样本不能伪称刚采到，详情沿现有时效规定标可用或未检查。
2. 无可唯一使用的候选时，解析 SEO 提供或网站已保存的 GBP 链接，以 CID/place_id 查已有记录；必要的详情查找计入预算。同名异 CID 不直接合并。
3. 仍无匹配时才做有界搜索：先官网域名 + 已观察电话 + 国家/市场线索；再实际页面品牌名 + 市场，或 SEO 明确提供的名称。实际经营品牌优先于域名推出来的关键词。不得用 LLM 编商家名。
4. 建议每站最多 **3 次额外 GBP provider 请求合计**，包括补详情和名称查询、实际重试；缓存命中为 0。仅增量查找需要单独默认关闭开关及预算台账；停用、超限或超时就停止并提示，不无限重试。

现有预检先于市场采集：已有市场快照时先查库；新 Case 尚无市场结果时不为“先查市场”偷偷加一轮付费搜索。先保留身份待确认，使用用户确认的服务/目标市场完成原本已授权的市场采集后，再从该结果定位本商家；只在仍未解决时执行上述有界补查。竞品最终排除客户 CID/域名，不能把 Seamless 本商家留作竞品。不改变竞品 3 家上限。

### 4.2 正向匹配硬门槛

候选必须是有可追溯商家身份的记录，且 **D 或 P 至少一个为 true**：

- D：候选官网与用户确认的官网规范主机一致。小写、IDNA、去末尾点及 www；路径不影响主机比较。不是字符串包含/模糊拼写匹配，不把所有相同注册域下的不同租户自动视为同一实体。别名只接受已有可验证跳转/SEO 明确确认的别名，不临时访问任意候选 URL。
- P：候选电话与同站、归属本商家的已观察电话使用现有 `compare_phones` 按可靠国家上下文比较一致；不做后几位匹配，不借用竞品、案例、第三方隐私政策的号码。无法解析为 unknown，不能当 true。
- 只有名称相似、城市相同、地址近似、用户给了链接，都不能绕过 D/P 门槛。D=true、P=false 或相反可保留，但显示另一个冲突；多个合格 CID 或同域多分支须 SEO 明确选，不能因有两项匹配就猜哪个分支。

完成查找后 D/P 都无正向匹配，则不能输出 matched/found business。两项明确不匹配的候选拒绝；有效查找完成且无合格候选记 `gbp_not_found / no_verified_domain_or_phone_match`。字段没返回造成无可验证匹配时，在原因中写明缺信息，不写成“现实中没有 GBP”。provider 失败、未运行、预算耗尽则为 `lookup_not_checked`/未完成，并非完整查找无结果。

**短链接地址占位**：若仅解析到地址/地图地点，没有商家名称/商家记录，记 `identity_unconfirmed / address_only_place`，不得拿地址文本充当商家名称，也不得仅凭 CID 确认。它可触发后续有界查找；即使用户点选，也需补到 D/P 正向证据后才进入身份匹配。

回归必须覆盖：Seamless 市场记录 Gutter Solutions & Home Improvements、CID `16921898606511158364` 直接复用；原街道占位拒绝；Vision-Tech 两家美国公司拒绝，匹配 Vision Tech AV LTD、CID `3467016953362037400` 可用；Volcanoes 两个同名同电话同域 CID 仍呈现歧义，复用负责人已确认的 `16906567364961418758` 而不重新猜。

## 5. 六站预期：自动建议与负责人确认分开验收

此表来自已有 truth 引用、冻结输入和负责人裁定的设计推演，**不是新算法已执行结果**。实现时要输出真实提取到的原文/selector；超限或未加载的正文不能作为自动依据。负责人答案仅进测试期望和显式确认夹具，不让运行时识别器读取 truth.json。

| 站点 | 旧 bound 模式 | 保存证据与自动预期 | 负责人确认 / 验收口径 | 新版地址处理 |
|---|---|---|---|---|
| PR Plumbing | storefront | GBP 公开 1504 N Maple Ave；网站 Service Areas、30 service trucks。建议 hybrid，但没有独立到访接待证据时必须确认；正文不可用则不声称已识别 | **hybrid**；用独立 SEO 确认记录测试生效，不用“地址 + 上门”规则强行过关 | 确认 hybrid 后按同分支真实地址比较；采集/识别不足仍 not_checked |
| All Star | storefront | 公开 5639 W Barstow Ave、Schedule Service / rush out to you；公开地址用途不清，service_area_business 未返回 | **service_area（负责人 2026-11-05 补充确认）**；系统仍只给 hybrid/service_area 建议，不把办公室当门店 | 人工确认后 not_applicable；未确认的新输入仍 not_checked |
| Vision-Tech | storefront | 同实体 Trading Address 在 Llanelli；on-site engineers、Swansea Areas We Serve 支持服务区建议，不把城市页当 Swansea 门店 | **service_area** | 街道地址对齐 not_applicable；Llanelli 与 Swansea 不产生 mismatch |
| Volcanoes | storefront | “Meeting areas vary by experience”、预订后发 map pin、不同活动不同集合地点，支持 meeting_point；GBP Keaau 地址用途未知 | **meeting_point** | 普通网站—GBP 街道地址对齐 not_applicable；不报缺地址/地址不一致，也不新建集合点对齐扣分规则 |
| Seamless | service_area | 上门安装、Area We Served 多城多县支持服务区建议；GBP 地址 not_returned 只表示未知，不作为模式证明 | **service_area** | 地址对齐 not_applicable；名称不同仍 low，沿用 P1-07 方案 A |
| Nova | service_area | 冻结 v5 配方为 service_area，但站点和 GBP 均公开 2602 N Miami 地址；是否接待到访未证实 | **service_area（负责人 2026-11-05 补充确认）**；旧冻结报告不动，独立确认记录供 v13 使用 | 人工确认后 not_applicable；未选时仍 not_checked，不能继承旧自动值冒充确认 |

按文末负责人补充裁定，六个已确认站要验证“明确人工选择后的 effective mode”逐站 6/6 等于负责人答案；另统计纯自动建议、待确认和无法识别，不能把人工确认算作自动命中率。集合点依据若被冻结采集上限挡住：可用已保存、完整且有哈希的专项页面做独立离线识别样本，不修改原 bound，不能宣称原 bound 已具备这段文本。

## 6. SEO 改选后的地址重判、数据库与审核界面

### 6.1 判定表

| 有效模式 | 普通街道地址对齐 | 服务区适用性 |
|---|---|---|
| storefront | 适用，但必须同实体/分支、双方可比较、检查充分才下结论 | 延续不适用 |
| hybrid | 同上 | 适用，保留现有检查资格 |
| service_area | not_applicable；不因缺街道地址生成缺失/不一致 | 适用 |
| meeting_point | not_applicable；不把办公室、登记地、行程集合点互相对齐 | 仅明确的服务区域可比较，不能用集合点自动填服务区；信息不足 not_checked |
| 未确定/冲突未解决 | not_checked，reason=operating_model_unresolved | 同样不作模式依赖结论 |

切为 storefront/hybrid **不会自动生成 mismatch**；现有数据若未抓到、未检查、地址用途/分支未解决或文本只能确认一致，继续相应 not_checked。沿用文本/渲染证据“只确认一致”的边界。切为 service_area/meeting_point 后地址行动的依据可能消失，须重建关联行动与材料，不能只把 finding 隐藏却留下“统一地址”的建议。

### 6.2 只新增判定版本，不修改已冻结对象

建议流程：审核显示当前模式、系统依据和四个英文选择 → SEO 提交新模式和理由 → 服务器核对身份版本、基础报告 checksum、最新修订号 → **纯离线重判预览** → 显示地址结果、关联行动增减及原文案影响 → SEO 确认保存新判定版本 → 再审核批准新交付。

新增 append-only `case_business_identity_versions`（含 v2 身份/确认来源）及 `capability_reassessment_requests`（基础报告、身份版本、快照引用、请求摘要、操作者、幂等键、状态）。沿用报告/修订表保存新的 report 与 delivery，不把模式改选塞进可随意编辑文案的 revision 字段里。新增 v3 manifest 的专用 `public_reassessment` 执行类型，只允许从同 Case 的可验证基础公开报告派生，禁止采集阶段、扣费和外部网络。

必须显式处理时间：`evidence_as_of` 继承原分析时点，所有 source fetched_at/expires_at/payload_checksum 原样；`evaluated_at` 为新判定时间，另记录新的 SEO 确认时间。新模式下依据原分析时点校验当时来源资格，并明确“基于已保存样本重新判断”，不能改日期让旧快照看起来新鲜。原请求、manifest、报告和快照不 UPDATE、不重算覆盖原 checksum；新增 manifest/request/report 有自己的新 checksum 和 base_report_ref。身份/规则推导的新增证据项须新 ID，原 evidence 原件保留。

重跑地址及经营模式影响的服务区适用性，再派生相关 findings、contact_checks.result、行动候选、排序与材料。其他事实结果须逐项比较，无法解释的变化停止。P1-07 的“等量替换”继续作用于每份报告自己的原始槽位；重判可能改变新版系统槽位数，这是新报告生成，不是给旧修订追加行动。旧编辑不能按数组位置套入新版；可先展示保留与失效项目，来源/材料身份完全一致的文案才允许显式迁移，失效行动回旧版本查阅。新版本默认未批准，旧已批准版本和已发分享/PDF 不变，新分享需批准新版本。

### 6.3 数据库与界面变更点

- 迁移排在 `20261105100000` 后；新表 RLS/用户与 Case 外键、append-only、版本唯一、幂等与 expected_revision 校验。freeze/store/save/dispatch 的 v13、2.2.8、manifest v3、新 identity/request 版本白名单同步。已有函数修改沿用 `pg_get_functiondef + replace`、目标缺失 raise；仅本地迁移测试，不执行生产。
- `client_cases` 的三值 operating_model CHECK 和 business_identity 形状约束需版本条件化：旧行仍三值；v2 才允许 meeting_point/null。身份/作用域版本引用决定新报告，不能直接改 Case 然后让旧报告身份失效。搜索市场仍来自 target_market，不由营业地联动改写。
- 复查 business scope、预检确认、获客准备/冻结、worker runtime、报告落库、Google 身份缓存失效和 first-service dispatch 等所有身份消费者；新旧版本不能混用。新增 v2 JSON Schema、生成 TS 类型、导出 manifest/checksum 和数据库测试同步。
- 经营模式审核在现有 Review & approve 中新增独立区；与行动文案编辑分开提交。用户改选但未重判时提示“尚未应用”；失败/并发冲突保留选择，禁止把旧结果标成已重判。所有 UI 英文，不显示内部规则 ID/路径。客户网页/分享/PDF 使用同一份已批准新判定，顾问可看原文证据及选择记录。

## 7. 验证计划、已跑基线与成本

**本轮已实际执行（仅设计前基线，后端目录）：**

```bash
.venv/bin/python scripts/eval_gold.py --ruleset v22_capability_public_v11 --truth-overlay tests/fixtures/p1-00b-hours/confirmed-truth-overlay.json
```

退出 0；6 站、误报 **0/35**、字段未检查 **7/26**（0.2692307692307692）、errors=[]、incomplete=false、external_calls=0，与用户指定基线一致。本轮没有实现后测试，不能把此结果称为 v13 验收结果。

确认实施后：

1. 经营模式测试：公开地址不能独立证明门店；true/false/null/not_returned 严格区分；集合点/办公预约/否定句；混合分支与冲突；SEO 优先与未选 not_checked。六站分别输出自动建议、可追溯原文、确认来源和最终模式。
2. 身份查找测试：缓存先行、品牌不同但 D/P 匹配、两项不匹配拒绝、地址占位、缺字段、provider 失败、同域多 CID、误拼域名/电话尾号、总请求上限与关闭开关；不得产生伪造 GBP。
3. 拆分测试：Llanelli / Swansea 合法、Keaau 不变成 Hilo 集合点、营业地为空不回填、目标市场变更不修改 GBP 地址、旧三值模型拒绝 meeting_point。
4. 重判测试：storefront↔service_area、hybrid↔meeting_point、未知→已选、检查失败、非同分支地址、渲染号码/地址边界；旧证据/报告/已批准链接逐字节不变；新的地址结果与行动/材料一致；并发、跨用户、伪造来源、重复请求、来源过期不能伪装新采集、所有离线重判网络请求被阻断。
5. TS/Python/SQL 合约与迁移检查；本地浏览器操作模式改选、前后对照、保存失败恢复、重新批准后三端一致及真实 Volcanoes 样本；相关导出全部 --check。
6. 实施完成后再跑同一 v11 + 营业时间覆盖全量评估，必须仍为 **0/35、7/26**；v13 另出逐站差异和模式确认覆盖统计。旧 truth.json 不改，v11 专属营业时间覆盖不偷偷用于 v13 计分。若需新版本评分标签，另建显式版本覆盖文件交负责人确认。

**成本**：设计、冻结输入回放、合成查找响应和模式改选均 0 个 SerpAPI/Firecrawl 调用，$0；本次不需要重新付费采集。真实增量查找如要验证，按上述上限六站最多 18 次 GBP provider 请求，Firecrawl 0；这是请求上限，不是付费授权。届时先逐站扣除可复用记录，再按共用账户实际计费报价、等待批准，不猜单价、不使用以前 P0-09 的预算继续请求。短链解析亦优先用已保存结果，实时网络验证另列获取预算。

## 8. 待确认事项与停止点

请确认以下方案后才实施：

1. **保守自动识别口径**：地址 + 上门仅作 hybrid/service_area 的建议，不独立确认 hybrid；PR 通过负责人已确认的人工选择记录达到 hybrid，All Star/Nova 保持未确定。是否接受“自动建议”和“确认后有效模式”分开验收，避免硬编码金标准或强行让自动识别达到 6/6。
2. **新版本与重判路径**：v13 / 2.2.8 / identity v2 / manifest v3、append-only 身份版本和公开离线重判类型；改选后新增报告并重新批准，不覆盖原 evidence 或已发交付。仅重判不产生外部 API 成本，建议不消耗采集额度。
3. **集合点的适用性**：街道地址不适用；有明确服务区时才比较服务区；集合安排本身暂只做识别依据，不另加一条“集合点必须与 GBP 一致”的规则。
4. **首次服务兼容范围**：建议本任务先完成新获客与报告内重判、历史服务正常读取；对尚未适配 identity v2 的新 Case 首次服务入口明确提示未支持，不能降级模式。若要求新 meeting_point Case 立即进入首次服务，应同时确认升级 service 输入/规则集的范围，不能暗中扩展本任务或送入旧三值接口。
5. **身份补查限额**：新增查找先缓存、再链接/域名电话、最后名称；每站最多三次额外请求合计，默认关闭增量付费开关。域名/电话至少一项正向匹配是必要条件，多候选仍交 SEO 确认。

本轮只新增本设计文件。现有未提交 PLAN.md 与 docs/superpowers/plans/ 验收记录不动；未改生产代码、冻结输入或金标准。写完即停止等待设计确认。

---
## 设计确认（2026-11-05，验收人：Claude）：批准实施，附 4 个条件

第 8 节 5 点的意见：
1. **同意保守口径。** 自动建议和人工确认后的有效模式分开验收；不硬编码金标准，不追求自动识别 6/6。All Star、Nova 是否补充人工标注，由负责人另行决定（见条件 4），不阻塞实施。
2. **同意** v13 / 2.2.8 / identity v2 / manifest v3、append-only 身份版本、公开离线重判。重判不调用外部 API，也不消耗采集额度。
3. **同意。** 集合点不比较街道地址，不新增集合点对齐规则。
4. **有条件同意。** 只有 `meeting_point` 或模式未确定（null）的 v2 Case 进入首次服务时，才明确提示暂不支持。**v2 Case 的模式为 storefront、service_area 或 hybrid 时，必须能无损映射到旧三值，正常进入首次服务。** 不能因为身份结构升级到 v2，就让所有新 Case 都进不了首次服务，否则获客到服务的转化会被整体阻断。需要测试证明这两种情况。
5. **同意。** 先查缓存，再查链接和域名/电话，最后按名称查；每站额外查找最多 3 次；付费开关默认关闭；域名、电话至少一项正向匹配。本任务不做真实付费验证。

附加条件：
1. **分三段交付，每段结束都停下等验收：**
   - 第一段：identity v2 数据结构、营业地与目标市场拆分、经营模式识别（输出建议和依据）、按有效模式判断地址适用性、v13 合约和迁移、六站逐站输出。
   - 第二段：GBP 身份查找的新顺序和 D/P 硬门槛，包括 Seamless、Vision-Tech、Volcanoes 的回归用例。
   - 第三段：SEO 改选经营模式、离线重判、新表、审核界面，并提供本地预览和截图（同 P1-07）。
2. **六站逐站表**：第一段交付时给出每站的自动建议、实际提取到的原文和位置、确认来源、有效模式和地址对齐结果，并和第 5 节的预期表对照。和预期不一致的地方照实写出来，不要改识别规则去凑。
3. **地址相关行动要一致**：模式改为 service_area 或 meeting_point 后，“统一地址”类行动和材料必须一起消失，不能只隐藏发现、留下行动。第一段用 Volcanoes、Vision-Tech 的真实样本验证。
4. **迁移和上线清单**：每段新增的迁移都排在 `20261105100000` 之后，并同步追加到 PLAN 第六节的上线清单。

### 负责人决定（2026-11-05）：All Star、Nova 的经营模式
**两站都是 service_area（上门服务）。** 公开地址只是办公室（可能有人接待），维修必须到客户家中完成。已写入两站 truth.json 的 `operating_model.value`，并附负责人核对记录，其余字段不变；eval_gold v11 + 营业时间覆盖仍为 0/35、7/26。

对设计的影响：
- 第 5 节预期表中 All Star、Nova 的“负责人确认”改为 **service_area**，有效模式下街道地址对齐为 not_applicable。现在 6 站都有人工确认的模式，确认后的有效模式要逐站 6/6 等于负责人答案。
- **自动识别口径不变**：“公开地址 + 上门”仍只给出建议、需要确认，不能为了命中这两站把它改成自动判定 service_area。这两站正好说明：办公室地址加上门服务，仍然是 service_area，不是 hybrid。而 PR 是负责人确认的 hybrid，所以单凭“地址 + 上门”区分不了这两种模式，必须交给 SEO 确认。第一段交付时，在逐站表里分别列出自动建议和人工确认后的有效模式。
- 这两个 truth.json 的修改随 P1-05 第一段一起提交。
