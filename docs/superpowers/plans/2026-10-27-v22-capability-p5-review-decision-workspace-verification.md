# P5-03 第五批：决定工作区本地验收

日期：2026-10-27。依据用户确认的 [工作区设计](../specs/2026-10-27-p5-review-decision-workspace-design.md)。本批实现完成，默认关闭；不代表 P5/P6 完成或已经上线。

## 已完成

- 独立私有决定页面、原证据工作区的真实状态入口、内部 HTTP API 及所有者 BFF。读取精确冻结快照，展示原批准工作、实际来源、时间、范围与限制；不向浏览器发送完整底层包、原始供应商载荷或私有实施备注。
- 三栏编辑，四种原行动决定和独立新增工作；清除、删除、条件字段、引用关联、字符/字节上限、最多三项非暂缓决定、部分/空保存和零行动诊断。
- 明确确认后保存，成功后只读；历史分页及精确读取，从最新保存版开始新草稿，旧版不能被覆盖。
- 请求结果未知时保留原请求 ID 核实或原样重试；刷新只核实、不自动重发；STALE 保留草稿并阻断盲目保存；访问失效清除私人状态。
- 私人文本仅驻留内存。sessionStorage 只保存五个身份/请求编号；离开链接、刷新和关闭有未保存提醒。原生确认对话框、字段错误聚焦、键盘控件、390px 排版与页内跳转。
- 修复成功写入后回执无法校验/过大时的错误分类，按结果未知处理，避免诱发新请求。页面和接口不缓存，页面无引用来源泄露并禁止索引。

复用第四批不可变决定表与三个 RPC，未新增迁移。保存决定不触发采集、报告生成、发送、PDF、队列或扣点。

## 实际验证结果

| 检查 | 结果 |
| --- | --- |
| 前端全量 | 195 个文件，2,266 项通过 |
| 后端普通回归（排除两类集成标记） | 3,190 项通过，208 项另行验证 |
| 隔离原生数据库/Redis 全量 | 208 项通过，3,190 项另行验证；PostgreSQL 17.10，73 个已有迁移 |
| 决定与工作区定向后端 | 84 项通过 |
| 新工作区 + 既有决定原生测试 | 14 项通过，已包含于上述 208 项 |
| 类型检查及生产构建 | 通过，新页面及 API 为动态路由 |
| 决定/证据工作区/复核内容三组双端契约 | 通过 |
| 真实 Next 页面浏览器验收 | 桌面 1440px、手机 390px 通过，无页面横向溢出 |
| 两仓库 diff 空白检查 | 通过 |

最后将 GA4 未限定落地页的来源说明改为可读的 `All landing paths`，重新导出并校验双端契约；工作区后端 24 项、决定前端契约/交互 40 项复验通过。此改动只影响来源说明，不改变证据、请求或计费规则。

浏览器使用本地测试身份和合成 API 响应，验证焦点、条件字段、保存确认、只读历史、从最新编辑、丢失回执后的刷新核实、冲突保留及新增移除。它不冒充真实账户端到端测试。独立原生测试覆盖 HTTP → 服务 → 实际隔离数据库，包括旧版读取、第二版、冲突以及原证据/报告/实施/账本不变。

浏览器脚本：`e2e/review_decisions_browser.py`。截图：`output/playwright/review-decisions/{decisions-desktop,decisions-saved,decisions-mobile,decisions-conflict-mobile}.png`，均为合成内容。浏览器测试没有外部请求；临时测试服务器已停止。仅测试进程设置本地身份/开关，未修改环境文件。

首次宽泛后端命令混入需要独立 Redis 的测试，得到 3,198 通过、185 跳过、1 失败和 14 环境错误；随后按标记分开执行，普通 3,190 和原生 208 全部通过。初次浏览器启动受本地环境中的 Vercel 标记阻断，后以明确本地进程配置运行，未放宽应用保护。过程中修复窄屏长来源文本溢出、更新新增私有路由的响应头断言，并重跑相关验证。尚有依赖库弃用提示，不影响通过结果。

## 重现

后端：

```sh
.venv/bin/python -m pytest -q -m 'not redis_integration and not native_integration' --tb=short
.venv/bin/python scripts/export_v22_review_decisions.py --check --frontend-dir ../search-trust
PYTHONPATH=/tmp/searchtrust-review-workspace-4NHG19/python .venv/bin/python scripts/run_v22_native_integration.py --postgres-bin /tmp/searchtrust-review-workspace-4NHG19/node_modules/@embedded-postgres/darwin-arm64/native/bin --redis-server /tmp/searchtrust-native-q8vE6T/redis-7.4.2/src/redis-server -- tests --tb=short
```

前端：`npm run typecheck`、`npm test`、`npm run build`。浏览器测试以本地 Next 测试进程运行，四个能力/实施/证据/决定开关仅进程内开启；设置 `VERCEL_ENV=''`、`NEXT_PUBLIC_E2E_TEST_MODE=true` 和明确 loopback base URL。Python Playwright 使用对应 Python 3.12 运行时。

## 保留与后续

实施前基线：`../.v22-capability-baselines/baseline-P51DPk`；manifest SHA256：`ac75d817c0721e365b8bdca19018d7fd401b00560548c5f2b464b32ef8b0f4b9`。

实施后基线：`../.v22-capability-baselines/baseline-5jhKpm`；manifest SHA256：`3b24547a3f587854b049e52fe4f91e088fa0c1938160be2222a214ffecf5cc0c`。两仓库 HEAD 未变，无此前捕获的源文件缺失；已有文件的改动仅涉及本批入口、响应头、配置/路由、决定回执保护、相关测试与主计划。此验收记录的最终结果元数据在该次捕获后补充。

已有未提交工作保留；未提交实现代码、未执行生产迁移或部署、未开启实际功能、未调用真实采集或模型。`V22_REVIEW_DECISIONS_WORKSPACE_ENABLED` 前后端均默认关闭并依赖原有开关。

下一批是让新版 Verified 生成明确消费冻结证据与指定决定版本，并接入单次结算及可交付版本。实际账户验收、效果资格校准和 P6 发布仍未完成。正常交付但依据不足的诊断报告仍收取 1 点且不返还；本批保存决定免费。
