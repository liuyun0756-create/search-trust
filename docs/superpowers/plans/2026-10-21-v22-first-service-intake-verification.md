# P3 首次服务启动基础验证

日期：2026-10-21。依据已批准主计划 §4.1、§8；范围见 [设计](../specs/2026-10-21-v22-first-service-intake-design.md)。状态：内部启动基础本地验证，不是整个直接服务功能完成。

## 现状调查与本批边界

检查了 `/cases/service`、旧 Verified 启动仓储及连接中心：三处仍要求 Prospect 父报告。现有 2.2.2 契约、服务生成器和结算已经能够表达 first_service、previous_report=null、首次版本和零行动。因此本批新增独立启动准备，不通过删除旧父报告校验来绕过数据检查。

新增：

- `supabase/migrations/20261021160000_start_v22_first_service_preparation.sql`。
- `src/lib/report-capability/first-service.ts` 及内部边界测试。
- `src/lib/database/v22FirstService.test.ts`，加载全部 50 个实际迁移到隔离 PGlite。

没有新增公开 API、UI、后台采集队列或生产配置。新表不向浏览器角色开放；服务端只能通过 RPC 启动，不允许直接改准备记录。后端仓库本轮不改、不重跑其测试。

## 已实现

1. 当前 owner/active Case、当前确认业务版本、1–3 个竞品和公开 GBP URL 检查。业务重点可为 null，不推断客户优先级。业务身份和来源范围被固定。
2. GSC/GA4 必须是所选有效绑定的最新快照；不回退到更旧健康快照。核验确认者、匹配状态、健康、完整只读授权范围、有效期、覆盖日期和资源 ID。任何门槛失败不扣点。
3. 同一事务创建 verified_report 任务、准备记录、统一 verified_debit -1。无 Prospect 报告、无旧 analysis_attempt_charges、不创建假的父报告。
4. 相同身份/键/输入重放返回同任务、原截止时间及当前状态；成功、失败重放均不再扣点。新请求不能冒用旧键；有效首次服务与 Prospect 预留相互排斥。
5. 冻结清单必须匹配已绑定的业务和两个私有快照；recipe 必须匹配业务身份、地区、竞品。仍需通过已有全部公开来源及生成输入检查。首次服务不能走旧报告落库链。
6. 输入冻结后、解析/派发前再次检查权限。失去授权阻止新执行；已经完成的交付仍可读取，避免将断开来源误当成撤回已交付报告。
7. 原有到期恢复 RPC 包含新增的 pre-manifest 任务，不重置 20 分钟预算。超时事务返还一次；已完成诊断消费与迟到失败返还互斥。

公开 GBP URL 只是本批开始前的已选资料要求，**不是健康公开 GBP 快照**。公开抓取、SERP/竞品及 GBP 采集和核验必须在同一已付费工作流后续准备中完成；准备记录本身不能作为生成报告的输入。

## 验证

前端完整测试：154 个文件，1,584 项通过（比此前增加 43 项：24 项 SQL、19 项仓储）。类型检查、生产构建通过。最终代码上的 7 项既有浏览器交付回归通过（其中 4 项使用全部 50 个迁移的隔离数据库）；这是既有交付回归，不是首次服务新 UI 验收。安全扫描 41 个文件、0 finding、secretValuesChecked=0，不声称完成生产密钥审计。两仓库 diff 空白检查通过。

重点用例：无历史首次启动、原样重放、固定截止时间、缺范围/失效授权/未确认/错误身份/不健康/过期/未来/缺覆盖/错误资源、旧快照拒绝、跨 owner/跨 Case 快照、旧业务版本、零余额、输入冲突、第二个有效任务、与 Prospect 双向重复收费保护、插入故障导致全事务回滚、清单替换快照拒绝、Case 身份变化、recipe 业务被替换及回滚、零竞品、授权在冻结后改变、零行动消费、成功重放、迟到返还拒绝、pre-manifest 到期返还和明确新尝试、浏览器角色拒绝、准备记录不可变。

成功 SQL 用例通过 service_role 实际调用启动函数，再执行实际 prepare / dispatch / complete。测试来源和报告为最小合成契约对象；并未运行真实采集器或生成器。Promise.all 重放在 PGlite 内执行，不作为原生多连接并发、锁竞争或生产认证验收证明。

初跑的失败来自测试夹具：复用 UUID/text 参数、试图修改不可变快照、撤销授权未清空全部 token 字段、构造不合法确认者、截止时间早于创建时间。改为合法边界输入/新快照与正确状态变化；保留已有数据库保护，不放宽生产校验。错误身份变更会被现有授权失效保护提前拒绝，测试明确断言该路径。

复现命令：

```sh
npm test -- --reporter=dot --silent
npm run typecheck
npm run build
npx playwright test e2e/capability-database-journey.spec.ts e2e/prospect-report.spec.ts e2e/report-sharing.spec.ts e2e/capability-share.spec.ts --workers=2
npm run security:scan
```

## 尚未完成

下一批接入首次服务公开证据采集/准备协调器及队列，复用本次任务/点数而非另开 Prospect。随后接已有 Case 选择/新增客户、连接中心 first_service 状态、显式“使用 1 点”按钮及浏览器恢复。首次服务的真实采集、后端任务、身份登录、原生 PostgreSQL/Redis 和生产环境验收尚未完成，不能宣布 P3 完成或开放营销承诺。

## 变更保护

开始基线 `/Users/liuyun3/Documents/SearchTurst前后端/.v22-capability-baselines/baseline-PHrFvZ`；摘要 `6a73c0827c4c8caf877cdc81238526ebba8ad5b327d8e7829bc1be0b9158a159`。FE HEAD `88890cd484ad1a5f9294b1f21bb5a47bc27f5b7a`，BE HEAD `9bf2090b91d5ee036f8ea7e470797761b8cf838c`。保留全部既有改动，不提交、不开关、不远程迁移、不部署。

结束基线 `/Users/liuyun3/Documents/SearchTurst前后端/.v22-capability-baselines/baseline-qkWatd`；摘要 `9b0662145242914b82fb5b1b84788a952c568afcc1229304bcfa084dc6a4ad11`。捕获文件哈希比对：FE 仅上述迁移、仓储与两个测试、设计/本记录/执行主文档/台账共 8 个文件变化，BE 零变化。本段为捕获后唯一补录。
