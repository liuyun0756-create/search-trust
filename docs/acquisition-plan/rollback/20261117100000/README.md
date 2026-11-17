# P1-02 第一段回滚定义

这些文件来自2026-11-17生产只读pg_get_functiondef导出，非手写重建；原md5及ACL见reviews/P1-02.md。迁移在一个事务内逐函数双md5校验并确认ACL不变，失败全回滚。

如需撤销且尚无v15报告：先只读确认capability_report_versions无2.2.10行、无进行中的v15准备任务，并保存当前定义/ACL；在同一事务中执行13个函数原定义和2个constraint原定义，最后drop function public.validate_v22_gbp_comparison(jsonb)。核对原md5和ACL后提交；不更新或删除任何用户数据。迁移历史回退须由发布负责人按现有流程处理。

若已经保存v15报告，不直接收窄约束或撤销读取能力；保持兼容并由负责人决定前滚方案，不删除报告来强行回滚。普通停止新获客使用v15应由负责人关闭开关，而不是删除数据。本轮未执行回滚。
