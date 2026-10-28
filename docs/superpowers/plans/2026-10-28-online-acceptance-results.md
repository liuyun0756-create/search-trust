# 新版业务线上验收 · 实际结果

开始日期：2026-10-28。用户最初选择独立线上验收环境，随后说明正式站没有用户，要求直接发布正式环境后验收，现按后者执行。进度见 [正式发布记录](./2026-10-28-production-release-execution.md)。所有“通过”必须对应实际线上请求、实际生成报告和同环境持久记录；本地测试、合成来源和独立演示页不计入线上业务通过。

## 第 0 步：当前正式站点基线

| 检查 | 实际结果 | 能证明什么 |
| --- | --- | --- |
| 正式首页 | `https://trysearchtrust.com/` HTTP 200 | 页面可访问 |
| 创建业务页 | `/cases/new` HTTP 200，浏览器能切换 Win the work / Serve a client | 旧版公开入口可读；没有提交网站或分析 |
| API 健康 | Railway `/api/v1/health` HTTP 200，`status=ok`、`version=1.0.0` | 服务进程响应；该通用版本号不能识别新版源码 |
| 队列健康 | 首轮 `/api/v2/health/queue` HTTP 200，Redis 已连接、Worker 存活、`pending_callbacks=0`，响应时间戳 `2026-10-28T07:54:56Z`；随后复查出现 URLError；一次有界跟进检查在 `08:15:50Z` 再次返回 HTTP 200、同样健康状态 | 两次成功之间保留一次请求失败；不宣称持续可用，也不将客户端请求失败直接判为 Worker 故障；不能代替完整任务生成验收 |
| 前端生产部署 | `dpl_G3M1scaADRfFgZMyGn35REMkB1hZ`，Vercel READY / production | 指向正式域名的已部署实例 |
| 前端部署源码 | `c45e4e3ccb07fa19fcf175bcac20869711552dbe`，提交时间 2026-10-02 16:39:05 +08:00 | **没有包含这轮新增业务实现** |
| 新增模块核对 | 生产提交内 report-capability、first-service-setup、implementation-records、review-reports、review-differences、metric-review-guidance 六目录均无文件 | 本轮新版尚不能在当前正式前端验收；不能把旧站结果当新版结果 |
| 后端/Worker 实际源码 | 尚未读到部署元数据 | 不推断它与本地 HEAD 一致 |
| 生产迁移状态 | 未查询；本地源码共有 79 个迁移 | 不宣称线上已应用 79 个迁移 |
| Vercel 环境配置 | 当前连接读取返回 403；本机未发现已安装 Vercel CLI 可用于同范围回退读取 | 未核验当前线上开关或密钥配置；不凭本地默认值代替 |
| Railway 管理连接 | 初始登录过期；用户告知已恢复后，CLI 仍返回 Unauthorized，本机未保存有效会话；已启动官方本机登录，等待浏览器完成 | 当前还不能读取部署、创建独立环境或发布后端 |

证据位于 `output/online-acceptance/2026-10-28/`：`http-checks.json`、`initial-queue-health.json`、`queue-follow-up.json`、`deployment-baseline.json`、`production-service-entry.png`。HTTP 文件保存当次 UTC 时间与实际响应；不保存 Cookie、访问令牌、OAuth 登录链接或客户内容。

## 后续步骤状态

| 步骤 | 当前状态 | 通过所需的真实证据 |
| --- | --- | --- |
| 独立线上环境 | 待建立；用户已选定环境类型 | 前后端与 Worker 的部署 ID/源码、独立数据库/队列、互相匹配的回调与权限、实际应用迁移 |
| 1. 完整业务链验收 | **未开始，不标通过** | 获授权网站和测试账号；实际采集→报告→审核/编辑→批准→PDF/分享；每步记录报告版本、任务状态与前后余额 |
| 2. 真实报告质量 | 未开始 | 检查真实来源对应、事实/判断/限制、行动目标/材料/可执行性；后续复核需真实或获授权历史观察窗口 |
| 3. 官网同步 | 未执行本轮同步 | 使用已验收能力统一实际官网与 FAQ，不提前承诺未验证结果 |
| 4. 正式发布 | 未执行 | 独立环境验收通过、具体正式发布范围和回退记录、正式环境发布后检查 |

目前没有创建真实分析任务，没有扣点或付款，没有修改正式配置、数据库、报告或部署。唯一网页交互是切换公开创建页的工作场景选择。

## 独立环境的准备顺序

1. 恢复 Railway CLI 登录，核对实际项目与账号；恢复具备配置权限的 Vercel 项目连接。先确认目标再创建资源。
2. 固定本轮待验收源码，记录所有本地未提交实现，形成可追溯候选。不能从 Git 旧 HEAD 直接部署并声称包含未提交功能。
3. 为验收建立独立 Supabase 数据库/存储和 Redis 资源；应用源码迁移并核对实际列表。Web 与 Worker 使用同一验收数据库/队列，不连接生产账本、OAuth token 表、业务记录或任务。
4. 部署 Railway Web 与 ARQ Worker，记录镜像/源码与启动配置；核对实际健康和任务消费。当前 Web 配置是 `railway.toml`；Worker 为 `railway.worker.toml` 或 Docker 的 `SEARCHTRUST_SERVICE_ROLE=worker` 入口，必须明确最终使用哪一种。
5. 部署独立前端，设置验收后端 `V22_API_BASE_URL`；后端 `V22_CALLBACK_URL` 对应此前端回调，签名两端匹配。Google broker origin、OAuth 回调和 `NEXT_PUBLIC_BASE_URL` 必须属于同一验收前端。
6. 使用验收专用认证/Google/Dodo 配置；真实测试账号只访问自身授权站点。实际扣点范围待用户明确；支付验收使用明确选定的测试环境，真实付款单独处理。
7. 在验收环境配置和验证新增能力开关，记录实读值，不能仅依赖源码默认值。当前所需开关来源包括 FE 的 capability intake/dispatch、first service、implementation、review evidence/decisions/generation/delivery/differences，以及 BE 对应执行/采集/复核开关。
8. 先用实际只读/免费准备验证连接，再从一份获客报告开始逐步核对，出现失败就保留任务/余额/报告实际状态，修复后使用同一请求的恢复语义。

待补充：允许检测的客户网站；独立环境上的 SearchTrust 验收账号标识；首轮产品点数上限；服务报告对应 Google 数据的授权范围。业务网站指报告分析对象，账号指登录 SearchTrust 的测试账号，均不需要在对话中提供密码。
