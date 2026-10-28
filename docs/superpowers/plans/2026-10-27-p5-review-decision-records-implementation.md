# P5-03 独立决定版本实施清单

依据：`../specs/2026-10-27-p5-review-decision-records-design.md`，用户已确认。writing-plans 技能不可用，沿用项目清单格式。

基线：`/Users/liuyun3/Documents/SearchTurst前后端/.v22-capability-baselines/baseline-JUjhPE`，manifest SHA256 `82aba4cbc46058878407b324dc7b69cf31e3a8c73e6485bd6d6362fcd3763695`。

- [x] 严格决定/请求/回执/历史契约及纯绑定校验，保留旧时间规则。
- [x] 独立不可变表与受限保存/读取/历史 RPC：权限、前版锁、幂等、大小及时间检查。
- [x] 后端存储与服务：固定快照、规范化、受控错误、响应校验和恢复。
- [x] 单元测试：五类决定、空/零行动、上限、非法输入、返回篡改、传输失败。
- [x] 隔离原生测试：并发、断线恢复、历史分页、权限、直接 RPC 校验、旧证据不变及无扣点。
- [x] 证据冻结/工作区/投影和后端 fast 回归；记录实际结果和限制。
- [x] 自检差异、更新主计划和验收记录，不标整体 P5 完成。

结果见 [验收记录](./2026-10-27-v22-capability-p5-review-decisions-verification.md)。本批底层闭环完成，不表示 UI、付费复核报告或 P5 整体完成。

无前端界面/BFF/HTTP 注册，无真实 provider 调用、生产迁移、环境开关变更、收费或部署。
