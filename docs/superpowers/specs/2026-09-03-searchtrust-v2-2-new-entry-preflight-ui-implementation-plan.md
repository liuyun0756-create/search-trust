# SearchTrust v2.2 新入口与预检 UI 实施计划

日期：2026-09-03
里程碑：V22-040
依据：`2026-09-03-searchtrust-v2-2-new-entry-preflight-ui-design.md`
状态：设计已批准，开始实施。

## 1. 实施原则

- 先修订后端 1—3 家竞品合同并重新导出，再让前端使用新基数。
- 每个阶段先补失败测试，再做最小实现并运行相关回归。
- 浏览器只访问同源 Next.js API；内部令牌只存在于服务端。
- 匿名草稿可以恢复，但不能证明用户归属、付款或正式分析授权。
- 不启用生产开关，不调用真实供应商，不推送或部署。
- 保留 v2.1 历史报告、PDF、Credit 与已有报告入口；只把新建入口引导到 v2.2。

## 2. 阶段一：后端竞品数量改为 1—3 家

### 2.1 先写边界测试

在 `SearchTrust-RD` 增加或调整测试，覆盖：

- `AnalyzeRequest` 接受 1、2、3 家，拒绝 0、4 家和重复 ID/网站；
- 发现结果 1 家即可 `ready_for_confirmation=true`，0 家必须有 blocking gap；
- 选择校验接受发现候选中的 1—3 家，拒绝空选择、越界候选、篡改身份和重复域名；
- 网站与公开资料采集阶段接受 1—3 家；
- `CompetitorCollectionSnapshot`、`EvidenceBuildContext` 和 `CompetitorAnalysis` 接受 1—3 家；
- 固定供应商总预算仍不超过三家时的现有 15 次上限；
- 依赖至少两家一致证据的 Finding 在只有一家时不触发，并写入 limitation；
- 三家现有 fixtures 与行为保持通过。

重点测试文件：

```text
tests/test_api_v2_contract.py
tests/test_v22_competitor_models.py
tests/test_v22_competitor_selection.py
tests/test_v22_competitor_site_stage.py
tests/test_v22_competitor_collection_stage.py
tests/test_v22_evidence_models.py
tests/test_v22_report_contract.py
tests/test_v22_findings_market.py
tests/test_v22_findings_boundaries.py
```

### 2.2 修改模型和确定性校验

修改：

```text
app/api/v2/models.py
app/api/v2/competitor_models.py
app/competitors_v22/models.py
app/competitors_v22/candidates.py
app/competitors_v22/selection.py
app/competitors_v22/site_stage.py
app/competitors_v22/collection_stage.py
app/report_v22/models.py
app/report_v22/evidence_models.py
app/report_v22/market_findings.py
```

引入明确的最小/最大常量，避免继续用单一 `COMPETITOR_COUNT=3` 同时表达下限和上限。所有唯一性校验按实际列表长度执行；0 家始终拒绝，1—2 家形成明确覆盖限制。

### 2.3 更新合同产物

- 更新后端冻结 API/报告 Schema；
- 调整固定“三家”的示例文案为按实际数量或保持三家 fixture 的事实表述；
- 运行 `scripts/export_v22_contracts.py`，同步到前端；
- 前后端分别执行 `--check`/`contracts:check`；
- 确认旧三家 fixture 仍有效，并新增 1 家、2 家合同边界测试。

### 2.4 验证与提交

- 竞品专项测试；
- API v2 与报告合同测试；
- Evidence/Findings/Actions 回归；
- 后端全量测试；
- 单独提交后端受控合同修订。

## 3. 阶段二：受控草稿 Case UUID

### 3.1 前端 Case 合同测试

在 `search-trust` 扩展 Case 创建合同：

- 接受可选 `draft_case_id`，仅允许规范 UUID；
- 未提供时继续由数据库生成 ID；
- 提供时写入同一 Case 主键；
- UUID 冲突和重复域名/地点保持稳定错误；
- 未登录用户仍不能创建 Case；
- 更新和归档接口不接受该字段。

### 3.2 最小实现

修改：

```text
src/lib/cases/contracts.ts
src/lib/cases/normalize.ts
src/lib/cases/repository.ts
src/lib/cases/service.ts
src/lib/cases/handlers.ts
```

`draft_case_id` 只在认证后的创建入口转换为数据库 `id`。服务端不接受用户指定 `user_id`，不允许覆盖现有行，不做静默 Case 合并。

### 3.3 验证与提交

- Case 合同、规范化、repository、service、handler 测试；
- Supabase migration 回归；
- 前端类型检查；
- 单独提交草稿 ID 衔接。

## 4. 阶段三：严格前端合同与服务端代理

### 4.1 合同模块

新增 `src/lib/preflight-v22/`：

```text
contracts.ts
validate.ts
errors.ts
client.ts
draft.ts
state-machine.ts
```

覆盖 Preflight 请求/响应、Competitor discovery 提交/状态/重试、工作目标、业务确认、Coverage 映射和匿名草稿。优先复用重新生成的 v2.2 类型；运行时仍用 AJV 或小型显式校验器拒绝额外字段与错误枚举。

### 4.2 同源代理

新增：

```text
src/app/api/v2/preflight/route.ts
src/app/api/v2/competitors/discover/route.ts
src/app/api/v2/competitors/tasks/[id]/route.ts
src/app/api/v2/competitors/tasks/[id]/retry/route.ts
```

服务端代理：

- 从服务端环境读取 v2 API 根地址和内部令牌；
- 只转发白名单 JSON 与必要的 job/idempotency headers；
- 设置请求体、超时和 `cache: no-store` 边界；
- 不透传任意上游响应头或错误正文；
- 把 401/409/422/503 和网络失败映射为稳定前端错误；
- 日志只记录 route、稳定 code 和 request/job UUID。

若环境缺失，返回安全的 `V22_PREFLIGHT_NOT_CONFIGURED`，不默认调用线上生产服务。

### 4.3 测试与提交

- 合同合法/非法样例；
- 代理添加内部认证、严格转发和安全错误映射；
- 令牌不出现在响应或日志；
- 幂等提交与任务读取；
- 单独提交合同和代理。

## 5. 阶段四：匿名草稿状态机

### 5.1 状态与失效测试

覆盖：

- 新建草稿生成独立 UUID，不使用 `preflight_id`；
- 24 小时时效和 schema version；
- URL/GBP 修改清除全部下游；
- 商家/服务/地区修改只清除竞品和覆盖；
- 同一发现结果中更换 1—3 个竞品保留 discovery；
- 0 个竞品不能进入可继续 Coverage；
- 损坏/旧版本草稿只恢复安全目标和 URL；
- 页面刷新后用 job ID 恢复后端状态；
- 重复点击不创建第二个任务。

### 5.2 实现

- 使用 `sessionStorage` 保存经过验证的草稿；
- reducer/显式事件控制步骤，而不是在多个组件中分散修改；
- 保存前和恢复后均验证；
- 任务轮询使用可见页退避，终态停止；
- 组件卸载和输入失效时取消旧请求，忽略迟到响应。

### 5.3 验证与提交

- 状态机和草稿单元测试；
- 定时器、过期和请求竞态测试；
- 单独提交。

## 6. 阶段五：四步工作台 UI

### 6.1 页面与框架

新增：

```text
src/app/cases/new/page.tsx
src/components/cases/new-case-workspace.tsx
src/components/cases/new-case-stepper.tsx
src/components/cases/goal-website-step.tsx
src/components/cases/business-match-step.tsx
src/components/cases/competitor-confirmation-step.tsx
src/components/cases/coverage-step.tsx
src/components/cases/preflight-status.tsx
```

视觉方向：专业诊断工作台。深炭色顶栏、暖白/浅灰绿工作区、酸橙色只用于当前步骤与主动作；使用已有品牌字体基础，不为单页增加远程字体依赖。桌面端左侧步骤栏，移动端顶部紧凑进度。

### 6.2 Step 1

- 可访问的两目标 radio cards；
- 网站 URL 必填；GBP 链接默认收起；
- 单一 `Run free preflight`；
- 提交、错误和取消状态；
- 明确“不登录、不付款、不授权”。

### 6.3 Step 2

- 网站身份与公开 GBP 候选；
- 字段级 Exact/Partial/Not matched/Missing；
- 一侧缺失为不匹配、两侧必需信息缺失为错误；
- 可选择其他身份并编辑 operating model、service、location、market；
- 明确确认动作。

如果现有预检合同不能直接提供四字段比较所需的两侧原始值，本里程碑只展示后端确实返回的 `match_reasons`、候选事实和 gap，不由前端猜测字段级结果；缺少的字段级后端合同另列为阻断测试并做最小扩展。

### 6.4 Step 3

- 真实任务阶段和进度；
- 最多 6 个候选，默认最多前三；
- 明确选择 1—3 个，0 个禁用继续；
- 只有 1—2 个时显示 Limited；
- 0 个时必须提供至少一个补充网址并重新验证；
- 支持可重试失败和 24 小时过期。

### 6.5 Step 4

- 模块、来源、原因、gap、预计时长；
- 竞品实际数量与覆盖级别；
- 不渲染 Finding/Action/内部成本；
- 获客目标显示 `$19` 与登录衔接；
- 现有客户目标显示保存 Case 与连接准备；
- 本里程碑不发起实际支付或 OAuth。

### 6.6 可访问性与响应式

- radio、button、fieldset、heading 和 live region 语义；
- 可见焦点、键盘顺序、错误关联；
- 状态不只靠颜色；
- 移动端对比表变为标签卡片；
- reduced motion 下禁用非必要过渡。

### 6.7 测试与提交

- 每步关键渲染与交互；
- 错误、loading、retry、expired、empty/limited；
- 键盘与 aria 状态；
- 页面路由和草稿恢复；
- 单独提交 UI。

## 7. 阶段六：首页入口切换

- `AuditForm` 改为轻量 v2.2 启动器，收集目标与 URL 后导航到 `/cases/new`，或直接显示清晰 CTA；
- `RunAuditButton` 和 `openAuditForm` 的新建动作导航到 `/cases/new`；
- 报告内“重新审计”若属于历史 v2.1 语义，保留兼容入口或显式标注，不静默改变已存在报告操作；
- 移除首页新建流程中的 Credit、page type 和 Google 登录前置文案；
- 更新相关埋点为 mode selected、preflight started/completed；不记录敏感字段。

测试所有首页和营销页新建入口，同时回归 v2.1 报告操作。

## 8. 最终验证

### SearchTrust-RD

```text
竞品/API/合同专项测试
Evidence/Findings/Actions/Copy 回归
完整 pytest
合同导出只读检查
格式与 diff 检查
```

### search-trust

```text
npm run test:contract
npm test
npm run typecheck
npm run build
npm run contracts:check
git diff --check
```

再使用本地浏览器验证：

- 两种目标完整四步；
- 1、2、3 和 0 个竞品；
- 刷新恢复、过期、重试、迟到响应；
- 桌面与移动布局；
- 键盘操作和非颜色状态；
- Coverage 后两种正确分流；
- v2.1 历史报告入口无回归。

## 9. 完成口径

本轮完成只表示 V22-040 新入口、匿名预检、竞品确认、覆盖预览和下一阶段衔接已在本地实现并通过测试。以下仍不能宣称完成：

- V22-041 实际付款和 webhook；
- V22-042 完整报告阅读；
- V22-043 PDF/分享；
- Google OAuth/Connection Center；
- 生产功能开关、真实供应商联调、推送和部署。
