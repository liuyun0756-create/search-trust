# v2.2 数据库交付贯通验证

日期：2026-10-21。状态：隔离验证通过，未部署；不代表 P2 全阶段或生产环境验收完成。

## 本轮目的与改动

此前 SQL、处理器和浏览器分层测试分别通过，但浏览器主要读取固定响应。本轮把真实产品组件和数据库事务串起来，验证批准交付的一致性及失败边界。只新增测试设施、PDF 检查脚本和记录，不修改生产业务代码或后端代码。

- `e2e/integration/capability-database.ts`：应用全部 49 个实际迁移，创建隔离数据、真实仓储/处理器和本地 Supabase 传输，并提供可控故障注入。
- `e2e/integration/capability-browser.tsx`：挂载实际报告、owner 编辑、交付操作和客户分享组件。
- `e2e/capability-database-journey.spec.ts`：四项数据库支持的浏览器旅程。
- `scripts/inspect-v22-delivery-journey.py`：核验浏览器实际下载 PDF 的中文、执行材料、版本一致性和零行动状态。
- 将已存在的传递依赖 esbuild 0.28.2 显式列为开发依赖；没有升级生产依赖。

## 真实链路与替代边界

实际执行：SQL 预留/绑定/冻结/结算、幂等重放、正式修订读写、批准门槛、分享创建/撤销，真实 Supabase JS 请求序列化，真实应用处理器、仓储、React 控件及 PDF 渲染。SQL 查询在事务内使用 service_role。浏览器只允许本地测试来源。

受控替代：测试身份代替 Clerk；隔离 HTML 与刷新适配代替 Next 页面及路由外壳；本地传输将限定 RPC/查询映射为参数化 SQL，代替原生 PostgREST；PGlite 代替部署 PostgreSQL。公开分享包装复用真实 token 读取、解析服务与 PDF 渲染，不替代既有版本路由测试。测试页面不加载生产 CSS，因此不作为产品页面视觉验收。

报告及最小来源是合成契约数据。本轮没有执行后端报告生成器、采集服务、Google OAuth、Redis 队列、真实支付或生产环境。401/跨 owner 404 检查不能替代真实登录验收；双页陈旧版本测试不能替代原生数据库多连接压力测试。不存在生产鉴权旁路；server-only 与路由替换仅用于测试打包。

## 四项新旅程

1. **批准后交付**：结算重放不重复消费；保存失败保留输入，重试及刷新恢复草稿；批准中文摘要和执行材料，下载 PDF；再编辑批准后，原分享仍固定旧批准版本，且无编辑入口；撤销后不可访问。原始证据不变。
2. **零行动与丢失响应**：无需编辑即可原样批准零行动报告并下载；保存已提交但响应丢失时，重试触发版本冲突、不覆盖；刷新恢复已保存内容。完成诊断只消费原 1 点，不返还，不因批准/下载/编辑另扣点。
3. **双页编辑**：两页读取相同版本，第一页保存后第二页不能覆盖；保留第二页输入，提示冲突并阻止错误批准。
4. **事务和分享失败**：报告插入后的故障令结算整体回滚，未完成报告不可读/下载；解除故障后可完成。创建分享已提交但响应丢失时，不猜测或恢复明文 token；可在管理列表显式撤销，再新建链接。

预留重放、结算重放及全部后续交付操作后，账本保持一次 prospect debit -1，测试初始赠送 5 点余额为 4。技术失败补偿政策不变。

## 验证结果

| 检查 | 结果 |
| --- | --- |
| Playwright：新贯通 4 项 + 旧报告/旧分享/新版分享 3 项，workers=2 | 7 项通过 |
| 前端完整测试 | 152 个文件，1,541 项通过 |
| 类型检查 | 通过 |
| 生产构建 | 通过；现有 Node module.register 弃用提示，不影响构建 |
| 安全扫描 | 45 个文件、0 finding；secretValuesChecked=0，不是生产密钥审计 |
| PDF 文本与下载检查 | owner/旧分享各 4 页，文本完全相同；零行动 3 页 |
| PDF 图像检查 | owner/旧分享四页 PNG 字节完全一致；逐页缩略图检查无截断、重叠或乱码 |
| 后端测试 | 本轮未重跑；不将此前 2,115 项结果冒充本轮结果 |

PDF 含已批准中文摘要、执行材料及原始观察，不含后续私有修改。合成材料短，因此分页留白较多；此轮验证内容、版本和可读性，不声称已完成长篇报告排版优化。

复现：

```sh
npx playwright test e2e/capability-database-journey.spec.ts e2e/prospect-report.spec.ts e2e/report-sharing.spec.ts e2e/capability-share.spec.ts --workers=2
npm test -- --reporter=dot --silent
npm run typecheck
npm run build
npm run security:scan
python3 scripts/inspect-v22-delivery-journey.py output/playwright/test-results
```

PDF 脚本需要 pypdf；本机使用已有依赖运行时。下载件及渲染图保留在 `output/pdf/p2-database-journey/`，浏览器原始附件在 `output/playwright/test-results/`，均为本地验证产物。

初跑暴露测试设施的 TypeScript body/查询类型问题及 Node ESM 的 ajv 路径问题，修正后重跑全部 7 项通过。另一次与开发服务并行的类型检查遇到 .next 临时类型文件变动，串行重跑通过；没有移除失败断言或放宽业务规则。

## 基线与发布边界

开始基线：`/Users/liuyun3/Documents/SearchTurst前后端/.v22-capability-baselines/baseline-sgA6aQ`，SHA-256 `6033994c49d46b6436079773277e107c368ba3697cd513cb08832162e7383ab6`。保留所有既有未提交改动，不重置、不提交。

结束基线：`/Users/liuyun3/Documents/SearchTurst前后端/.v22-capability-baselines/baseline-N94PCl`，SHA-256 `ca4a56bc109c953e74a63eca56eb9f39cd61fb22b20b010808ac10fc58268b5b`。按捕获文件哈希比对，FE 仅本记录、执行主文档、能力台账、两个依赖文件、三个 e2e 文件及 PDF 检查脚本共 9 个文件变化，BE 零变化；两仓库 diff 空白检查通过。本段是结束捕获后补录的唯一文件修改。

没有启用功能开关、执行远程迁移、改动真实客户数据或部署。P2 的真实身份、真实采集/生成 worker 与原生数据库全链路仍待单独验收。后续实施可推进 P3“已有客户直接开始首次服务”的入口与一次性收费工作流，但不得将本记录视为 P2 生产放行。
