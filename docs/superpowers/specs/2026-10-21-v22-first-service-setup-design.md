# P3 首次服务客户与数据准备入口

沿用已批准主计划 §8 的客户选择、创建和数据准备，不改变报告规则或 D1 计费政策。这是准备层接线，不是首次服务付费入口完成。

## 调查结论与边界

- 现状：`/cases/service` 只列出完成旧 Prospect 的客户，Connection Center 的公开 GBP 和总体 readiness 也依赖父 Prospect。
- 关键约束：现有公开竞品发现通过 `prospect-workflow` 先预留 Prospect 点数；首次服务的内部启动则要求已确认竞品。因此直接复用发现按钮会有错误收费路径，不能暴露为首次服务可用。
- 本轮新确认：Google 授权、资源绑定、身份确认和 GSC/GA4 同步本身不要求 Prospect；Case 创建/恢复也不收费。可复用这些已实现能力，不修改旧 Verified 的父报告约束。
- 基于以上判断：本批交付独立的免费准备页。只显示客户、资源健康和下一步限制，不生成虚构 Prospect、不自动扣点、不调用竞品或分析入口。

## 路由与交互

1. `/cases/service` 在准备开关允许时显示新入口。原有 Prospect 转服务名单和行为保持不变。
2. `/cases/service/prepare` 按认证 owner 分页列出 active Cases，无 Prospect 过滤；可选现有客户或新增客户。
3. `/cases/service/new` 复用 preflight 与业务匹配表单。网站、业务、服务、区域和公开 GBP 经 SEO 确认后使用现有 Case POST 保存。仅改变共享表单的可选按钮标签，默认仍是旧文案。
4. 网络失败重试保留同一个草稿 UUID；双击被本地请求锁阻止。重复 Case 不自动覆盖，提供明确继续入口。归档 Case 仅在点击恢复后调用现有 owner 校验的 PATCH `{status:"active"}`，不更改其业务信息。
5. `/cases/:id/service-setup` 认证、校验 UUID、验证 active owner Case，读取连接状态。已有旧 Prospect 继续原 Connection Center；新版能力入口启用且该 Case 已有完成报告则进入报告，不当作全新首次诊断。
6. 准备页为三步进度：客户保存 → 数据连接 → 尚未开放分析。展示保存范围、公开 GBP 链接（证据待采集）、GSC/GA4 状态、覆盖区间及资源选择。
7. GoogleResourceSelector 只增加受限返回目的地枚举，默认旧 `connections` 不变；首次服务授权回到 `service-setup`。授权回调不会启动分析。

## 数据与收费约束

- 仅投影既有 Connection Center 的 GSC/GA4 源级健康；不传旧父报告 blocker、扣点 action、任务/报告正文或供应商原始内容。
- 资源健康不是首次服务可执行回执。公开来源、竞品、快照时效、业务版本、预算与余额必须在后续真正开始时重验。
- 保存一个 GBP URL 不代表公开证据健康；页面明确写 link saved / evidence pending。
- 分析按钮始终 disabled。没有新收费 API、数据库迁移、远程供应商路径或服务任务派发。
- 已完成零行动诊断消费 1 点、不返还；技术失败只返还一次的既定政策继续显示，不由准备页执行结算。

## 发布及下一项

新增 `V22_FIRST_SERVICE_SETUP_ENABLED`，只接受 `true`，默认关闭，同时要求 `V22_PUBLIC_ENTRY_ENABLED` 的现有判定及 `GOOGLE_CONNECTIONS_ENABLED=true`。仅可开放准备，不代表付费首次服务可用。本次不改任何实际环境变量。

下一项：单次 verified 预留与真实竞品发现衔接，处理人工确认期间的截止时间、取消/失败补偿、页面重载恢复、同一请求幂等，再接“使用 1 点开始”明确确认。不能借用旧 Prospect 预留或未经成本边界的免费竞品发现来绕过。

原生 PostgreSQL、Redis、真实 Google/Clerk 以及生产全链路验收仍保留；本批不关闭 P3。
