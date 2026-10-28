# P3 首次服务付费确认与候选确认入口

日期：2026-10-21。接续已批准主计划；设计见 [入口设计](../specs/2026-10-21-v22-first-service-entry-design.md)。本轮完成默认关闭的入口代码，不部署、不启用、不执行远程迁移。

## 实现范围

- 在已有免费数据准备页增加“确认范围与 1 点 → 查看发现 → 确认竞品 → 准备诊断”步骤。只有明确同意后的点击可以预留；打开页面、轮询和刷新不收费。
- 新 owner API 严格限制字段、同源、请求体大小与动作。GET 不触发采集，浏览器只收到安全元信息和候选摘要，不接收私有来源载荷或原始错误。
- 请求发送前保存在当前账号/Case 的 sessionStorage。断网、服务器结果不明时保留原操作键，重新读状态可恢复已提交操作，不自动重新收费。不能保存意图时不发送付费请求。
- 竞品确认只允许后台记录中的 1–3 个候选。服务端生成完整规范化请求，第 57 个迁移在同一事务中保存业务范围、复用原预留、登记采集；失败全部回滚。同请求重放不产生第二份范围、任务或扣点，旧发现不能确认新结果。
- 页面接入同点数补充与过期刷新；显示三次发现执行总上限、候选资格限制、预算用尽提示。没有适合竞品时不承诺报告可以继续，不自动补扣或伪造技术失败。
- 核查发现原准备执行器已存在，但登记后缺少自动发布到采集队列的调用者。本轮补齐服务端恢复查询和 worker 定时接线。原任务 ID、代数、截止时间、尝试/成本预算不变；有效租约不重复执行；已冻结输入只接续正式派发，完成/过期任务不再入队。每分钟恢复标识避免 ARQ 保留的失败记录永久阻断原任务，实际执行仍由 SQL 租约裁决。
- 正常完成但无行动仍交付并消耗 1 点、不返还；技术失败沿用一次补偿。旧 Prospect 和旧 Verified 父报告约束不改。

## 验证结果

- 前端全量：166 文件、1,737 项通过。包括首次服务 SQL 70 项、HTTP 17 项、服务端投影 14 项、入口开关 1 项和新交互 7 项。
- 后端定向准备/执行/恢复 48 项通过；非 Redis 集成全量 2,196 项通过、23 项按标记排除。
- 曾尝试不排除 Redis 的全量运行，得到 2,204 通过、14 个环境准备错误、1 个失败；均因未配置测试专用 `V22_TEST_REDIS_URL`。没有绕过网络保护或连接实际 Redis；不能称原生集成已通过。
- 11 项浏览器测试通过。新 1280px / 390px 两项使用真实 UI、处理器、仓储、Supabase 客户端，经受控传输连接加载全部 57 迁移的隔离 PGlite：扣点提交后丢失响应、确认登记后丢失响应，刷新恢复原任务；仅一笔 verified_debit、一个采集登记、一个分析任务。其余 9 项覆盖免费准备、编辑/批准/PDF/分享、零行动交付和旧报告回归。
- 两份浏览器实际生成的采集请求交给 Python 后端模型解析，其规范化字节与数据库保存内容完全一致；这验证契约衔接，不代表真实供应商采集已运行。
- 人工查看桌面确认页和手机候选页截图，无水平溢出；浏览器无页面脚本错误、无外部请求。沿用现有工作台视觉样式。
- 类型检查与生产构建通过；双仓库空白检查通过。安全产物扫描 56 文件、0 findings；`secretValuesChecked=0`，不代表真实凭据集合已审计。

浏览器测试首次暴露并修正 NextURL 的 localhost 归一化引起的同源误拦截，测试传输补齐线上的 Host 头；另修正仅允许字母的测试参数白名单（GA4 含数字）、快照不可变/截止时间约束对应的测试数据及欢迎点数账本预期，没有放宽生产校验。确认请求的未知传输错误保留为可恢复的 503，不错误当作已知拒绝清除意图。

## 复现

```sh
# search-trust
npx vitest run
npm run typecheck
npm run build
npx playwright test e2e/first-service-entry.spec.ts e2e/first-service-preparation.spec.ts e2e/capability-database-journey.spec.ts e2e/prospect-report.spec.ts e2e/report-sharing.spec.ts e2e/capability-share.spec.ts --workers=2
npm run security:scan
# SearchTrust-RD
.venv/bin/python -m pytest -m 'not redis_integration' -q --tb=short
```

构建与浏览器服务串行，避免共享构建目录冲突。网页测试技能回退到本项目既有 TypeScript Playwright 套件（本机 Python Playwright 不可用），未安装新依赖。

## 关闭方式与剩余工作

FE 新开关 `V22_FIRST_SERVICE_ENTRY_ENABLED` 只有精确 `true` 生效，同时要求免费准备、公共入口、Google 连接与能力派发开关。关闭此新开关即可隐藏付费组件并令 API 返回 404，免费准备仍独立保留。BE 自动接续仅在既有能力执行/采集器就绪且 `V22_FIRST_SERVICE_DISCOVERY_ENABLED` 启用时挂载；原任务的既有期限补偿继续保留。实际环境值完全未改。

下一批：把本轮浏览器入口与后台实际生成管线、完成报告、编辑/批准和 PDF/分享连成同一隔离验收，再覆盖补充/刷新、权限变化及预算阻断的浏览器故障链路。当前新浏览器测试止于“已登记采集/准备诊断”，没有冒充完整付费端到端。

公开前仍需获授权的原生 PostgreSQL/Redis 并发、真实 Google/供应商、身份和成本验收，以及明确耗尽/账本过期的运维处理。不要先开放 FE 收费开关再补 BE 配置。P3 不标整体完成，P2 真实环境门槛与 P4–P6 未完成项仍保留。

## 工作区保护

开始基线：`/Users/liuyun3/Documents/SearchTurst前后端/.v22-capability-baselines/baseline-dCWAWe`，manifest SHA-256 `5f2e026312ebc78f4c4797cbde40a86f17ac9cf99c2604d1f560523292fd0a54`。FE HEAD `88890cd484ad1a5f9294b1f21bb5a47bc27f5b7a`，BE HEAD `9bf2090b91d5ee036f8ea7e470797761b8cf838c`。保留原有脏工作区，不 reset、不提交。

结束基线：`/Users/liuyun3/Documents/SearchTurst前后端/.v22-capability-baselines/baseline-WsVrzC`，manifest SHA-256 `afbcb40f2fca836c4b754e1f39e4e7a6bedd735cec337c797ab24205629742e3`。FE 捕获 333 / 排除 33、BE 捕获 105 / 排除 0。对比开始快照的逐文件哈希，仅本批 FE 21 文件及 BE 3 文件变化，其他已捕获文件未变；本段为结束快照后的唯一补录。最后补充已冻结任务恢复/完成任务不再扫描的断言，SQL 70 项再次通过。
