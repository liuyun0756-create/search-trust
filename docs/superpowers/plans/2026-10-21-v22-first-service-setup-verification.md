# P3 首次服务准备入口验证

状态：本地准备层已实现；付费首次服务未开放、未部署。设计见 [准备入口说明](../specs/2026-10-21-v22-first-service-setup-design.md)。

## 实现

- 独立客户选择、新增和数据准备页面；所有新页面默认关闭且必须认证。
- 复用公共业务匹配及现有 Case 保存，保留重试 UUID、阻止并发提交、重复客户不覆盖；归档恢复须用户点击。
- owner + active 校验、原 Prospect 转服务分流、新版已完成报告分流。客户列表分页和失败提示。
- 独立连接准备投影，不传旧 Prospect 依赖或收费动作。Google 授权后返回准备页面。保存公开 GBP 链接与实际证据状态明确区分。
- 首次分析按钮始终禁用，不发报告、发现或支付请求。收费文案保持已完成零行动不返还。

## 验证方式和覆盖

自动化新增覆盖：默认关闭及组合门禁；未认证、异主/不存在、归档、格式错误 Case；按 owner 读取、无 Prospect 客户列表、失败不伪装为空、分页；原流程/新版报告分流；无收费投影；共享业务匹配、重复和丢响应重试、双击、错误创建回执、显式恢复；准备页无自动启动、刷新；OAuth 返回路径枚举及真实授权服务回调保存目的地。

浏览器：1280px 桌面与 390px 手机运行真实 React 准备组件，模拟 preflight/Case/resource HTTP 和路由外壳，使用生产构建 CSS。覆盖输入网站、确认业务、保存、连接页刷新与重载；只允许 preflight 和 Case 两次 POST，没有支付/发现/分析请求，没有外网请求和脚本错误，没有横向溢出。截图已人工检查。这不是真实 Google OAuth、数据库客户创建或认证环境的浏览器端到端。

另保留 7 项原报告/分享回归，其中 4 项隔离数据库报告交付测试加载现有全部 52 个迁移。本轮没有迁移或 BE 修改，未把既有后端测试结果称为本轮重跑。

复现：

```sh
npm test
npm run typecheck
npm run build
npx playwright test e2e/first-service-preparation.spec.ts e2e/capability-database-journey.spec.ts e2e/prospect-report.spec.ts e2e/report-sharing.spec.ts e2e/capability-share.spec.ts --workers=2
npm run security:scan
git diff --check
```

最终结果：160 个文件、1,622 项测试通过（原 1,593 项，本轮新增 29 项）；类型检查和生产构建通过。9 项浏览器检查通过（新增准备流程 2 项 + 原报告回归 7 项）。新增准备流程在最后一次测试夹具 Case ID 对齐后又单独复跑 2 项通过。安全扫描 44 个文件、0 finding、secretValuesChecked=0，仅为本地测试产物扫描，不代表生产密钥审计。两仓库空白检查通过。

一次类型检查与浏览器启动并行时，Next 开发服务重建 `.next/dev/types` 导致 TS6053（生成文件临时不存在）；没有修改源码规避检查。待浏览器服务结束后串行重跑 `npm run typecheck` 通过。后续同仓库类型检查与 Next 开发服务启动应串行。

## 生产边界 / 下一项

新增准备开关 `V22_FIRST_SERVICE_SETUP_ENABLED` 默认 false，与公共入口和 Google 开关共同生效。本次未设置任何实际开关、未创建真实客户、未发真实授权、未扣点、未远程执行迁移或部署。准备路径公开前还需要配置及真实环境验收。

付费入口仍缺：竞品发现与唯一 verified 预留的协调、人工确认阶段恢复、开始时重验与明确确认。这项依赖不能用旧付费 Prospect 入口代替。因此 P3 及全产品完成项仍不勾选。

## 变更保护

开始基线：`/Users/liuyun3/Documents/SearchTurst前后端/.v22-capability-baselines/baseline-ai2XQI`，SHA256 `d189f4fffb0c8f86332b14a0e8c682223ce80e26f4be9e704e07e61ce8157238`。FE HEAD `88890cd484ad1a5f9294b1f21bb5a47bc27f5b7a`；BE HEAD `9bf2090b91d5ee036f8ea7e470797761b8cf838c`。保留既有大量未提交变更，不提交或重置。

结束基线：`/Users/liuyun3/Documents/SearchTurst前后端/.v22-capability-baselines/baseline-pxXffv`，SHA256 `4106ebd3dc25836718d7b8e2f5ed7ab87d19f40dda502a7a8fee66cc80a12478`。捕获文件哈希比较仅 FE 23 个本轮入口/组件/测试/文档文件变化；BE 0 变化。未触碰其他既有捕获变更。本验证文件的类型检查竞态说明和本段为捕获后唯一补录。
