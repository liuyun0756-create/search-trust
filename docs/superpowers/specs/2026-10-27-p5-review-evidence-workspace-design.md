# P5-03 第三批：复核证据工作区

日期：2026-10-27（Asia/Shanghai）

状态：用户已确认书面设计，2026-10-27 开始本地实施；未发布、未接收费生成。

## 1. 目标与本批边界

让独立 SEO 从已批准的 Verified 报告进入复核工作区，选择已保存的证据、核对其范围和版本、免费保存一份不可变的证据快照，并能再次查看。

本批完成一个闭环：**报告入口 → 版本上下文 → 逐行动选证据 → 服务端确认 → 保存 → 历史读取**。复用前两批已完成的纯复核投影与内部固定存储，不重写证据规则。

不在本批实施：SEO 下一步决定编辑、新报告生成、模型/队列调用、重新抓取或 Google 采集、点数结算、客户分享、PDF 导出、生产发布。所有 review 生成拒绝保护继续保留。保存证据不代表行动完成、效果成立、报告生成或客户批准。

既有商业规则不变：正常交付但缺少行动依据的诊断报告消耗 1 点且不返还；本工作区只整理和保存证据，因此不消耗点数。

## 2. 布局选择与原型依据

采用独立工作区（方案 A），从原报告的实施记录区域进入，保留返回原报告的入口及版本上下文。

| 方案 | 优点 | 取舍 |
| --- | --- | --- |
| A：独立工作区，左行动、中证据、右清单 | 足够空间核对具体数据，选择和保存状态独立清晰 | 增加一次页面导航；通过固定报告与版本信息保留上下文 |
| B：报告右侧抽屉 | 不离开报告 | 多来源、日期和限制容易挤在窄栏，不采用 |
| C：报告内展开 | 内容连续 | 进一步拉长已有报告，跨行动核对需要较多滚动，不采用 |

参考原型：`.superpowers/brainstorm/62222-1793009660/content/review-workspace-v1.html`。原型是布局参考，不是生产数据契约。正式页面不保留演示数据、模拟保存说明或布局比较工具。

原型中需要修正的交互：已保存快照必须独立只读；“查看已选来源”不能返回可提交的确认表单；“准备另一份”创建新草稿而不是修改已有快照。

## 3. 入口、路由和版本

- 在 capability 报告页的实施记录区域后增加 `Prepare review evidence` 入口；旧报告体系不新增兼容转换。
- 新页面：`/cases/[caseId]/reports/[reportId]/review-evidence`。
- 新选择必须指定 `deliveryRevisionId`、`implementationId`、`implementationRevision`。入口可使用该报告区域当前展示的已保存实施记录，但必须显示版本，服务端重新确认其归属。
- 缺少实施记录时显示 `Save an implementation record before preparing review evidence.`，提供返回现有记录区域的链接；不偷偷创建记录。
- URL 版本缺失时显示明确的版本选择步骤，不静默选择“最新”。批准版本及其实施历史支持分页；完整版本引用及 checksum 由服务端返回。
- 可切换到另一个仍可授权读取的历史批准/实施版本。存在未保存选择时先询问是否丢弃，确认后清空选择与确认状态；不同版本的证据不能混合。
- 已保存视图使用同一路径加 `reviewId`。`reviewId` 与新选择的版本参数互斥；历史视图版本从已保存快照读取。
- 零行动报告保持零行动，不填充建议。若已有合法实施记录则允许保存原诊断和空行动列表；没有合法实施记录则解释前置条件，不为通过 UI 伪造一条记录。

## 4. 页面结构与完整主流程

### 4.1 标题和固定上下文

标题：`Bring the evidence into one review.`

说明：`Choose the saved records you want to review. Keep the original report unchanged.`

展示客户/业务范围、原报告版本、批准交付 revision、实施 revision。历史版本明确标为历史依据，不承诺它代表客户当前业务。阶段条为 `Select evidence → Confirm selection → Saved snapshot`；不是报告的阅读视图切换。

### 4.2 选择阶段

桌面三栏：左侧批准行动，中间当前行动证据，右侧选择清单。行动按批准交付顺序，不按来源数量或“效果”重排。左右栏可在页面滚动时保持可见，正文不设置第二个纵向滚动容器。

中间依次展示：

1. 行动标题、目标范围、对应实施记录；明确区分 `Self-recorded` 与页面检查结果。
2. Page check：已保存的当前检查，可选前次检查；显示实际观察时间、目标、检查条件和结果。首次观察不说“改善”；检查受限说明原因。
3. Search Console：保存时间、准确前后窗口、页面/查询及其他实际过滤范围；只显示既有阅读器允许的指标和解释。数值变化不写成因果或客户效果。
4. Google Analytics：相同范围与日期信息；当前只展示已有 sessions 阅读能力，不能扩展为询盘、收入或转化效果。withheld 显示受限原因，不显示伪造的零值。

每种来源默认 `Not selected`。用户明确选择后才计入；不默认选最新，也不默认选择全部。没有来源、未选择来源、读取失败、已选择但读数受限是四种不同状态。

前次页面检查不能独立存在；清除当前检查时同时清除前次检查，并给出可见提示。前次选择和当前选择仍由既有规则判断是否可比较，不在 UI 自创比较算法。

右侧显示批准行动数、已选来源数、缺失/受限提示和 `Review selection →`。缺少可选来源不阻止确认；若明确选择的来源失效，则必须阻止，不得静默移除。

底部说明：`No credits used · No new report`。不增加采集按钮，采集仍属于已有页面检查/数据采集流程。

### 4.3 确认阶段

点击 `Review selection` 后先由服务端解析、授权并验证全部来源；加载成功后才显示确认表，不以客户端缓存代替服务端确认。

标题：`Check exactly what this review will keep.`

说明：`These versions and saved sources will not be replaced by newer data.`

确认表完整展开全部行动，每项展示目标、实施版本、来源的时间/范围、允许读取的核心结果、受限与缺失状态。原诊断摘要标注为此前诊断、此次未重新诊断；没有行动时也保留其依据与限制。

确认勾选：`I have checked the report, implementation version and selected sources. Save this selection without generating a report.`

按钮：`Change selection`、`Save evidence snapshot · Free`。勾选前不能提交；改变任何来源或版本即清除勾选和服务端确认依据。

### 4.4 保存和只读阶段

保存中禁用重复提交和版本切换，保持当前清单。只有经过验证的保存响应或读回记录才显示 `Evidence snapshot saved.`，超时不显示成功。

完成视图显示快照标识、保存时间、原报告/批准/实施版本、逐行动证据摘要及限制，同时明确：`Report unchanged`、`No new report generated`、`0 credits used`、`Next-action decision: Not recorded`。

`Inspect selected sources` 打开当前快照的只读详情；`Prepare another snapshot` 返回版本选择和新的空草稿，不覆盖当前快照。历史快照从本报告工作区的 `Saved snapshots` 列表重新打开，按保存时间倒序分页。

## 5. 数据读取和安全展示

复用 `ReviewFreezeRepository.resolve/read/save`、`ReviewFreezeSelection` 和 `build_review_projection`，新增小型工作区服务与严格 view model。完整 bundle、原始 provider 响应、owner ID、连接令牌和内部错误不得直接返回浏览器。

浏览器只收到：目标版本引用、批准行动摘要、精确来源引用、展示所需 facts/时间/范围/限制、确认 fingerprint，以及保存回执。私有实施备注不进入客户分享内容，本批也不增加客户访问入口。来源链接与文本按普通数据处理，不执行 HTML，不嵌入第三方页面。

来源目录按 owner → active Case → report → approved delivery → exact implementation → action 过滤，不能只按 action ID 或域名匹配。允许已有成功来源的读数为 withheld；页面 completed 但 observation 为 unable_to_check 仍可表达受限证据。queued/running/failed 且没有可用完成记录的任务不可选。

目录使用服务专用受限 RPC，不开放基础表读权限。每种来源每页 20 条，按保存时间与 ID 的稳定组合排序，提供有界游标和“加载更早记录”。版本、历史快照也每页 20 条。游标仅用于分页，不能绕过每次授权。历史快照和已选来源按精确 ID 读取，不要求它恰好位于最近一页。

目录只返回候选元信息；选中后读取严格过滤的来源摘要，最终确认仍重新解析完整来源。目录为空与服务失败必须分别显示。Google 当前连接撤销不重写既有历史数据的资格；当前 Case 的归属和归档状态始终检查。

## 6. 确认到保存的一致性

现有内部 `freeze()` 会在调用时重新解析；不能直接把它接到 UI 后声称“保存了刚才看过的全部状态”。本批工作区服务增加明确的确认比较步骤：

1. `preview` 根据 selection 调用 resolve，验证完整 bundle 并生成安全摘要。
2. 计算 `confirmation_fingerprint`：对对象 `{selection, core_without_evaluated_at, case_updated_at}` 使用现有 Verified canonical/hash；core 包含规则版本和完整来源。只排除本次解析的 evaluated_at，不排除来源时间、范围、数据或限制。
3. 浏览器只回传 fingerprint、原 selection 与新请求 ID，不上传 bundle、数值或资格声明。fingerprint 是一致性比较值，不是授权凭据，也不能替代来源验证。
4. 保存先按请求 ID 读取：存在且选择一致则恢复原结果；不同选择冲突；权限不足统一不可用。已成功请求的恢复不要求重新确认旧来源。
5. 首次保存重新 resolve；fingerprint 不一致返回 `STALE`，保留选择、清除确认并要求重新核对；一致才调用现有 `save(resolved)`。
6. 现有事务再次校验来源与 Case 状态并原子写入；继续遵守其时间窗口。任何一项校验失败均不得创建半份快照。

因此新出现的另一条来源不会替换用户选择；所选来源或上下文变化则必须重新确认。并发相同 ID 保存、响应丢失和已有记录读回仍保留现有幂等语义。

## 7. 接口与模块边界

前端 BFF：`/api/v2/cases/[id]/reports/[reportId]/review-evidence`。

| 操作 | 输入 | 输出与副作用 |
| --- | --- | --- |
| GET versions | 明确请求批准版本列表或指定批准版本的实施列表、分页游标 | 版本目录，只读；实现时与 context 分离，避免隐式最新版本 |
| GET context | 指定批准/实施版本 | 版本与行动上下文，只读 |
| GET candidates | 精确版本、action、source kind、分页游标 | 对应已保存来源元信息，只读 |
| GET source | 精确版本、action、source kind、source ID | 已验证的来源摘要，只读 |
| GET history | 本报告、分页游标 | 已保存快照元信息，只读 |
| GET read | review ID | 已授权且属于路径报告的快照安全视图，只读 |
| POST preview | selection | 严格摘要和 confirmation fingerprint，只读 |
| POST save | review ID、selection、fingerprint | 保存回执和只读快照视图；不生成报告 |

每个操作采用独立严格 schema，拒绝重复 query、未知字段、无效 UUID/revision/source kind 及不合法操作组合。GET 用 `operation` 区分；POST body 用 `operation` 区分。浏览器不得提供可信 user ID。所有写操作验证 Origin/Host、Sec-Fetch-Site 和 JSON Content-Type。

后端新增内部认证 `/api/v2/review-evidence` 操作入口，owner 仅由经过认证的 BFF 注入，复用现有 internal-auth 依赖。后端工作区服务负责流程与安全投影；仓储负责精确读取、目录分页及存储；前端只负责选择、呈现和状态，不复制证据资格规则。

请求正文上限 48 KiB，其中 selection 仍不得超过 32 KiB；浏览器安全响应上限 512 KiB。严格限制文本、列表和游标长度；超限返回明确错误，不能截断证据后显示“已完整确认”。后端内部完整 bundle 和 RPC 响应沿用已有上限与 legacy 数字传输规则。

所有页面/API 使用 private/no-store，BFF `Vary: Cookie`，后端请求不跟随重定向，有界流式读取和超时。复用已有可信配置检查，不向日志输出 token、原始证据正文或 SQL 异常。

## 8. 权限、开关和异常

新增前后端同名默认关闭开关 `V22_REVIEW_EVIDENCE_WORKSPACE_ENABLED`。前端还要求现有 implementation records 门控，后端还要求 capability execution 门控；开关关闭时入口隐藏且接口 404。历史读取不依赖当前 Google 采集开关。不得在本批修改真实环境开关。

权限每次重查，含候选目录、确认、保存、历史和重试。跨 owner/Case/report/delivery/implementation/action 读取拒绝，不暴露外部记录是否存在。Case 已归档或归属变化后不能读取快照；本批不新增分享链接或匿名权限。

| 情况 | 行为与用户文案 |
| --- | --- |
| 没有候选来源 | `No saved source is available for this action.`；允许明确不选 |
| 读取失败 | `Evidence could not be loaded. Retry without changing your selection.`；不能当空列表 |
| 所选来源不可用 | `A selected source is no longer available. Review your selection.`；阻止保存，不静默降级 |
| 确认后上下文变化 | `The review basis changed. Check the refreshed selection before saving.`；清除确认 |
| 保存结果未知 | `Save could not be confirmed. Recover this request before starting another snapshot.`；保持同一请求 ID 和原选择 |
| 请求 ID 与内容冲突 | `This request belongs to a different selection.`；不覆盖；先提供读取原记录的路径 |
| 未登录/失去权限 | 按既有登录/不可用处理；清除已显示的敏感工作区数据 |
| 响应过大或格式不合法 | 显示有界错误，不能显示成功或部分证据确认 |

错误 HTTP 语义：400 invalid、401 unauthenticated、404 unavailable/not found、409 stale/conflict、413 too large、503 transient/unavailable；不将暂时存储失败错误包装成“没有证据”。

## 9. 前端状态与恢复

主要状态：loading → selecting → previewing → confirming → saving → saved。另有 load_error、source_unavailable、stale、save_unknown、forbidden；状态转换与可操作按钮单独测试。

- 切行动只改变可见内容，不丢失其他行动选择。
- 未确认的草稿在内存中；离开/切版本时提醒。默认不将真实数值、备注或 bundle 存入浏览器持久存储。
- 首次提交前把最小 pending 记录写入 sessionStorage：schema version、请求 ID、精确版本及 selection、fingerprint；key 按 owner/Case/report/版本隔离。存储被禁用时保留内存 pending，并明确提示刷新后的恢复依赖服务端历史列表。
- 结果未知时只允许以同 ID/同选择恢复，不允许偷偷换 ID。恢复返回成功后清除 pending，写入带 reviewId 的页面 URL。
- 确定性的 stale/invalid 响应表示本次未保存，可退出确认修正并使用新 ID；未知错误不能作此假设。允许“放弃等待”，但明确原请求仍可能成功，历史列表可找回；不能把它显示为失败已回滚。
- 历史读取不重新查询最新来源来替换快照，也不自动将它升级为当前版本。

## 10. 可读性与可访问性

保持既有浅色/深绿产品语言。行动选择有编号、标题、当前状态和来源数量，不只靠颜色。标题与按钮使用语义元素；支持键盘切换、原生选择控件、清晰焦点及状态播报。

宽屏三栏，中屏左行动+正文、清单下移，窄屏行动横向列表+单列内容；所有行动可键盘到达。确认页始终展开全部行动，不将关键限制藏在折叠区。数值使用对齐排版；UTC/实施时区显式区分。禁用动画时不影响操作。

## 11. 验收与测试

实现前保存两仓基线，保护已有未提交工作。仅在本地测试数据库执行新增迁移；任何生产迁移、部署、收费或真实 Google 请求均不在此次授权中。

1. 服务端：context/catalog/source/preview/save/read/history 正常与错误路径；完整身份绑定、未知字段和上下限检查；输出中无 bundle/token/provider 原文泄漏。
2. 原生数据库：角色权限、候选过滤及分页稳定性、精确历史版本超过 20 条仍可访问、读写中的归档竞争、跨客户/行动攻击、保存恢复与冲突。
3. 确认一致性：preview 后所选来源/规则/Case 变化拒绝；仅解析时间变化不误报；旧快照恢复不重新替换来源。
4. 前端：行动切换保留选择，默认不选来源，前次检查依赖当前检查；缺失与失败分开；确认勾选守卫，保存中禁用重复提交；unknown 恢复、sessionStorage 不可用、权限变化。
5. 已保存视图只读，新建另存不会覆盖；刷新和历史列表重进得到同一版本。零行动、没有实施记录、全部可选来源缺失及 GA4 withheld 明确展示。
6. BFF：认证、同源、受限请求/响应、超时、禁止重定向、默认关闭开关及 no-store；避免请求中注入 owner 身份。
7. 回归：既有复核投影、证据存储、实施记录、页面检查、GSC/GA4 阅读和契约导出校验；执行相关前端测试、类型检查及构建，报告实际结果，不把未跑检查写成通过。
8. 浏览器：桌面与窄屏的正常选择/确认/保存/回看，键盘和焦点、长文本/多来源阅读及错误反馈。测试使用本地夹具，不调用付费生成。

本批完成标准是证据准备闭环可用，不是 P5-03 全部完成；SEO 决定、复核生成和交付仍作为后续独立批次。

## 12. 自审记录

已核对：原型与生产行为的差别、历史精确读取、确认与保存的一致性、未知结果恢复、只读快照、开关/权限及非收费边界；没有占位需求。未修改旧证据契约，也未将 checksum 当作权限证明。

用户于 2026-10-27 确认本文件后开始接线。当前可用技能目录未提供 writing-plans，已说明并使用项目既有实施清单形式替代。实现与验收记录见 `../plans/2026-10-27-v22-capability-p5-review-workspace-verification.md`。
