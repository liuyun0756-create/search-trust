# P5-03 第七批实施清单

依据：[任务绑定设计](../specs/2026-10-27-p5-review-task-binding-design.md)。用户已授权下一步；实现选择沿用已确认方向，不重复请求批准。使用 brainstorming 做边界自检；writing-plans 不在当前技能目录，沿用此项目清单。

基线：工作区 `.v22-capability-baselines/baseline-pm28dd`；manifest SHA256 `f0fdc31b263e3d616f1b539ec4737c9d9b4b294dd8efa1ec66dc15430f1737bc`。保留已有改动，不提交、不 reset。

- [x] 不可变存储、事务绑定、代次/账本检查、双向互斥迁移。
- [x] 有界后端存储回执、来源标记与生成阶段接线。
- [x] 原生并发/权限/恢复/账本不变验证和后端回归。
- [x] 更新总体计划、验收与后续正式报告/结算边界。

详见 [本批验收记录](./2026-10-27-v22-capability-p5-review-task-binding-verification.md)。新迁移仅在隔离数据库运行；无生产入口、真实收费或部署。
