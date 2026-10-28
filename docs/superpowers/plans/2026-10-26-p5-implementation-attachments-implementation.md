# P5 实施附件实施清单

依据已确认的 `../specs/2026-10-26-p5-implementation-attachments-design.md`。writing-plans 技能在本环境不存在，以本仓库清单替代。不部署、不改真实环境配置、不收费、不修改旧实施记录摘要。

- [x] 私有 bucket、附件生命周期/配额、所有者及版本授权函数。
- [x] 文件验证、私有存储适配、上传/恢复/读取/移除 API。
- [x] 精确版本的可选附件面板、最小断线恢复状态及历史展示。
- [x] 过期/移除清理执行器，文件删除确认前不释放容量。
- [x] 边界、数据库、存储故障和浏览器测试；类型/构建和回归。
- [x] 验收记录、能力台账与剩余真实存储验收边界。

本地完成：前端 2,133、原生集成 166、浏览器整组 26 项通过；类型检查与生产构建通过。真实 Storage 与目标环境清理调度未验收，功能仍默认关闭，不关闭 P5/P6。详见 `2026-10-26-v22-capability-p5-attachments-verification.md`。

开发前恢复基线：`../.v22-capability-baselines/baseline-e2jxSr`（相对于仓库根目录），manifest SHA256 `fe826f4de37d4a9679a30bd99ab7faf8a153cbfa9a6d97b7bf29d8b2f177b083`。

Python Playwright 当前不可用；网页测试采用仓库已有 Playwright 工具链，真实组件与 API 加隔离网络，不访问真实客户文件。
