# P1-01：Firecrawl Map v2 与 Local Pack 身份归一化

日期：2026-11-16。负责人已确认两项根因并授权一起修复、备份后走 PR/CI 发布。本轮不采集、不扣费、不冒烟，不改开关、SQL、freeze 逻辑或报告判定规则。

## 改动

- Firecrawl Map 专用路径统一为 `/v2/map`，兼容配置中现有的 `/v1`、`/v2` 或无版本 base。共享 `FIRECRAWL_API_URL` 及已有渲染 `/scrape` 路径不变，避免连带改变尚未授权的渲染协议。
- 成功响应顶层仅允许 `success/links/warnings/replacement`；兼容字符串链接及 `{url,title,description}` 对象链接，仍保留响应体大小和链接数量上限。未知顶层字段继续拒绝。
- Map 日志仅记录 failure_stage、HTTP status、异常类型、job ID 后 8 位、耗时和 warnings 数量。失败阶段区分 disabled/network/http/json/schema；成功为 none。未记录 key、URL、响应正文、warnings 内容或异常消息。任务上下文使用 ContextVar，退出后复原，checkpoint 结构不变。
- 仅针对 Google Local Pack：纯 ASCII 数字 place_id 在没有 data_id 或与 data_id 推导的 CID 一致时写入 provider_cid、清空 provider_place_id。显式 CID 与之冲突时不覆盖。原始字段仍保留在 provider checkpoint 中，通过 response_checksum/call_id 追溯。
- position-only 无名条目单独记录 `SERP_LOCAL_PACK_UNNAMED_RESULT`；其他缺名称结构及具名无 URL 仍记录 RESULT_SKIPPED。没有具名记录时仍为未检查；不放宽业务身份冲突或缺失 URL 的处理。
- parser 版本从 `serp_market_v3` 递增为 `serp_market_v4`；缓存 UUID 派生公式、旧键、已冻结 payload/schema/checksum 不变。覆盖 v2/v3 缓存与历史 pinned snapshot 的兼容测试。
- 前端仅新增无名条目 limitation 的英文阅读映射及测试，避免把内部标记直接展示给客户；未修改页面流程。

## 离线回归

使用成功任务 `bef66e51-eca9-47c9-82cd-1b2def549788` 的既有 SERP checkpoints。另从本次完整备份的 COPY 数据在本地重建原始 manifest、recipe 和全部证据 payload，执行 validate_generation_input 成功，原始关键词结果复现为三词均 not_checked/parse_incomplete。

随后只在内存中的派生 SERP 上重跑当前解析，调用真实 build_keyword_visibility 和原有 GBP 身份门槛，未 mock `_profile`，未调用 SQL 或 provider：

| 关键词 | 修复后 Local Pack 状态 | position | 原因 |
|---|---|---:|---|
| Plumber Fresno | observed | 4 | observed |
| best Plumber Fresno | not_detected | — | first_page_absent |
| Plumber near me | observed | 3 | observed |

已检查 3/3，观测到 2/3，按已批准阈值评估 strong。六份 provider checkpoint 的 checksum 校验通过；原冻结请求及备份/checkpoint 文件哈希不变；网络审计阻止 socket 连接，实际 network_attempts=0。没有把派生结果写回原快照、数据库或已有报告。

提交的脱敏夹具仅保留本次三词的位置和缺字段结构；替换商家名称、URL 和身份 ID，删除地址与电话。Firecrawl v1 夹具依据负责人确认的返回形状重建，不冒充原始响应归档；v2 按官方返回结构构造，未调用 Firecrawl 创建夹具。

## 自测

- 相关后端：`PYTHONPATH=. "/Users/liuyun3/Documents/SearchTurst前后端/SearchTrust-RD/.venv/bin/python" -m pytest -q tests/test_v22_site_inventory_firecrawl.py tests/provider_contracts/test_firecrawl_contract.py tests/test_v22_local_pack_identity.py tests/test_v22_local_pack_urls.py tests/test_v22_local_pack_wrappers.py tests/test_v22_market_parser_cache.py tests/test_v22_site_inventory_stage.py tests/test_p1_01_keyword_visibility.py --disable-socket --allow-unix-socket`：**112 passed**。
- 覆盖 v1 warnings/replacement、v2 对象链接、401/402/429/500/502/503/504 的 http 阶段、network/json/schema/disabled 分类、敏感日志不泄漏、任务上下文复原及 checkpoint 重用、CID 一致/冲突和 Maps/organic 不变。
- 前端相关 `npx vitest run src/lib/report-capability/reader-copy.test.ts`：**8 passed**。
- 首次前端默认并行全量：2773 passed、11 skipped，未修改的 v22FreezeTimeout.test.ts 一项 PGlite 初始化超过既有 5 秒超时。未改测试、断言、配置或超时；改用 `npm test -- --maxWorkers=2` 重跑同一全量：**2774 passed、11 skipped**。
- 后端 `PYTHONPATH=. "/Users/liuyun3/Documents/SearchTurst前后端/SearchTrust-RD/.venv/bin/python" scripts/run_v22_backend_quality.py fast`：**4317 passed、16 skipped、265 deselected**，327.63 秒；使用脚本自带的 disable-socket 限制。
- 前端 `npm run typecheck` 与 `npm run contracts:check`：**退出 0**，生成合约无差异。

## 成本与验证边界

本轮 provider 调用、采集、收费启动和扣费均为 0。没有新增调用预算或打开开关；修复旨在让既有授权的 Map 调用返回值得到正常处理。部署后实际 Firecrawl 成功率和真实新采集的 Local Pack 结果尚未验证，本轮不会为此冒烟。

## 发布备份

目录：`.release-private/2026-11-16-map-firecrawl-backup/`，目录 700、文件 600，不提交。

| 文件 | 字节数 | SHA-256 |
|---|---:|---|
| roles.sql | 493 | 3583120bc9a33d58114e8fcbf7fb31f8913496318895f4317a26d6fb0b6e1dfb |
| schema.sql | 1,025,169 | fde806bbaf25940bf598982d9c0736589ca938d1744d902252f141a70b57db70 |
| data-retry.sql | 58,667,611 | efc6aa7af7f75154663a000466d1c6935020ef8a1a7552e0f862dc548e1bb7a6 |

第一次 data 导出在 data_snapshots COPY 时 SSL EOF、退出 1，停止并请示；负责人授权仅重试一次后成功，退出 0。manifest.complete=true，指定上述三份有效备份；首次部分 data.sql 保留但不是完整备份。data-only 的循环外键警告已记录，恢复需配合 schema 并安排触发器/约束顺序。

## 待决问题

无。本次只执行负责人明确授权的两项修复；没有其他采集、规则或性能改动。

## 发布结果

待两边本地验证及 PR CI 全绿后合并，并核对 Vercel、Railway Web、Railway Worker 的部署 commit/ID。本次没有迁移。
