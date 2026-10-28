# 新版正式发布与线上验收执行记录

2026-10-28，用户说明正式站尚无用户，明确要求直接推送正式环境后验收。本指示覆盖此前选择独立线上验收环境的方案。目标仍为 `trysearchtrust.com`、Vercel `search-trust`、Railway `energetic-fulfillment/production` 的 Web/Worker，以及 Supabase `searchtrust-production` (`cmdsbsvcxesnrrealftb`)。

## 发布前实际结果

- 远端 main：FE `c45e4e3ccb07fa19fcf175bcac20869711552dbe`，BE `9bf2090b91d5ee036f8ea7e470797761b8cf838c`。本地新版存在大量尚未提交的源文件，不能把旧 Git HEAD 当新版发布。
- 新恢复基线：`../.v22-capability-baselines/baseline-QLRrjl`，manifest SHA256 `3460ebabfaf07a429b3dcfb5db26d69b2ece98c9ff9927a83513b64d2b402b7b`。
- 本次实际运行 FE 全量：2,429 项 / 216 文件通过，10.68 秒。报告基础契约生成及差异检查通过。
- 本次实际运行 BE fast：3,342 项通过、254 原生集成项按套件设计排除，190.51 秒。未将排除的原生项计为本次执行；此前隔离原生迁移与持久化验证见各批记录。
- 正式数据库读取成功：当前 37 个迁移，本地 79 个。42 个待应用迁移已通过 `db push --dry-run`；未重写或修复历史迁移记录。
- 正式 public 下 24 张业务表的精确行数均为 0。此结果只涉及数据库业务表，不推断认证平台账号数量。
- 备份完成：`../.release-private/2026-10-28/production-before.dump`，758,124 字节，SHA256 `728ca3c5cc54dd0efd9225925565891d2ba802a45e99b7d1f0dc9de49452cbbf`。包含 public、auth、storage、supabase_migrations，935 个归档目录项。私有目录权限 0700、备份 0600，不入 Git 或可分享产物。使用 Supabase Dashboard 提供的根证书及 `verify-full`。**只检查了归档目录，未执行恢复演练。**
- 备份过程中先遇到根证书缺失，又因 CLI 临时登录角色在其它命令后轮换导致旧凭据无效；使用官方根证书并在生成临时凭据后立即导出解决。未关闭 TLS 证书验证。CLI 包装导出依赖未运行的 Docker，最终使用本机 pg_dump 18.6 完成只读导出。
- Vercel 插件环境读取返回 403；通过现有本机 CLI 凭据和相同项目/团队的官方 API，已成功读取 56 个配置项的元数据。未在日志中输出密钥值。
- Railway CLI 登录仍待浏览器授权。网页现有会话可读取正式项目：Web 当前 Active 部署 `d3f6cc96-ead0-494d-a71a-3ba5e4acf8db`，标题 `v2.2.1 client delivery contract`；不是本轮新业务的部署结果。

## 后续结果逐项更新

1. 固定 FE/BE 源码提交；只纳入源代码、契约、迁移、测试与文档，排除 output、凭据、缓存和本地配置。
2. 应用正式数据库 42 个新增兼容迁移，再读取实际迁移列表、业务行数和关键新表/RPC。
3. 发布 BE 与 Worker；记录实际 deployment ID、源码、健康状态和错误，不以 Git push 成功代替部署成功。
4. 配置并发布 FE；新入口只在对应数据库和执行服务就绪后开放。现有已配置密钥保持受控，新增连接配置需验证目标一致。
5. 用用户指定的网站和 SearchTrust 账号，按明确点数范围执行真实采集/报告/交付；报告质量与真实流程逐步记录。尚无分析对象或授权的数据环节标记待验收。

本记录写入时，数据库迁移和新版部署尚未执行。具体提交、迁移和部署结果以随后追加的实测记录为准。原始安全日志/清单保存在私有发布目录；对外记录只保留不含密钥的数量、状态和摘要。
